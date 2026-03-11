import type { FastifyInstance } from 'fastify';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import { Agent } from '@atproto/api';
import type { Database } from '../db/index.js';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  profileSelfSchema,
  positionSchema,
  educationSchema,
  skillSchema,
  certificationSchema,
  projectSchema,
  volunteeringSchema,
  publicationSchema,
  courseSchema,
  honorSchema,
  languageSchema,
} from './schemas.js';
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
  certifications as certificationsTable,
  projects as projectsTable,
  volunteering as volunteeringTable,
  publications as publicationsTable,
  courses as coursesTable,
  honors as honorsTable,
  languages as languagesTable,
} from '../db/schema/index.js';

const importPayloadSchema = z.object({
  profile: profileSelfSchema.nullish(),
  positions: z.array(positionSchema).max(100).default([]),
  education: z.array(educationSchema).max(50).default([]),
  skills: z.array(skillSchema).max(200).default([]),
  certifications: z.array(certificationSchema).max(50).default([]),
  projects: z.array(projectSchema).max(50).default([]),
  volunteering: z.array(volunteeringSchema).max(50).default([]),
  publications: z.array(publicationSchema).max(50).default([]),
  courses: z.array(courseSchema).max(100).default([]),
  honors: z.array(honorSchema).max(50).default([]),
  languages: z.array(languageSchema).max(50).default([]),
});

type ImportProfile = z.infer<typeof profileSelfSchema>;
type ImportPosition = z.infer<typeof positionSchema>;
type ImportEducation = z.infer<typeof educationSchema>;
type ImportSkill = z.infer<typeof skillSchema>;
type ImportCertification = z.infer<typeof certificationSchema>;
type ImportProject = z.infer<typeof projectSchema>;
type ImportVolunteering = z.infer<typeof volunteeringSchema>;
type ImportPublication = z.infer<typeof publicationSchema>;
type ImportCourse = z.infer<typeof courseSchema>;
type ImportHonor = z.infer<typeof honorSchema>;
type ImportLanguage = z.infer<typeof languageSchema>;

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

function sanitizeCertification(cert: ImportCertification): ImportCertification {
  return { ...cert, name: sanitize(cert.name), authority: sanitizeOptional(cert.authority) };
}

function sanitizeProject(proj: ImportProject): ImportProject {
  return { ...proj, name: sanitize(proj.name), description: sanitizeOptional(proj.description) };
}

function sanitizeVolunteering(vol: ImportVolunteering): ImportVolunteering {
  return {
    ...vol,
    organization: sanitize(vol.organization),
    role: sanitizeOptional(vol.role),
    cause: sanitizeOptional(vol.cause),
    description: sanitizeOptional(vol.description),
  };
}

function sanitizePublication(pub: ImportPublication): ImportPublication {
  return {
    ...pub,
    title: sanitize(pub.title),
    publisher: sanitizeOptional(pub.publisher),
    description: sanitizeOptional(pub.description),
  };
}

function sanitizeCourse(course: ImportCourse): ImportCourse {
  return {
    ...course,
    name: sanitize(course.name),
    number: sanitizeOptional(course.number),
    institution: sanitizeOptional(course.institution),
  };
}

function sanitizeHonor(honor: ImportHonor): ImportHonor {
  return {
    ...honor,
    title: sanitize(honor.title),
    issuer: sanitizeOptional(honor.issuer),
    description: sanitizeOptional(honor.description),
  };
}

function sanitizeLanguage(lang: ImportLanguage): ImportLanguage {
  return { ...lang, name: sanitize(lang.name) };
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

    const {
      profile,
      positions,
      education,
      skills,
      certifications,
      projects,
      volunteering,
      publications,
      courses,
      honors,
      languages,
    } = body.data;
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
    const cleanCertifications = certifications.map((c) => ({
      data: sanitizeCertification(c),
      rkey: generateTid(),
    }));
    const cleanProjects = projects.map((p) => ({
      data: sanitizeProject(p),
      rkey: generateTid(),
    }));
    const cleanVolunteering = volunteering.map((v) => ({
      data: sanitizeVolunteering(v),
      rkey: generateTid(),
    }));
    const cleanPublications = publications.map((p) => ({
      data: sanitizePublication(p),
      rkey: generateTid(),
    }));
    const cleanCourses = courses.map((c) => ({
      data: sanitizeCourse(c),
      rkey: generateTid(),
    }));
    const cleanHonors = honors.map((h) => ({
      data: sanitizeHonor(h),
      rkey: generateTid(),
    }));
    const cleanLanguages = languages.map((l) => ({
      data: sanitizeLanguage(l),
      rkey: generateTid(),
    }));

    // Delete existing PDS records before creating new ones (supports re-import)
    const agent = new Agent(session);
    const deletes: ApplyWritesOp[] = [];
    let profileExistsOnPds = false;

    try {
      const collections = [
        'id.sifa.profile.position',
        'id.sifa.profile.education',
        'id.sifa.profile.skill',
        'id.sifa.profile.certification',
        'id.sifa.profile.project',
        'id.sifa.profile.volunteering',
        'id.sifa.profile.publication',
        'id.sifa.profile.course',
        'id.sifa.profile.honor',
        'id.sifa.profile.language',
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

      // Check if profile.self exists — if so, we'll use update (not delete+create)
      // to avoid a Jetstream delete event that cascades and wipes the local DB.
      try {
        await agent.com.atproto.repo.getRecord({
          repo: did,
          collection: 'id.sifa.profile.self',
          rkey: 'self',
        });
        profileExistsOnPds = true;
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
        buildApplyWritesOp(
          profileExistsOnPds ? 'update' : 'create',
          'id.sifa.profile.self',
          'self',
          {
            ...cleanProfile,
            createdAt: nowIso,
          },
        ),
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

    for (const { data, rkey } of cleanCertifications) {
      writes.push(
        buildApplyWritesOp('create', 'id.sifa.profile.certification', rkey, {
          ...data,
          createdAt: nowIso,
        }),
      );
    }

    for (const { data, rkey } of cleanProjects) {
      writes.push(
        buildApplyWritesOp('create', 'id.sifa.profile.project', rkey, {
          ...data,
          createdAt: nowIso,
        }),
      );
    }

    for (const { data, rkey } of cleanVolunteering) {
      writes.push(
        buildApplyWritesOp('create', 'id.sifa.profile.volunteering', rkey, {
          ...data,
          createdAt: nowIso,
        }),
      );
    }

    for (const { data, rkey } of cleanPublications) {
      writes.push(
        buildApplyWritesOp('create', 'id.sifa.profile.publication', rkey, {
          ...data,
          createdAt: nowIso,
        }),
      );
    }

    for (const { data, rkey } of cleanCourses) {
      writes.push(
        buildApplyWritesOp('create', 'id.sifa.profile.course', rkey, {
          ...data,
          createdAt: nowIso,
        }),
      );
    }

    for (const { data, rkey } of cleanHonors) {
      writes.push(
        buildApplyWritesOp('create', 'id.sifa.profile.honor', rkey, {
          ...data,
          createdAt: nowIso,
        }),
      );
    }

    for (const { data, rkey } of cleanLanguages) {
      writes.push(
        buildApplyWritesOp('create', 'id.sifa.profile.language', rkey, {
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
    // Wrapped in a transaction so deletes roll back if inserts fail.
    let dbWriteWarning: string | undefined;
    try {
      // Resolve identity fields: read from existing profile row, fall back to Bluesky
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

      if (!handle) {
        try {
          const publicAgent = new Agent('https://public.api.bsky.app');
          const bskyProfile = await publicAgent.getProfile({ actor: did });
          handle = bskyProfile.data.handle;
          displayName = bskyProfile.data.displayName ?? displayName;
          avatarUrl = bskyProfile.data.avatar ?? avatarUrl;
        } catch {
          app.log.warn({ did }, 'Failed to resolve handle from Bluesky during import');
        }
      }

      await db.transaction(async (tx) => {
        // Delete existing child records
        await tx.delete(positionsTable).where(eq(positionsTable.did, did));
        await tx.delete(educationTable).where(eq(educationTable.did, did));
        await tx.delete(skillsTable).where(eq(skillsTable.did, did));
        await tx.delete(certificationsTable).where(eq(certificationsTable.did, did));
        await tx.delete(projectsTable).where(eq(projectsTable.did, did));
        await tx.delete(volunteeringTable).where(eq(volunteeringTable.did, did));
        await tx.delete(publicationsTable).where(eq(publicationsTable.did, did));
        await tx.delete(coursesTable).where(eq(coursesTable.did, did));
        await tx.delete(honorsTable).where(eq(honorsTable.did, did));
        await tx.delete(languagesTable).where(eq(languagesTable.did, did));

        // Ensure profile row exists (FK target for child records)
        const profileValues = {
          did,
          handle,
          displayName,
          avatarUrl,
          headline: cleanProfile?.headline ?? null,
          about: cleanProfile?.about ?? null,
          industry: cleanProfile?.industry ?? null,
          locationCountry: normalizeLocation(cleanProfile?.location)?.country ?? null,
          locationRegion: normalizeLocation(cleanProfile?.location)?.region ?? null,
          locationCity: normalizeLocation(cleanProfile?.location)?.city ?? null,
          createdAt: now,
          indexedAt: now,
          updatedAt: now,
        };

        await tx
          .insert(profilesTable)
          .values(profileValues)
          .onConflictDoUpdate({
            target: profilesTable.did,
            set: {
              handle: handle || undefined,
              displayName,
              avatarUrl,
              ...(cleanProfile
                ? {
                    headline: cleanProfile.headline ?? null,
                    about: cleanProfile.about ?? null,
                    industry: cleanProfile.industry ?? null,
                    locationCountry: normalizeLocation(cleanProfile.location)?.country ?? null,
                    locationRegion: normalizeLocation(cleanProfile.location)?.region ?? null,
                    locationCity: normalizeLocation(cleanProfile.location)?.city ?? null,
                  }
                : {}),
              updatedAt: now,
            },
          });

        // Upsert child records (Jetstream may have already indexed them from the PDS write)
        for (const { data, rkey } of cleanPositions) {
          const loc = normalizeLocation(data.location);
          await tx
            .insert(positionsTable)
            .values({
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
            })
            .onConflictDoUpdate({
              target: [positionsTable.did, positionsTable.rkey],
              set: {
                companyName: data.companyName,
                title: data.title,
                description: data.description ?? null,
                locationCountry: loc?.country ?? null,
                locationRegion: loc?.region ?? null,
                locationCity: loc?.city ?? null,
                startDate: data.startDate ?? '',
                endDate: data.endDate ?? null,
                current: data.current ?? false,
                indexedAt: now,
              },
            });
        }

        for (const { data, rkey } of cleanEducation) {
          await tx
            .insert(educationTable)
            .values({
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
            })
            .onConflictDoUpdate({
              target: [educationTable.did, educationTable.rkey],
              set: {
                institution: data.institution,
                degree: data.degree ?? null,
                fieldOfStudy: data.fieldOfStudy ?? null,
                description: data.description ?? null,
                startDate: data.startDate ?? null,
                endDate: data.endDate ?? null,
                indexedAt: now,
              },
            });
        }

        for (const { data, rkey } of cleanSkills) {
          await tx
            .insert(skillsTable)
            .values({
              did,
              rkey,
              skillName: data.skillName,
              category: data.category ?? null,
              createdAt: now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [skillsTable.did, skillsTable.rkey],
              set: {
                skillName: data.skillName,
                category: data.category ?? null,
                indexedAt: now,
              },
            });
        }

        for (const { data, rkey } of cleanCertifications) {
          await tx
            .insert(certificationsTable)
            .values({
              did,
              rkey,
              name: data.name,
              authority: data.authority ?? null,
              credentialId: data.credentialId ?? null,
              credentialUrl: data.credentialUrl ?? null,
              issuedAt: data.issuedAt ?? null,
              expiresAt: data.expiresAt ?? null,
              createdAt: now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [certificationsTable.did, certificationsTable.rkey],
              set: {
                name: data.name,
                authority: data.authority ?? null,
                credentialId: data.credentialId ?? null,
                credentialUrl: data.credentialUrl ?? null,
                issuedAt: data.issuedAt ?? null,
                expiresAt: data.expiresAt ?? null,
                indexedAt: now,
              },
            });
        }

        for (const { data, rkey } of cleanProjects) {
          await tx
            .insert(projectsTable)
            .values({
              did,
              rkey,
              name: data.name,
              description: data.description ?? null,
              url: data.url ?? null,
              startedAt: data.startedAt ?? null,
              endedAt: data.endedAt ?? null,
              createdAt: now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [projectsTable.did, projectsTable.rkey],
              set: {
                name: data.name,
                description: data.description ?? null,
                url: data.url ?? null,
                startedAt: data.startedAt ?? null,
                endedAt: data.endedAt ?? null,
                indexedAt: now,
              },
            });
        }

        for (const { data, rkey } of cleanVolunteering) {
          await tx
            .insert(volunteeringTable)
            .values({
              did,
              rkey,
              organization: data.organization,
              role: data.role ?? null,
              cause: data.cause ?? null,
              description: data.description ?? null,
              startedAt: data.startedAt ?? null,
              endedAt: data.endedAt ?? null,
              createdAt: now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [volunteeringTable.did, volunteeringTable.rkey],
              set: {
                organization: data.organization,
                role: data.role ?? null,
                cause: data.cause ?? null,
                description: data.description ?? null,
                startedAt: data.startedAt ?? null,
                endedAt: data.endedAt ?? null,
                indexedAt: now,
              },
            });
        }

        for (const { data, rkey } of cleanPublications) {
          await tx
            .insert(publicationsTable)
            .values({
              did,
              rkey,
              title: data.title,
              publisher: data.publisher ?? null,
              url: data.url ?? null,
              description: data.description ?? null,
              publishedAt: data.publishedAt ?? null,
              createdAt: now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [publicationsTable.did, publicationsTable.rkey],
              set: {
                title: data.title,
                publisher: data.publisher ?? null,
                url: data.url ?? null,
                description: data.description ?? null,
                publishedAt: data.publishedAt ?? null,
                indexedAt: now,
              },
            });
        }

        for (const { data, rkey } of cleanCourses) {
          await tx
            .insert(coursesTable)
            .values({
              did,
              rkey,
              name: data.name,
              number: data.number ?? null,
              institution: data.institution ?? null,
              createdAt: now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [coursesTable.did, coursesTable.rkey],
              set: {
                name: data.name,
                number: data.number ?? null,
                institution: data.institution ?? null,
                indexedAt: now,
              },
            });
        }

        for (const { data, rkey } of cleanHonors) {
          await tx
            .insert(honorsTable)
            .values({
              did,
              rkey,
              title: data.title,
              issuer: data.issuer ?? null,
              description: data.description ?? null,
              awardedAt: data.awardedAt ?? null,
              createdAt: now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [honorsTable.did, honorsTable.rkey],
              set: {
                title: data.title,
                issuer: data.issuer ?? null,
                description: data.description ?? null,
                awardedAt: data.awardedAt ?? null,
                indexedAt: now,
              },
            });
        }

        for (const { data, rkey } of cleanLanguages) {
          await tx
            .insert(languagesTable)
            .values({
              did,
              rkey,
              name: data.name,
              proficiency: data.proficiency ?? null,
              createdAt: now,
              indexedAt: now,
            })
            .onConflictDoUpdate({
              target: [languagesTable.did, languagesTable.rkey],
              set: {
                name: data.name,
                proficiency: data.proficiency ?? null,
                indexedAt: now,
              },
            });
        }
      });
    } catch (err) {
      // Transaction rolled back — existing data preserved, PDS write already succeeded.
      const detail = err instanceof Error ? err.message : String(err);
      app.log.error(
        { err, did, detail },
        'Import DB write-through failed (transaction rolled back, PDS write succeeded)',
      );
      dbWriteWarning =
        'Your data was saved to your Personal Data Server but could not be cached locally. ' +
        'It will appear on your profile shortly via background sync.';
    }

    return reply.status(200).send({
      imported: {
        profile: profile ? 1 : 0,
        positions: positions.length,
        education: education.length,
        skills: skills.length,
        certifications: certifications.length,
        projects: projects.length,
        volunteering: volunteering.length,
        publications: publications.length,
        courses: courses.length,
        honors: honors.length,
        languages: languages.length,
      },
      ...(dbWriteWarning ? { warning: dbWriteWarning } : {}),
    });
  });
}
