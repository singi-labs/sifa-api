import type { Database } from '../db/index.js';
import {
  skills,
  positions,
  education,
  certifications,
  projects,
  volunteering,
  publications,
  courses,
  honors,
  languages,
  externalAccounts,
  canonicalSkills,
  skillPositionLinks,
} from '../db/schema/index.js';
import { and, eq, sql } from 'drizzle-orm';
import { sanitize, sanitizeOptional } from '../lib/sanitize.js';
import { resolveSkill } from './skill-normalization.js';
import { logger } from '../logger.js';

// --- Skill ---

export async function indexSkill(
  db: Database,
  did: string,
  rkey: string,
  record: Record<string, unknown>,
): Promise<void> {
  const skillName = sanitize(record.skillName as string);
  const category = sanitizeOptional(record.category as string | undefined) ?? null;

  const canonical = await resolveSkill(db, skillName);
  const canonicalSkillId = canonical?.id ?? null;

  const existing = await db
    .select({ canonicalSkillId: skills.canonicalSkillId })
    .from(skills)
    .where(and(eq(skills.did, did), eq(skills.rkey, rkey)))
    .limit(1);

  const previousCanonicalId = existing[0]?.canonicalSkillId ?? null;

  await db
    .insert(skills)
    .values({
      did,
      rkey,
      skillName,
      category,
      canonicalSkillId,
      createdAt: new Date(record.createdAt as string),
      indexedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [skills.did, skills.rkey],
      set: {
        skillName,
        category,
        canonicalSkillId,
        indexedAt: new Date(),
      },
    });

  if (previousCanonicalId && previousCanonicalId !== canonicalSkillId) {
    await db
      .update(canonicalSkills)
      .set({ userCount: sql`GREATEST(${canonicalSkills.userCount} - 1, 0)` })
      .where(eq(canonicalSkills.id, previousCanonicalId));
  }
  if (canonicalSkillId && canonicalSkillId !== previousCanonicalId) {
    await db
      .update(canonicalSkills)
      .set({ userCount: sql`${canonicalSkills.userCount} + 1` })
      .where(eq(canonicalSkills.id, canonicalSkillId));
  }

  logger.info({ did, rkey, canonicalSkillId }, 'Indexed skill (write-through)');
}

export async function deleteSkill(db: Database, did: string, rkey: string): Promise<void> {
  const existing = await db
    .select({ canonicalSkillId: skills.canonicalSkillId })
    .from(skills)
    .where(and(eq(skills.did, did), eq(skills.rkey, rkey)))
    .limit(1);

  await db.delete(skills).where(and(eq(skills.did, did), eq(skills.rkey, rkey)));

  if (existing[0]?.canonicalSkillId) {
    await db
      .update(canonicalSkills)
      .set({ userCount: sql`GREATEST(${canonicalSkills.userCount} - 1, 0)` })
      .where(eq(canonicalSkills.id, existing[0].canonicalSkillId));
  }

  logger.info({ did, rkey }, 'Deleted skill (write-through)');
}

// --- Position ---

function parseRkeyFromUri(uri: string): string | null {
  const parts = uri.split('/');
  return parts.length >= 5 ? (parts[4] ?? null) : null;
}

interface StrongRef {
  uri: string;
  cid: string;
}

interface RecordLocation {
  country?: string;
  region?: string;
  city?: string;
  countryCode?: string;
}

export async function indexPosition(
  db: Database,
  did: string,
  rkey: string,
  record: Record<string, unknown>,
): Promise<void> {
  const location = record.location as RecordLocation | undefined;

  await db
    .insert(positions)
    .values({
      did,
      rkey,
      companyName: sanitize(record.companyName as string),
      companyDid: (record.companyDid as string) ?? null,
      title: sanitize(record.title as string),
      description: sanitizeOptional(record.description as string | undefined) ?? null,
      employmentType: (record.employmentType as string) ?? null,
      workplaceType: (record.workplaceType as string) ?? null,
      locationCountry: sanitizeOptional(location?.country) ?? null,
      locationRegion: sanitizeOptional(location?.region) ?? null,
      locationCity: sanitizeOptional(location?.city) ?? null,
      countryCode: sanitizeOptional(location?.countryCode) ?? null,
      startDate: record.startDate as string,
      endDate: (record.endDate as string) ?? null,
      current: (record.current as boolean) ?? false,
      createdAt: new Date(record.createdAt as string),
      indexedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [positions.did, positions.rkey],
      set: {
        companyName: sanitize(record.companyName as string),
        companyDid: (record.companyDid as string) ?? null,
        title: sanitize(record.title as string),
        description: sanitizeOptional(record.description as string | undefined) ?? null,
        employmentType: (record.employmentType as string) ?? null,
        workplaceType: (record.workplaceType as string) ?? null,
        locationCountry: sanitizeOptional(location?.country) ?? null,
        locationRegion: sanitizeOptional(location?.region) ?? null,
        locationCity: sanitizeOptional(location?.city) ?? null,
        countryCode: sanitizeOptional(location?.countryCode) ?? null,
        startDate: record.startDate as string,
        endDate: (record.endDate as string) ?? null,
        current: (record.current as boolean) ?? false,
        indexedAt: new Date(),
      },
    });

  // Sync skill-position links: delete-and-replace
  await db
    .delete(skillPositionLinks)
    .where(and(eq(skillPositionLinks.did, did), eq(skillPositionLinks.positionRkey, rkey)));

  const skillRefs = record.skills as StrongRef[] | undefined;
  if (skillRefs && Array.isArray(skillRefs) && skillRefs.length > 0) {
    const linkValues = skillRefs
      .map((ref) => {
        const skillRkey = parseRkeyFromUri(ref.uri);
        if (!skillRkey) {
          logger.warn({ did, rkey, uri: ref.uri }, 'Could not parse skill rkey from strongRef URI');
          return null;
        }
        return { did, positionRkey: rkey, skillRkey };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (linkValues.length > 0) {
      await db.insert(skillPositionLinks).values(linkValues).onConflictDoNothing();
    }
  }

  logger.info({ did, rkey, skillLinks: skillRefs?.length ?? 0 }, 'Indexed position (write-through)');
}

export async function deletePosition(db: Database, did: string, rkey: string): Promise<void> {
  await db
    .delete(skillPositionLinks)
    .where(and(eq(skillPositionLinks.did, did), eq(skillPositionLinks.positionRkey, rkey)));
  await db.delete(positions).where(and(eq(positions.did, did), eq(positions.rkey, rkey)));
  logger.info({ did, rkey }, 'Deleted position (write-through)');
}

// --- Education ---

export async function indexEducation(
  db: Database,
  did: string,
  rkey: string,
  record: Record<string, unknown>,
): Promise<void> {
  await db
    .insert(education)
    .values({
      did,
      rkey,
      institution: sanitize(record.institution as string),
      institutionDid: (record.institutionDid as string) ?? null,
      degree: sanitizeOptional(record.degree as string | undefined) ?? null,
      fieldOfStudy: sanitizeOptional(record.fieldOfStudy as string | undefined) ?? null,
      description: sanitizeOptional(record.description as string | undefined) ?? null,
      startDate: (record.startDate as string) ?? null,
      endDate: (record.endDate as string) ?? null,
      createdAt: new Date(record.createdAt as string),
      indexedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [education.did, education.rkey],
      set: {
        institution: sanitize(record.institution as string),
        institutionDid: (record.institutionDid as string) ?? null,
        degree: sanitizeOptional(record.degree as string | undefined) ?? null,
        fieldOfStudy: sanitizeOptional(record.fieldOfStudy as string | undefined) ?? null,
        description: sanitizeOptional(record.description as string | undefined) ?? null,
        startDate: (record.startDate as string) ?? null,
        endDate: (record.endDate as string) ?? null,
        indexedAt: new Date(),
      },
    });

  logger.info({ did, rkey }, 'Indexed education (write-through)');
}

export async function deleteEducation(db: Database, did: string, rkey: string): Promise<void> {
  await db.delete(education).where(and(eq(education.did, did), eq(education.rkey, rkey)));
  logger.info({ did, rkey }, 'Deleted education (write-through)');
}

// --- Generic record indexer for remaining collections ---

const COLLECTION_INDEXERS: Record<
  string,
  {
    table: typeof certifications | typeof projects | typeof volunteering | typeof publications | typeof courses | typeof honors | typeof languages | typeof externalAccounts;
    fields: (record: Record<string, unknown>) => Record<string, unknown>;
  }
> = {
  'id.sifa.profile.certification': {
    table: certifications,
    fields: (r) => ({
      name: sanitize(r.name as string),
      authority: sanitizeOptional(r.authority as string | undefined) ?? null,
      credentialId: (r.credentialId as string) ?? null,
      credentialUrl: (r.credentialUrl as string) ?? null,
      issuedAt: (r.issuedAt as string) ?? null,
      expiresAt: (r.expiresAt as string) ?? null,
    }),
  },
  'id.sifa.profile.project': {
    table: projects,
    fields: (r) => ({
      name: sanitize(r.name as string),
      description: sanitizeOptional(r.description as string | undefined) ?? null,
      url: (r.url as string) ?? null,
      startedAt: (r.startedAt as string) ?? null,
      endedAt: (r.endedAt as string) ?? null,
    }),
  },
  'id.sifa.profile.volunteering': {
    table: volunteering,
    fields: (r) => ({
      organization: sanitize(r.organization as string),
      role: sanitizeOptional(r.role as string | undefined) ?? null,
      cause: sanitizeOptional(r.cause as string | undefined) ?? null,
      description: sanitizeOptional(r.description as string | undefined) ?? null,
      startedAt: (r.startedAt as string) ?? null,
      endedAt: (r.endedAt as string) ?? null,
    }),
  },
  'id.sifa.profile.publication': {
    table: publications,
    fields: (r) => ({
      title: sanitize(r.title as string),
      publisher: sanitizeOptional(r.publisher as string | undefined) ?? null,
      url: (r.url as string) ?? null,
      description: sanitizeOptional(r.description as string | undefined) ?? null,
      publishedAt: (r.publishedAt as string) ?? null,
    }),
  },
  'id.sifa.profile.course': {
    table: courses,
    fields: (r) => ({
      name: sanitize(r.name as string),
      number: sanitizeOptional(r.number as string | undefined) ?? null,
      institution: sanitizeOptional(r.institution as string | undefined) ?? null,
    }),
  },
  'id.sifa.profile.honor': {
    table: honors,
    fields: (r) => ({
      title: sanitize(r.title as string),
      issuer: sanitizeOptional(r.issuer as string | undefined) ?? null,
      description: sanitizeOptional(r.description as string | undefined) ?? null,
      awardedAt: (r.awardedAt as string) ?? null,
    }),
  },
  'id.sifa.profile.language': {
    table: languages,
    fields: (r) => ({
      name: sanitize(r.name as string),
      proficiency: (r.proficiency as string) ?? null,
    }),
  },
  'id.sifa.profile.externalAccount': {
    table: externalAccounts,
    fields: (r) => ({
      platform: sanitize(r.platform as string),
      url: sanitize(r.url as string),
      label: sanitizeOptional(r.label as string | undefined) ?? null,
      feedUrl: sanitizeOptional(r.feedUrl as string | undefined) ?? null,
      isPrimary: (r.isPrimary as boolean) ?? false,
    }),
  },
};

export async function indexRecord(
  db: Database,
  collection: string,
  did: string,
  rkey: string,
  record: Record<string, unknown>,
): Promise<void> {
  const config = COLLECTION_INDEXERS[collection];
  if (!config) {
    logger.warn({ collection }, 'No indexer config for collection');
    return;
  }

  const fields = config.fields(record);
  const table = config.table as typeof certifications; // all have same (did, rkey) conflict target shape

  await db
    .insert(table)
    .values({
      did,
      rkey,
      ...fields,
      createdAt: new Date(record.createdAt as string),
      indexedAt: new Date(),
    } as typeof table.$inferInsert)
    .onConflictDoUpdate({
      target: [table.did, table.rkey],
      set: {
        ...fields,
        indexedAt: new Date(),
      } as Partial<typeof table.$inferInsert>,
    });

  logger.info({ did, rkey, collection }, 'Indexed record (write-through)');
}

export async function deleteRecord(
  db: Database,
  collection: string,
  did: string,
  rkey: string,
): Promise<void> {
  const config = COLLECTION_INDEXERS[collection];
  if (!config) {
    logger.warn({ collection }, 'No indexer config for collection');
    return;
  }

  const table = config.table as typeof certifications;
  await db.delete(table).where(and(eq(table.did, did), eq(table.rkey, rkey)));
  logger.info({ did, rkey, collection }, 'Deleted record (write-through)');
}
