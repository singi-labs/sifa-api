import type { FastifyInstance, FastifyBaseLogger } from 'fastify';
import { eq, and, count, sql } from 'drizzle-orm';
import { Agent } from '@atproto/api';
import type { Database } from '../db/index.js';
import type { ValkeyClient } from '../cache/index.js';

const publicBskyAgent = new Agent('https://public.api.bsky.app');
import {
  profiles,
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
  connections,
  externalAccounts,
  externalAccountVerifications,
  invites,
  skillPositionLinks,
} from '../db/schema/index.js';
import { resolveSessionDid } from '../middleware/auth.js';
import { isVerifiablePlatform } from '../services/verification.js';
import { resolveProfileFields } from '../lib/resolve-profile.js';
import { resolvePdsHost, mapPdsHostToProvider } from '../lib/pds-provider.js';
import { fetchStandardPublications, mergePublications } from '../services/standard-publications.js';
import {
  getVisibleAppStats,
  triggerRefreshIfStale,
  isDidSuppressed,
} from '../services/app-stats.js';
import { getAppsRegistry } from '../lib/atproto-app-registry.js';

export async function getMutualFollowCount(db: Database, did: string): Promise<number> {
  // Raw SQL required: Drizzle ORM doesn't support self-join aggregate subqueries for mutual follow counting
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS count FROM connections a
    JOIN connections b ON a.subject_did = b.follower_did AND a.follower_did = b.subject_did
    WHERE a.follower_did = ${did} AND a.source = 'sifa' AND b.source = 'sifa'
  `);
  return (result.rows[0] as { count: number } | undefined)?.count ?? 0;
}

export async function checkViewerRelationship(db: Database, viewerDid: string, profileDid: string) {
  const [viewerFollowsProfile, profileFollowsViewer] = await Promise.all([
    db
      .select({ value: count() })
      .from(connections)
      .where(
        and(
          eq(connections.followerDid, viewerDid),
          eq(connections.subjectDid, profileDid),
          eq(connections.source, 'sifa'),
        ),
      ),
    db
      .select({ value: count() })
      .from(connections)
      .where(
        and(
          eq(connections.followerDid, profileDid),
          eq(connections.subjectDid, viewerDid),
          eq(connections.source, 'sifa'),
        ),
      ),
  ]);

  const isFollowing = (viewerFollowsProfile[0]?.value ?? 0) > 0;
  const isMutual = isFollowing && (profileFollowsViewer[0]?.value ?? 0) > 0;

  return { isFollowing, isConnection: isMutual };
}

const BSKY_FOLLOWERS_TTL = 3600; // 1 hour
const BSKY_PRONOUNS_TTL = 86400; // 24 hours — pronouns change rarely

async function fetchPronouns(
  did: string,
  valkey: ValkeyClient | null,
  log: FastifyBaseLogger,
): Promise<string | null> {
  const cacheKey = `bsky:pronouns:${did}`;

  if (valkey) {
    try {
      const cached = await valkey.get(cacheKey);
      if (cached !== null) return cached || null;
    } catch (err) {
      log.warn({ err, cacheKey }, 'valkey.get failed for bsky pronouns; proceeding to origin');
    }
  }

  try {
    const res = await publicBskyAgent.com.atproto.repo.getRecord({
      repo: did,
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
    });
    const value = res.data.value as Record<string, unknown>;
    const pronouns = typeof value.pronouns === 'string' && value.pronouns ? value.pronouns : null;

    if (valkey) {
      try {
        await valkey.set(cacheKey, pronouns ?? '', 'EX', BSKY_PRONOUNS_TTL);
      } catch (err) {
        log.warn({ err, cacheKey }, 'valkey.set failed for bsky pronouns; result not cached');
      }
    }

    return pronouns;
  } catch (err) {
    log.warn({ err, did }, 'fetchPronouns: failed to fetch app.bsky.actor.profile');
    return null;
  }
}

async function fetchAtprotoFollowersCount(
  did: string,
  valkey: ValkeyClient | null,
  log: FastifyBaseLogger,
): Promise<number | null> {
  const cacheKey = `bsky:followers:${did}`;

  if (valkey) {
    try {
      const cached = await valkey.get(cacheKey);
      if (cached !== null) {
        const parsed = parseInt(cached, 10);
        if (!Number.isNaN(parsed)) return parsed;
      }
    } catch (err) {
      log.warn({ err, cacheKey }, 'valkey.get failed for bsky followers; proceeding to origin');
    }
  }

  try {
    const res = await publicBskyAgent.getProfile(
      { actor: did },
      { signal: AbortSignal.timeout(3000) },
    );
    const raw = res.data.followersCount;
    const followers = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;

    if (valkey) {
      try {
        await valkey.set(cacheKey, String(followers), 'EX', BSKY_FOLLOWERS_TTL);
      } catch (err) {
        log.warn({ err, cacheKey }, 'valkey.set failed for bsky followers; result not cached');
      }
    }

    return followers;
  } catch (err) {
    log.warn({ err, did }, 'fetchAtprotoFollowersCount: Bluesky API error');
    return null;
  }
}

export function registerProfileRoutes(
  app: FastifyInstance,
  db: Database,
  valkey: ValkeyClient | null = null,
) {
  app.get<{ Params: { handleOrDid: string } }>(
    '/api/profile/:handleOrDid',
    async (request, reply) => {
      const { handleOrDid } = request.params;

      const isDid = handleOrDid.startsWith('did:');
      // AT Protocol handles are domain names and therefore case-insensitive (RFC 1035)
      const normalized = isDid ? handleOrDid : handleOrDid.toLowerCase();
      const condition = isDid ? eq(profiles.did, normalized) : eq(profiles.handle, normalized);

      const [profile] = await db.select().from(profiles).where(condition).limit(1);

      if (!profile) {
        // Fall back to public Bluesky API for ATproto users without Sifa-specific data
        try {
          const bskyProfile = await publicBskyAgent.getProfile(
            { actor: handleOrDid },
            { signal: AbortSignal.timeout(3000) },
          );

          const raw = bskyProfile.data.followersCount;
          const bskyFollowers = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;

          // Cache the follower count for subsequent requests
          if (valkey && bskyFollowers > 0) {
            const cacheKey = `bsky:followers:${bskyProfile.data.did}`;
            try {
              await valkey.set(cacheKey, String(bskyFollowers), 'EX', BSKY_FOLLOWERS_TTL);
            } catch (err) {
              request.log.warn({ err }, 'valkey.set failed for unclaimed bsky followers');
            }
          }

          const [inviteCountResult, pdsHost, pronouns] = await Promise.all([
            db
              .select({ value: count() })
              .from(invites)
              .where(eq(invites.subjectDid, bskyProfile.data.did)),
            resolvePdsHost(bskyProfile.data.did),
            fetchPronouns(bskyProfile.data.did, valkey, request.log),
          ]);

          return reply.send({
            did: bskyProfile.data.did,
            handle: bskyProfile.data.handle,
            displayName: bskyProfile.data.displayName,
            avatar: bskyProfile.data.avatar,
            pronouns,
            headline: null,
            about: bskyProfile.data.description ?? null,
            hasHeadlineOverride: false,
            hasAboutOverride: false,
            hasDisplayNameOverride: false,
            hasAvatarUrlOverride: false,
            source: {
              headline: null,
              about: bskyProfile.data.description ?? null,
              displayName: bskyProfile.data.displayName ?? null,
              avatarUrl: bskyProfile.data.avatar ?? null,
            },
            industry: null,
            locationCountry: null,
            locationRegion: null,
            locationCity: null,
            countryCode: null,
            location: null,
            website: null,
            openTo: null,
            preferredWorkplace: null,
            langs: null,
            createdAt: bskyProfile.data.createdAt ?? new Date().toISOString(),
            positions: [],
            education: [],
            skills: [],
            certifications: [],
            projects: [],
            volunteering: [],
            publications: [],
            courses: [],
            honors: [],
            languages: [],
            externalAccounts: [],
            followersCount: 0,
            followingCount: 0,
            connectionsCount: 0,
            atprotoFollowersCount: bskyFollowers,
            activeApps: [],
            inviteCount: inviteCountResult[0]?.value ?? 0,
            pdsProvider: pdsHost ? mapPdsHostToProvider(pdsHost) : null,
            claimed: false,
          });
        } catch {
          return reply.status(404).send({ error: 'NotFound', message: 'Profile not found' });
        }
      }

      const [
        profilePositions,
        profileEducation,
        profileSkills,
        profileCertifications,
        profileProjects,
        profileVolunteering,
        profilePublications,
        profileCourses,
        profileHonors,
        profileLanguages,
        profileExternalAccounts,
        verifications,
        profileSkillPositionLinks,
      ] = await Promise.all([
        db.select().from(positions).where(eq(positions.did, profile.did)),
        db.select().from(education).where(eq(education.did, profile.did)),
        db.select().from(skills).where(eq(skills.did, profile.did)),
        db.select().from(certifications).where(eq(certifications.did, profile.did)),
        db.select().from(projects).where(eq(projects.did, profile.did)),
        db.select().from(volunteering).where(eq(volunteering.did, profile.did)),
        db.select().from(publications).where(eq(publications.did, profile.did)),
        db.select().from(courses).where(eq(courses.did, profile.did)),
        db.select().from(honors).where(eq(honors.did, profile.did)),
        db.select().from(languages).where(eq(languages.did, profile.did)),
        db.select().from(externalAccounts).where(eq(externalAccounts.did, profile.did)),
        db
          .select()
          .from(externalAccountVerifications)
          .where(eq(externalAccountVerifications.did, profile.did)),
        db.select().from(skillPositionLinks).where(eq(skillPositionLinks.did, profile.did)),
      ]);

      const resolved = resolveProfileFields(
        {
          headline: profile.headline,
          about: profile.about,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
        },
        {
          headline: profile.headlineOverride,
          about: profile.aboutOverride,
          displayName: profile.displayNameOverride,
          avatarUrl: profile.avatarUrlOverride,
        },
      );

      const viewerDid = await resolveSessionDid(db, request.cookies?.session);

      const [
        followersResult,
        followingResult,
        connectionsCountResult,
        inviteCountResult,
        viewerRelationship,
        resolvedPdsHost,
        atprotoFollowersCount,
        pronouns,
      ] = await Promise.all([
        db
          .select({ value: count() })
          .from(connections)
          .where(and(eq(connections.subjectDid, profile.did), eq(connections.source, 'sifa'))),
        db
          .select({ value: count() })
          .from(connections)
          .where(and(eq(connections.followerDid, profile.did), eq(connections.source, 'sifa'))),
        getMutualFollowCount(db, profile.did),
        db.select({ value: count() }).from(invites).where(eq(invites.subjectDid, profile.did)),
        viewerDid && viewerDid !== profile.did
          ? checkViewerRelationship(db, viewerDid, profile.did)
          : Promise.resolve(undefined),
        profile.pdsHost ? Promise.resolve(null) : resolvePdsHost(profile.did),
        fetchAtprotoFollowersCount(profile.did, valkey, request.log),
        fetchPronouns(profile.did, valkey, request.log),
      ]);

      const followersCount = followersResult[0]?.value ?? 0;
      const followingCount = followingResult[0]?.value ?? 0;

      // Fetch active apps (cross-app activity) in parallel
      const [suppressed, visibleStats] = await Promise.all([
        isDidSuppressed(db, profile.did),
        getVisibleAppStats(db, profile.did),
      ]);

      const registry = getAppsRegistry();
      const activeApps = suppressed
        ? []
        : visibleStats
            .filter((s) => s.isActive)
            .map((s) => {
              const registryEntry = registry.find((r) => r.id === s.appId);
              return {
                id: s.appId,
                name: registryEntry?.name ?? s.appId,
                category: registryEntry?.category ?? 'Other',
                recentCount: s.recentCount,
                latestRecordAt: s.latestRecordAt?.toISOString() ?? null,
              };
            });

      // Assemble location display string from parts
      const locationParts = [
        profile.locationCity,
        profile.locationRegion,
        profile.locationCountry,
      ].filter(Boolean);
      const location = locationParts.length > 0 ? locationParts.join(', ') : null;

      // Build skill-position link lookup maps
      const linksBySkill = new Map<string, string[]>();
      const linksByPosition = new Map<string, string[]>();
      for (const link of profileSkillPositionLinks) {
        const skillList = linksBySkill.get(link.skillRkey) ?? [];
        skillList.push(link.positionRkey);
        linksBySkill.set(link.skillRkey, skillList);

        const posList = linksByPosition.get(link.positionRkey) ?? [];
        posList.push(link.skillRkey);
        linksByPosition.set(link.positionRkey, posList);
      }

      // Use cached PDS host or the result resolved in parallel above
      const pdsHost = profile.pdsHost ?? resolvedPdsHost;
      if (!profile.pdsHost && pdsHost) {
        // Cache for future requests (fire-and-forget)
        void db
          .update(profiles)
          .set({ pdsHost })
          .where(eq(profiles.did, profile.did))
          .catch((err: unknown) => {
            request.log.warn({ err, did: profile.did }, 'Failed to cache pdsHost');
          });
      }

      // Trigger background PDS scan if data is stale (fire-and-forget)
      if (valkey && pdsHost) {
        triggerRefreshIfStale(db, valkey, profile.did, `https://${pdsHost}`);
      }

      // Fetch Standard publications from PDS and merge with Sifa publications
      const standardPublications = pdsHost
        ? await fetchStandardPublications(`https://${pdsHost}`, profile.did, valkey, request.log)
        : [];

      // Find primary external account for website display
      const [primaryAccount] = await db
        .select()
        .from(externalAccounts)
        .where(and(eq(externalAccounts.did, profile.did), eq(externalAccounts.isPrimary, true)))
        .limit(1);

      return reply.send({
        did: profile.did,
        handle: profile.handle,
        displayName: resolved.displayName,
        avatar: resolved.avatarUrl,
        pronouns,
        headline: resolved.headline,
        about: resolved.about,
        hasHeadlineOverride: resolved.hasHeadlineOverride,
        hasAboutOverride: resolved.hasAboutOverride,
        hasDisplayNameOverride: resolved.hasDisplayNameOverride,
        hasAvatarUrlOverride: resolved.hasAvatarUrlOverride,
        source: {
          headline: profile.headline,
          about: profile.about,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
        },
        industry: profile.industry,
        locationCountry: profile.locationCountry,
        locationRegion: profile.locationRegion,
        locationCity: profile.locationCity,
        countryCode: profile.countryCode,
        location,
        website: primaryAccount?.url ?? null,
        openTo: profile.openTo,
        preferredWorkplace: profile.preferredWorkplace,
        langs: profile.langs,
        createdAt: profile.createdAt.toISOString(),
        positions: profilePositions.map((p) => ({
          rkey: p.rkey,
          companyName: p.companyName,
          companyDid: p.companyDid,
          title: p.title,
          description: p.description,
          employmentType: p.employmentType,
          workplaceType: p.workplaceType,
          locationCountry: p.locationCountry,
          locationRegion: p.locationRegion,
          locationCity: p.locationCity,
          countryCode: p.countryCode,
          startDate: p.startDate,
          endDate: p.endDate,
          current: p.current,
          skillRkeys: linksByPosition.get(p.rkey) ?? [],
        })),
        education: profileEducation.map((e) => ({
          rkey: e.rkey,
          institution: e.institution,
          institutionDid: e.institutionDid,
          degree: e.degree,
          fieldOfStudy: e.fieldOfStudy,
          description: e.description,
          startDate: e.startDate,
          endDate: e.endDate,
        })),
        skills: profileSkills.map((s) => ({
          rkey: s.rkey,
          skillName: s.skillName,
          category: s.category,
          positionRkeys: linksBySkill.get(s.rkey) ?? [],
        })),
        certifications: profileCertifications.map((c) => ({
          rkey: c.rkey,
          name: c.name,
          issuingOrg: c.authority,
          issueDate: c.issuedAt,
          expiryDate: c.expiresAt,
          credentialUrl: c.credentialUrl,
        })),
        projects: profileProjects.map((p) => ({
          rkey: p.rkey,
          name: p.name,
          description: p.description,
          url: p.url,
          startDate: p.startedAt,
          endDate: p.endedAt,
        })),
        volunteering: profileVolunteering.map((v) => ({
          rkey: v.rkey,
          organization: v.organization,
          role: v.role,
          cause: v.cause,
          description: v.description,
          startDate: v.startedAt,
          endDate: v.endedAt,
        })),
        publications: mergePublications(
          profilePublications.map((p) => ({
            rkey: p.rkey,
            title: p.title,
            publisher: p.publisher,
            url: p.url,
            description: p.description,
            date: p.publishedAt,
          })),
          standardPublications,
        ),
        courses: profileCourses.map((c) => ({
          rkey: c.rkey,
          name: c.name,
          number: c.number,
          institution: c.institution,
        })),
        honors: profileHonors.map((h) => ({
          rkey: h.rkey,
          title: h.title,
          issuer: h.issuer,
          description: h.description,
          date: h.awardedAt,
        })),
        languages: profileLanguages.map((l) => ({
          rkey: l.rkey,
          language: l.name,
          proficiency: l.proficiency,
        })),
        externalAccounts: (() => {
          const verificationMap = new Map(
            verifications.map((v) => [v.url, { verified: v.verified, verifiedVia: v.verifiedVia }]),
          );
          return profileExternalAccounts.map((acc) => {
            const v = verificationMap.get(acc.url);
            return {
              rkey: acc.rkey,
              platform: acc.platform,
              url: acc.url,
              label: acc.label,
              feedUrl: acc.feedUrl,
              primary: acc.isPrimary,
              verifiable: isVerifiablePlatform(acc.platform),
              verified: v?.verified ?? false,
              verifiedVia: v?.verifiedVia ?? null,
            };
          });
        })(),
        followersCount,
        followingCount,
        connectionsCount: connectionsCountResult,
        activeApps,
        atprotoFollowersCount: atprotoFollowersCount ?? 0,
        inviteCount: inviteCountResult[0]?.value ?? 0,
        pdsProvider: pdsHost ? mapPdsHostToProvider(pdsHost) : null,
        claimed: true,
        isOwnProfile: viewerDid === profile.did,
        ...(viewerRelationship
          ? {
              isFollowing: viewerRelationship.isFollowing,
              isConnection: viewerRelationship.isConnection,
            }
          : {}),
      });
    },
  );
}
