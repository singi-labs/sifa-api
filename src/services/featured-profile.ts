import { sql } from 'drizzle-orm';

import type { Database } from '../db/index.js';
import { profiles } from '../db/schema/profiles.js';

export interface EligibleProfile {
  did: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Returns today's date as YYYY-MM-DD in UTC.
 */
export function getTodayUtc(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

/**
 * Selects a single random eligible profile that has not been previously featured.
 *
 * Eligibility criteria (all must be met):
 * 1. Has avatar (not null, not empty)
 * 2. Has headline or headline_override (not null, not empty)
 * 3. Has about or about_override (not null, not empty)
 * 4. Has at least 1 current position
 * 5. Has at least 1 past position
 * 6. Has 3+ skills
 * 7. Has at least 1 education entry
 * 8. Has at least 1 external account
 *
 * Exclusions:
 * - Handle 'gui.do' is excluded
 * - Any DID already in featured_profiles is excluded
 */
export async function selectFeaturedProfile(db: Database): Promise<EligibleProfile | null> {
  const result = await db
    .select({
      did: profiles.did,
      handle: profiles.handle,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(profiles)
    .where(
      sql`
        ${profiles.avatarUrl} IS NOT NULL AND ${profiles.avatarUrl} != ''
        AND (
          (${profiles.headline} IS NOT NULL AND ${profiles.headline} != '')
          OR (${profiles.headlineOverride} IS NOT NULL AND ${profiles.headlineOverride} != '')
        )
        AND (
          (${profiles.about} IS NOT NULL AND ${profiles.about} != '')
          OR (${profiles.aboutOverride} IS NOT NULL AND ${profiles.aboutOverride} != '')
        )
        AND ${profiles.handle} != 'gui.do'
        AND ${profiles.did} NOT IN (SELECT did FROM featured_profiles)
        AND (SELECT count(*) FROM positions WHERE positions.did = ${profiles.did} AND positions.current = true) >= 1
        AND (SELECT count(*) FROM positions WHERE positions.did = ${profiles.did} AND positions.current = false) >= 1
        AND (SELECT count(*) FROM skills WHERE skills.did = ${profiles.did}) >= 3
        AND (SELECT count(*) FROM education WHERE education.did = ${profiles.did}) >= 1
        AND (SELECT count(*) FROM external_accounts WHERE external_accounts.did = ${profiles.did}) >= 1
      `,
    )
    .orderBy(sql`random()`)
    .limit(1);

  return result[0] ?? null;
}
