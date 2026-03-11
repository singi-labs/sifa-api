import type { FastifyInstance } from 'fastify';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import { Agent } from '@atproto/api';
import type { Database } from '../db/index.js';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { profileSelfSchema, positionSchema, educationSchema, skillSchema } from './schemas.js';
import {
  generateTid,
  buildApplyWritesOp,
  writeToUserPds,
  type ApplyWritesOp,
} from '../services/pds-writer.js';
import { createAuthMiddleware, getAuthContext } from '../middleware/auth.js';
import { sanitize, sanitizeOptional } from '../lib/sanitize.js';
import {
  profiles as profilesTable,
  positions as positionsTable,
  education as educationTable,
  skills as skillsTable,
} from '../db/schema/index.js';

const importPayloadSchema = z.object({
  profile: profileSelfSchema.nullish(),
  positions: z.array(positionSchema).max(100).default([]),
  education: z.array(educationSchema).max(50).default([]),
  skills: z.array(skillSchema).max(200).default([]),
});

type ImportProfile = z.infer<typeof profileSelfSchema>;
type ImportPosition = z.infer<typeof positionSchema>;
type ImportEducation = z.infer<typeof educationSchema>;
type ImportSkill = z.infer<typeof skillSchema>;

function normalizeLocation(
  location: string | { country: string; region?: string; city?: string } | undefined,
): { country: string; region?: string; city?: string } | undefined {
  if (!location) return undefined;
  if (typeof location === 'string') {
    // Best-effort: treat the string as city, or skip if empty
    const trimmed = location.trim();
    if (!trimmed) return undefined;
    return { country: trimmed };
  }
  return {
    country: sanitize(location.country),
    region: sanitizeOptional(location.region),
    city: sanitizeOptional(location.city),
  };
}

function sanitizeProfile(profile: ImportProfile): ImportProfile {
  return {
    ...profile,
    headline: sanitizeOptional(profile.headline),
    about: sanitizeOptional(profile.about),
    industry: sanitizeOptional(profile.industry),
    location: normalizeLocation(profile.location),
  };
}

function sanitizePosition(pos: ImportPosition): ImportPosition {
  return {
    ...pos,
    companyName: sanitize(pos.companyName),
    title: sanitize(pos.title),
    description: sanitizeOptional(pos.description),
    location: normalizeLocation(pos.location),
  };
}

function sanitizeEducation(edu: ImportEducation): ImportEducation {
  return {
    ...edu,
    institution: sanitize(edu.institution),
    degree: sanitizeOptional(edu.degree),
    fieldOfStudy: sanitizeOptional(edu.fieldOfStudy),
    description: sanitizeOptional(edu.description),
  };
}

function sanitizeSkill(skill: ImportSkill): ImportSkill {
  return {
    ...skill,
    skillName: sanitize(skill.skillName),
    category: sanitizeOptional(skill.category),
  };
}

export function registerImportRoutes(
  app: FastifyInstance,
  db: Database,
  oauthClient: NodeOAuthClient | null,
) {
  const requireAuth = createAuthMiddleware(oauthClient, db);

  app.post('/api/import/linkedin/confirm', { preHandler: requireAuth }, async (request, reply) => {
    const body = importPayloadSchema.safeParse(request.body);
    if (!body.success) {
      app.log.warn({ issues: body.error.issues }, 'Import validation failed');
      return reply
        .status(400)
        .send({ error: 'InvalidRequest', message: 'Validation failed', issues: body.error.issues });
    }

    const { profile, positions, education, skills } = body.data;
    const { did, session } = getAuthContext(request);

    // Sanitize all data and generate rkeys upfront
    const now = new Date();
    const nowIso = now.toISOString();

    const cleanProfile = profile ? sanitizeProfile(profile) : null;
    const cleanPositions = positions.map((pos) => ({
      data: sanitizePosition(pos),
      rkey: generateTid(),
    }));
    const cleanEducation = education.map((edu) => ({
      data: sanitizeEducation(edu),
      rkey: generateTid(),
    }));
    const cleanSkills = skills.map((skill) => ({
      data: sanitizeSkill(skill),
      rkey: generateTid(),
    }));

    // Delete existing PDS records before creating new ones (supports re-import)
    const agent = new Agent(session);
    const deletes: ApplyWritesOp[] = [];

    try {
      const collections = [
        'id.sifa.profile.position',
        'id.sifa.profile.education',
        'id.sifa.profile.skill',
      ];
      for (const collection of collections) {
        const existing = await agent.com.atproto.repo.listRecords({
          repo: did,
          collection,
          limit: 100,
        });
        for (const rec of existing.data.records) {
          const rkey = rec.uri.split('/').pop() ?? '';
          if (rkey) deletes.push(buildApplyWritesOp('delete', collection, rkey));
        }
      }

      // Check if profile.self exists — if so, we'll update instead of create
      try {
        await agent.com.atproto.repo.getRecord({
          repo: did,
          collection: 'id.sifa.profile.self',
          rkey: 'self',
        });
        // Profile exists — mark for update
        if (cleanProfile) {
          deletes.push(buildApplyWritesOp('delete', 'id.sifa.profile.self', 'self'));
        }
      } catch {
        // Profile doesn't exist yet — create is fine
      }
    } catch (err) {
      app.log.warn({ err, did }, 'Failed to list existing PDS records, proceeding with create');
    }

    // Build PDS write operations: deletes first, then creates
    const writes: ApplyWritesOp[] = [...deletes];

    if (cleanProfile) {
      writes.push(
        buildApplyWritesOp('create', 'id.sifa.profile.self', 'self', {
          ...cleanProfile,
          createdAt: nowIso,
        }),
      );
    }

    for (const { data, rkey } of cleanPositions) {
      writes.push(
        buildApplyWritesOp('create', 'id.sifa.profile.position', rkey, {
          ...data,
          createdAt: nowIso,
        }),
      );
    }

    for (const { data, rkey } of cleanEducation) {
      writes.push(
        buildApplyWritesOp('create', 'id.sifa.profile.education', rkey, {
          ...data,
          createdAt: nowIso,
        }),
      );
    }

    for (const { data, rkey } of cleanSkills) {
      writes.push(
        buildApplyWritesOp('create', 'id.sifa.profile.skill', rkey, {
          ...data,
          createdAt: nowIso,
        }),
      );
    }

    // Write to PDS
    const BATCH_SIZE = 100;
    try {
      for (let i = 0; i < writes.length; i += BATCH_SIZE) {
        const batch = writes.slice(i, i + BATCH_SIZE);
        await writeToUserPds(session, did, batch);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      app.log.error({ err, did, writeCount: writes.length }, 'PDS write failed during import');
      return reply
        .status(500)
        .send({ error: 'ImportFailed', message: 'Failed to write to PDS', detail });
    }

    // Write-through: index into local DB so profile is immediately visible.
    // Jetstream would eventually deliver the same data, but this avoids latency.
    // Delete existing records first (re-import case), then insert fresh data.
    try {
      // Preserve existing profile identity fields (handle, displayName, avatar)
      // that were set by the OAuth callback — import should only update content fields.
      const [existingProfile] = await db
        .select({
          handle: profilesTable.handle,
          displayName: profilesTable.displayName,
          avatarUrl: profilesTable.avatarUrl,
        })
        .from(profilesTable)
        .where(eq(profilesTable.did, did))
        .limit(1);

      let handle = existingProfile?.handle || '';
      let displayName = existingProfile?.displayName ?? null;
      let avatarUrl = existingProfile?.avatarUrl ?? null;

      // If handle is missing (e.g. profile created before OAuth callback), resolve from Bluesky
      if (!handle) {
        try {
          const publicAgent = new Agent('https://public.api.bsky.app');
          const bskyProfile = await publicAgent.getProfile({ actor: did });
          handle = bskyProfile.data.handle;
          displayName = bskyProfile.data.displayName ?? displayName;
          avatarUrl = bskyProfile.data.avatar ?? avatarUrl;
        } catch {
          // Best effort — handle stays empty
        }
      }

      await db.delete(positionsTable).where(eq(positionsTable.did, did));
      await db.delete(educationTable).where(eq(educationTable.did, did));
      await db.delete(skillsTable).where(eq(skillsTable.did, did));

      // Always ensure the profile row has identity fields, even without LinkedIn profile data
      if (handle && (!existingProfile || !existingProfile.handle)) {
        await db
          .insert(profilesTable)
          .values({
            did,
            handle,
            displayName,
            avatarUrl,
            createdAt: now,
            indexedAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: profilesTable.did,
            set: {
              handle,
              displayName,
              avatarUrl,
              updatedAt: now,
            },
          });
      }

      if (cleanProfile) {
        const loc = normalizeLocation(cleanProfile.location);
        await db
          .insert(profilesTable)
          .values({
            did,
            handle,
            displayName,
            avatarUrl,
            headline: cleanProfile.headline ?? null,
            about: cleanProfile.about ?? null,
            industry: cleanProfile.industry ?? null,
            locationCountry: loc?.country ?? null,
            locationRegion: loc?.region ?? null,
            locationCity: loc?.city ?? null,
            createdAt: now,
            indexedAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: profilesTable.did,
            set: {
              handle,
              displayName,
              avatarUrl,
              headline: cleanProfile.headline ?? null,
              about: cleanProfile.about ?? null,
              industry: cleanProfile.industry ?? null,
              locationCountry: loc?.country ?? null,
              locationRegion: loc?.region ?? null,
              locationCity: loc?.city ?? null,
              updatedAt: now,
            },
          });
      }

      if (cleanPositions.length > 0) {
        await db.insert(positionsTable).values(
          cleanPositions.map(({ data, rkey }) => {
            const loc = normalizeLocation(data.location);
            return {
              did,
              rkey,
              companyName: data.companyName,
              title: data.title,
              description: data.description ?? null,
              locationCountry: loc?.country ?? null,
              locationRegion: loc?.region ?? null,
              locationCity: loc?.city ?? null,
              startDate: data.startDate ?? '',
              endDate: data.endDate ?? null,
              current: data.current ?? false,
              createdAt: now,
              indexedAt: now,
            };
          }),
        );
      }

      if (cleanEducation.length > 0) {
        await db.insert(educationTable).values(
          cleanEducation.map(({ data, rkey }) => ({
            did,
            rkey,
            institution: data.institution,
            degree: data.degree ?? null,
            fieldOfStudy: data.fieldOfStudy ?? null,
            description: data.description ?? null,
            startDate: data.startDate ?? null,
            endDate: data.endDate ?? null,
            createdAt: now,
            indexedAt: now,
          })),
        );
      }

      if (cleanSkills.length > 0) {
        await db.insert(skillsTable).values(
          cleanSkills.map(({ data, rkey }) => ({
            did,
            rkey,
            skillName: data.skillName,
            category: data.category ?? null,
            createdAt: now,
            indexedAt: now,
          })),
        );
      }
    } catch (err) {
      // DB write-through is best-effort; PDS write already succeeded.
      // Jetstream will eventually deliver the data if this fails.
      app.log.error({ err, did }, 'Import DB write-through failed (PDS write succeeded)');
    }

    return reply.status(200).send({
      imported: {
        profile: profile ? 1 : 0,
        positions: positions.length,
        education: education.length,
        skills: skills.length,
      },
    });
  });
}
