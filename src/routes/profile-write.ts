import type { FastifyInstance } from 'fastify';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import { Agent } from '@atproto/api';
import { z } from 'zod';
import type { Database } from '../db/index.js';
import { eq } from 'drizzle-orm';
import {
  profiles as profilesTable,
  positions as positionsTable,
  education as educationTable,
  skills as skillsTable,
  certifications as certificationsTable,
  projects as projectsTable,
  volunteering as volunteeringTable,
  publications as publicationsTable,
  courses as coursesTable,
  honors as honorsTable,
  languages as languagesTable,
} from '../db/schema/index.js';
import { profileSelfSchema, positionSchema, educationSchema, skillSchema } from './schemas.js';
import { generateTid, buildApplyWritesOp, writeToUserPds } from '../services/pds-writer.js';
import { createAuthMiddleware, getAuthContext } from '../middleware/auth.js';
import { sanitize, sanitizeOptional } from '../lib/sanitize.js';

const overrideSchema = z.object({
  headline: z.string().max(300).nullish(),
  about: z.string().max(50000).nullish(),
});

export function registerProfileWriteRoutes(
  app: FastifyInstance,
  db: Database,
  oauthClient: NodeOAuthClient | null,
) {
  const requireAuth = createAuthMiddleware(oauthClient, db);

  // PUT /api/profile/self -- update the user's profile summary
  app.put('/api/profile/self', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = profileSelfSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
    }

    const { did, session } = getAuthContext(request);
    const record: Record<string, unknown> = {
      createdAt: new Date().toISOString(),
      ...parsed.data,
    };

    // Flatten location for the ATproto record
    if (parsed.data.location) {
      record.location = parsed.data.location;
    }

    await writeToUserPds(session, did, [
      buildApplyWritesOp('update', 'id.sifa.profile.self', 'self', record),
    ]);

    return reply.status(200).send({ ok: true });
  });

  // POST /api/profile/position -- create a new position
  app.post('/api/profile/position', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = positionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
    }

    const { did, session } = getAuthContext(request);
    const rkey = generateTid();
    const record: Record<string, unknown> = {
      createdAt: new Date().toISOString(),
      ...parsed.data,
    };

    await writeToUserPds(session, did, [
      buildApplyWritesOp('create', 'id.sifa.profile.position', rkey, record),
    ]);

    return reply.status(201).send({ rkey });
  });

  // PUT /api/profile/position/:rkey -- update an existing position
  app.put<{ Params: { rkey: string } }>(
    '/api/profile/position/:rkey',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = positionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
      }

      const { did, session } = getAuthContext(request);
      const { rkey } = request.params;
      const record: Record<string, unknown> = {
        createdAt: new Date().toISOString(),
        ...parsed.data,
      };

      await writeToUserPds(session, did, [
        buildApplyWritesOp('update', 'id.sifa.profile.position', rkey, record),
      ]);

      return reply.status(200).send({ ok: true });
    },
  );

  // DELETE /api/profile/position/:rkey -- delete a position
  app.delete<{ Params: { rkey: string } }>(
    '/api/profile/position/:rkey',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { did, session } = getAuthContext(request);
      const { rkey } = request.params;

      await writeToUserPds(session, did, [
        buildApplyWritesOp('delete', 'id.sifa.profile.position', rkey),
      ]);

      return reply.status(200).send({ ok: true });
    },
  );

  // POST /api/profile/education -- create a new education entry
  app.post('/api/profile/education', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = educationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
    }

    const { did, session } = getAuthContext(request);
    const rkey = generateTid();
    const record: Record<string, unknown> = {
      createdAt: new Date().toISOString(),
      ...parsed.data,
    };

    await writeToUserPds(session, did, [
      buildApplyWritesOp('create', 'id.sifa.profile.education', rkey, record),
    ]);

    return reply.status(201).send({ rkey });
  });

  // PUT /api/profile/education/:rkey -- update an existing education entry
  app.put<{ Params: { rkey: string } }>(
    '/api/profile/education/:rkey',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = educationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
      }

      const { did, session } = getAuthContext(request);
      const { rkey } = request.params;
      const record: Record<string, unknown> = {
        createdAt: new Date().toISOString(),
        ...parsed.data,
      };

      await writeToUserPds(session, did, [
        buildApplyWritesOp('update', 'id.sifa.profile.education', rkey, record),
      ]);

      return reply.status(200).send({ ok: true });
    },
  );

  // DELETE /api/profile/education/:rkey -- delete an education entry
  app.delete<{ Params: { rkey: string } }>(
    '/api/profile/education/:rkey',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { did, session } = getAuthContext(request);
      const { rkey } = request.params;

      await writeToUserPds(session, did, [
        buildApplyWritesOp('delete', 'id.sifa.profile.education', rkey),
      ]);

      return reply.status(200).send({ ok: true });
    },
  );

  // POST /api/profile/skill -- create a new skill
  app.post('/api/profile/skill', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = skillSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
    }

    const { did, session } = getAuthContext(request);
    const rkey = generateTid();
    const record: Record<string, unknown> = {
      createdAt: new Date().toISOString(),
      ...parsed.data,
    };

    await writeToUserPds(session, did, [
      buildApplyWritesOp('create', 'id.sifa.profile.skill', rkey, record),
    ]);

    return reply.status(201).send({ rkey });
  });

  // PUT /api/profile/skill/:rkey -- update an existing skill
  app.put<{ Params: { rkey: string } }>(
    '/api/profile/skill/:rkey',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = skillSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
      }

      const { did, session } = getAuthContext(request);
      const { rkey } = request.params;
      const record: Record<string, unknown> = {
        createdAt: new Date().toISOString(),
        ...parsed.data,
      };

      await writeToUserPds(session, did, [
        buildApplyWritesOp('update', 'id.sifa.profile.skill', rkey, record),
      ]);

      return reply.status(200).send({ ok: true });
    },
  );

  // DELETE /api/profile/skill/:rkey -- delete a skill
  app.delete<{ Params: { rkey: string } }>(
    '/api/profile/skill/:rkey',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { did, session } = getAuthContext(request);
      const { rkey } = request.params;

      await writeToUserPds(session, did, [
        buildApplyWritesOp('delete', 'id.sifa.profile.skill', rkey),
      ]);

      return reply.status(200).send({ ok: true });
    },
  );

  // POST /api/profile/sync -- read PDS data and populate local database
  app.post('/api/profile/sync', { preHandler: requireAuth }, async (request, reply) => {
    const { did, session } = getAuthContext(request);
    // Authenticated agent reads custom lexicon collections from the user's PDS.
    // The public Bluesky API does NOT serve id.sifa.* records.
    const pdsAgent = new Agent(session);
    const publicAgent = new Agent('https://public.api.bsky.app');
    const now = new Date();

    const synced = {
      profile: 0,
      positions: 0,
      education: 0,
      skills: 0,
      certifications: 0,
      projects: 0,
      volunteering: 0,
      publications: 0,
      courses: 0,
      honors: 0,
      languages: 0,
    };

    // Preserve existing identity fields (handle, displayName, avatar)
    const [existingProfile] = await db
      .select({
        handle: profilesTable.handle,
        displayName: profilesTable.displayName,
        avatarUrl: profilesTable.avatarUrl,
      })
      .from(profilesTable)
      .where(eq(profilesTable.did, did))
      .limit(1);

    // If no existing row, resolve from Bluesky
    let handle = existingProfile?.handle || '';
    let displayName = existingProfile?.displayName ?? null;
    let avatarUrl = existingProfile?.avatarUrl ?? null;
    let bskyBio: string | null = null;

    if (!handle) {
      try {
        const bskyProfile = await publicAgent.getProfile(
          { actor: did },
          { signal: AbortSignal.timeout(3000) },
        );
        handle = bskyProfile.data.handle;
        displayName = bskyProfile.data.displayName ?? null;
        avatarUrl = bskyProfile.data.avatar ?? null;
        bskyBio = bskyProfile.data.description ?? null;
      } catch {
        // Best effort — handle stays empty
      }
    }

    if (!bskyBio) {
      try {
        const bskyRes = await publicAgent.getProfile(
          { actor: did },
          { signal: AbortSignal.timeout(3000) },
        );
        bskyBio = bskyRes.data.description ?? null;
      } catch {
        // Best effort
      }
    }

    try {
      // Sync profile.self
      try {
        const profileRes = await pdsAgent.com.atproto.repo.getRecord({
          repo: did,
          collection: 'id.sifa.profile.self',
          rkey: 'self',
        });
        const r = profileRes.data.value as Record<string, unknown>;
        const loc = r.location as { country?: string; region?: string; city?: string } | undefined;
        await db
          .insert(profilesTable)
          .values({
            did,
            handle,
            displayName,
            avatarUrl,
            headline: sanitizeOptional(r.headline as string | undefined) ?? null,
            about: sanitizeOptional(r.about as string | undefined) ?? null,
            industry: sanitizeOptional(r.industry as string | undefined) ?? null,
            locationCountry: sanitizeOptional(loc?.country) ?? null,
            locationRegion: sanitizeOptional(loc?.region) ?? null,
            locationCity: sanitizeOptional(loc?.city) ?? null,
            createdAt: now,
            indexedAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: profilesTable.did,
            set: {
              headline: sanitizeOptional(r.headline as string | undefined) ?? null,
              about: sanitizeOptional(r.about as string | undefined) ?? null,
              industry: sanitizeOptional(r.industry as string | undefined) ?? null,
              locationCountry: sanitizeOptional(loc?.country) ?? null,
              locationRegion: sanitizeOptional(loc?.region) ?? null,
              locationCity: sanitizeOptional(loc?.city) ?? null,
              updatedAt: now,
            },
          });
        synced.profile = 1;
      } catch {
        // No profile.self record in PDS — seed about from Bluesky bio if available
        if (bskyBio) {
          const sanitizedBio = sanitizeOptional(bskyBio) ?? null;
          await db
            .insert(profilesTable)
            .values({
              did,
              handle,
              displayName,
              avatarUrl,
              about: sanitizedBio,
              createdAt: now,
              indexedAt: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: profilesTable.did,
              set: {
                handle: handle || undefined,
                displayName,
                avatarUrl,
                updatedAt: now,
              },
            });
          synced.profile = 1;
        }
      }

      // Sync positions
      try {
        const posRes = await pdsAgent.com.atproto.repo.listRecords({
          repo: did,
          collection: 'id.sifa.profile.position',
          limit: 100,
        });
        for (const rec of posRes.data.records) {
          const rkey = rec.uri.split('/').pop() ?? '';
          const r = rec.value as Record<string, unknown>;
          const loc = r.location as
            | { country?: string; region?: string; city?: string }
            | undefined;
          await db
            .insert(positionsTable)
            .values({
              did,
              rkey,
              companyName: sanitize(r.companyName as string),
              title: sanitize(r.title as string),
              description: sanitizeOptional(r.description as string | undefined) ?? null,
              locationCountry: sanitizeOptional(loc?.country) ?? null,
              locationRegion: sanitizeOptional(loc?.region) ?? null,
              locationCity: sanitizeOptional(loc?.city) ?? null,
              startDate: (r.startDate as string) ?? '',
              endDate: (r.endDate as string) ?? null,
              current: (r.current as boolean) ?? false,
              createdAt: r.createdAt ? new Date(r.createdAt as string) : now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [positionsTable.did, positionsTable.rkey],
              set: {
                companyName: sanitize(r.companyName as string),
                title: sanitize(r.title as string),
                description: sanitizeOptional(r.description as string | undefined) ?? null,
                locationCountry: sanitizeOptional(loc?.country) ?? null,
                locationRegion: sanitizeOptional(loc?.region) ?? null,
                locationCity: sanitizeOptional(loc?.city) ?? null,
                startDate: (r.startDate as string) ?? '',
                endDate: (r.endDate as string) ?? null,
                current: (r.current as boolean) ?? false,
                indexedAt: now,
              },
            });
          synced.positions++;
        }
      } catch {
        // No position records
      }

      // Sync education
      try {
        const eduRes = await pdsAgent.com.atproto.repo.listRecords({
          repo: did,
          collection: 'id.sifa.profile.education',
          limit: 100,
        });
        for (const rec of eduRes.data.records) {
          const rkey = rec.uri.split('/').pop() ?? '';
          const r = rec.value as Record<string, unknown>;
          await db
            .insert(educationTable)
            .values({
              did,
              rkey,
              institution: sanitize(r.institution as string),
              degree: sanitizeOptional(r.degree as string | undefined) ?? null,
              fieldOfStudy: sanitizeOptional(r.fieldOfStudy as string | undefined) ?? null,
              description: sanitizeOptional(r.description as string | undefined) ?? null,
              startDate: (r.startDate as string) ?? null,
              endDate: (r.endDate as string) ?? null,
              createdAt: r.createdAt ? new Date(r.createdAt as string) : now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [educationTable.did, educationTable.rkey],
              set: {
                institution: sanitize(r.institution as string),
                degree: sanitizeOptional(r.degree as string | undefined) ?? null,
                fieldOfStudy: sanitizeOptional(r.fieldOfStudy as string | undefined) ?? null,
                description: sanitizeOptional(r.description as string | undefined) ?? null,
                startDate: (r.startDate as string) ?? null,
                endDate: (r.endDate as string) ?? null,
                indexedAt: now,
              },
            });
          synced.education++;
        }
      } catch {
        // No education records
      }

      // Sync skills
      try {
        const skillRes = await pdsAgent.com.atproto.repo.listRecords({
          repo: did,
          collection: 'id.sifa.profile.skill',
          limit: 200,
        });
        for (const rec of skillRes.data.records) {
          const rkey = rec.uri.split('/').pop() ?? '';
          const r = rec.value as Record<string, unknown>;
          await db
            .insert(skillsTable)
            .values({
              did,
              rkey,
              skillName: sanitize(r.skillName as string),
              category: sanitizeOptional(r.category as string | undefined) ?? null,
              createdAt: r.createdAt ? new Date(r.createdAt as string) : now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [skillsTable.did, skillsTable.rkey],
              set: {
                skillName: sanitize(r.skillName as string),
                category: sanitizeOptional(r.category as string | undefined) ?? null,
                indexedAt: now,
              },
            });
          synced.skills++;
        }
      } catch {
        // No skill records
      }

      // Sync certifications
      try {
        const res = await pdsAgent.com.atproto.repo.listRecords({
          repo: did,
          collection: 'id.sifa.profile.certification',
          limit: 100,
        });
        for (const rec of res.data.records) {
          const rkey = rec.uri.split('/').pop() ?? '';
          const r = rec.value as Record<string, unknown>;
          await db
            .insert(certificationsTable)
            .values({
              did,
              rkey,
              name: sanitize(r.name as string),
              authority: sanitizeOptional(r.authority as string | undefined) ?? null,
              credentialId: (r.credentialId as string) ?? null,
              credentialUrl: (r.credentialUrl as string) ?? null,
              issuedAt: (r.issuedAt as string) ?? null,
              expiresAt: (r.expiresAt as string) ?? null,
              createdAt: r.createdAt ? new Date(r.createdAt as string) : now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [certificationsTable.did, certificationsTable.rkey],
              set: {
                name: sanitize(r.name as string),
                authority: sanitizeOptional(r.authority as string | undefined) ?? null,
                credentialId: (r.credentialId as string) ?? null,
                credentialUrl: (r.credentialUrl as string) ?? null,
                issuedAt: (r.issuedAt as string) ?? null,
                expiresAt: (r.expiresAt as string) ?? null,
                indexedAt: now,
              },
            });
          synced.certifications++;
        }
      } catch {
        /* No certification records */
      }

      // Sync projects
      try {
        const res = await pdsAgent.com.atproto.repo.listRecords({
          repo: did,
          collection: 'id.sifa.profile.project',
          limit: 100,
        });
        for (const rec of res.data.records) {
          const rkey = rec.uri.split('/').pop() ?? '';
          const r = rec.value as Record<string, unknown>;
          await db
            .insert(projectsTable)
            .values({
              did,
              rkey,
              name: sanitize(r.name as string),
              description: sanitizeOptional(r.description as string | undefined) ?? null,
              url: (r.url as string) ?? null,
              startedAt: (r.startedAt as string) ?? null,
              endedAt: (r.endedAt as string) ?? null,
              createdAt: r.createdAt ? new Date(r.createdAt as string) : now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [projectsTable.did, projectsTable.rkey],
              set: {
                name: sanitize(r.name as string),
                description: sanitizeOptional(r.description as string | undefined) ?? null,
                url: (r.url as string) ?? null,
                startedAt: (r.startedAt as string) ?? null,
                endedAt: (r.endedAt as string) ?? null,
                indexedAt: now,
              },
            });
          synced.projects++;
        }
      } catch {
        /* No project records */
      }

      // Sync volunteering
      try {
        const res = await pdsAgent.com.atproto.repo.listRecords({
          repo: did,
          collection: 'id.sifa.profile.volunteering',
          limit: 100,
        });
        for (const rec of res.data.records) {
          const rkey = rec.uri.split('/').pop() ?? '';
          const r = rec.value as Record<string, unknown>;
          await db
            .insert(volunteeringTable)
            .values({
              did,
              rkey,
              organization: sanitize(r.organization as string),
              role: sanitizeOptional(r.role as string | undefined) ?? null,
              cause: sanitizeOptional(r.cause as string | undefined) ?? null,
              description: sanitizeOptional(r.description as string | undefined) ?? null,
              startedAt: (r.startedAt as string) ?? null,
              endedAt: (r.endedAt as string) ?? null,
              createdAt: r.createdAt ? new Date(r.createdAt as string) : now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [volunteeringTable.did, volunteeringTable.rkey],
              set: {
                organization: sanitize(r.organization as string),
                role: sanitizeOptional(r.role as string | undefined) ?? null,
                cause: sanitizeOptional(r.cause as string | undefined) ?? null,
                description: sanitizeOptional(r.description as string | undefined) ?? null,
                startedAt: (r.startedAt as string) ?? null,
                endedAt: (r.endedAt as string) ?? null,
                indexedAt: now,
              },
            });
          synced.volunteering++;
        }
      } catch {
        /* No volunteering records */
      }

      // Sync publications
      try {
        const res = await pdsAgent.com.atproto.repo.listRecords({
          repo: did,
          collection: 'id.sifa.profile.publication',
          limit: 100,
        });
        for (const rec of res.data.records) {
          const rkey = rec.uri.split('/').pop() ?? '';
          const r = rec.value as Record<string, unknown>;
          await db
            .insert(publicationsTable)
            .values({
              did,
              rkey,
              title: sanitize(r.title as string),
              publisher: sanitizeOptional(r.publisher as string | undefined) ?? null,
              url: (r.url as string) ?? null,
              description: sanitizeOptional(r.description as string | undefined) ?? null,
              publishedAt: (r.publishedAt as string) ?? null,
              createdAt: r.createdAt ? new Date(r.createdAt as string) : now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [publicationsTable.did, publicationsTable.rkey],
              set: {
                title: sanitize(r.title as string),
                publisher: sanitizeOptional(r.publisher as string | undefined) ?? null,
                url: (r.url as string) ?? null,
                description: sanitizeOptional(r.description as string | undefined) ?? null,
                publishedAt: (r.publishedAt as string) ?? null,
                indexedAt: now,
              },
            });
          synced.publications++;
        }
      } catch {
        /* No publication records */
      }

      // Sync courses
      try {
        const res = await pdsAgent.com.atproto.repo.listRecords({
          repo: did,
          collection: 'id.sifa.profile.course',
          limit: 200,
        });
        for (const rec of res.data.records) {
          const rkey = rec.uri.split('/').pop() ?? '';
          const r = rec.value as Record<string, unknown>;
          await db
            .insert(coursesTable)
            .values({
              did,
              rkey,
              name: sanitize(r.name as string),
              number: sanitizeOptional(r.number as string | undefined) ?? null,
              institution: sanitizeOptional(r.institution as string | undefined) ?? null,
              createdAt: r.createdAt ? new Date(r.createdAt as string) : now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [coursesTable.did, coursesTable.rkey],
              set: {
                name: sanitize(r.name as string),
                number: sanitizeOptional(r.number as string | undefined) ?? null,
                institution: sanitizeOptional(r.institution as string | undefined) ?? null,
                indexedAt: now,
              },
            });
          synced.courses++;
        }
      } catch {
        /* No course records */
      }

      // Sync honors
      try {
        const res = await pdsAgent.com.atproto.repo.listRecords({
          repo: did,
          collection: 'id.sifa.profile.honor',
          limit: 100,
        });
        for (const rec of res.data.records) {
          const rkey = rec.uri.split('/').pop() ?? '';
          const r = rec.value as Record<string, unknown>;
          await db
            .insert(honorsTable)
            .values({
              did,
              rkey,
              title: sanitize(r.title as string),
              issuer: sanitizeOptional(r.issuer as string | undefined) ?? null,
              description: sanitizeOptional(r.description as string | undefined) ?? null,
              awardedAt: (r.awardedAt as string) ?? null,
              createdAt: r.createdAt ? new Date(r.createdAt as string) : now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [honorsTable.did, honorsTable.rkey],
              set: {
                title: sanitize(r.title as string),
                issuer: sanitizeOptional(r.issuer as string | undefined) ?? null,
                description: sanitizeOptional(r.description as string | undefined) ?? null,
                awardedAt: (r.awardedAt as string) ?? null,
                indexedAt: now,
              },
            });
          synced.honors++;
        }
      } catch {
        /* No honor records */
      }

      // Sync languages
      try {
        const res = await pdsAgent.com.atproto.repo.listRecords({
          repo: did,
          collection: 'id.sifa.profile.language',
          limit: 100,
        });
        for (const rec of res.data.records) {
          const rkey = rec.uri.split('/').pop() ?? '';
          const r = rec.value as Record<string, unknown>;
          await db
            .insert(languagesTable)
            .values({
              did,
              rkey,
              name: sanitize(r.name as string),
              proficiency: (r.proficiency as string) ?? null,
              createdAt: r.createdAt ? new Date(r.createdAt as string) : now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [languagesTable.did, languagesTable.rkey],
              set: {
                name: sanitize(r.name as string),
                proficiency: (r.proficiency as string) ?? null,
                indexedAt: now,
              },
            });
          synced.languages++;
        }
      } catch {
        /* No language records */
      }
    } catch (err) {
      app.log.error({ err, did }, 'Profile sync from PDS failed');
      return reply.status(500).send({ error: 'SyncFailed', message: 'Failed to sync from PDS' });
    }

    app.log.info({ did, synced }, 'Profile synced from PDS');
    return reply.send({ synced });
  });

  // PUT /api/profile/override -- set or clear AppView-local overrides
  app.put('/api/profile/override', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = overrideSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
    }

    const { did } = getAuthContext(request);
    const updates: Record<string, string | null> = {};

    // Only update fields that were explicitly sent in the request body
    const body = request.body as Record<string, unknown>;
    if ('headline' in body) {
      updates.headlineOverride = parsed.data.headline?.trim() || null;
    }
    if ('about' in body) {
      updates.aboutOverride = parsed.data.about?.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: 'ValidationError', message: 'No fields to update' });
    }

    await db
      .update(profilesTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(profilesTable.did, did));

    return reply.status(200).send({ ok: true });
  });

  // DELETE /api/profile/override -- reset all overrides to ATProto source
  app.delete('/api/profile/override', { preHandler: requireAuth }, async (request, reply) => {
    const { did } = getAuthContext(request);

    await db
      .update(profilesTable)
      .set({
        headlineOverride: null,
        aboutOverride: null,
        updatedAt: new Date(),
      })
      .where(eq(profilesTable.did, did));

    return reply.status(200).send({ ok: true });
  });
}
