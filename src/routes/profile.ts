import type { FastifyInstance } from 'fastify';
import { eq, and, count, sql } from 'drizzle-orm';
import { Agent } from '@atproto/api';
import type { Database } from '../db/index.js';
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
} from '../db/schema/index.js';
import { resolveSessionDid } from '../middleware/auth.js';
import { isVerifiablePlatform } from '../services/verification.js';
import { resolveProfileFields } from '../lib/resolve-profile.js';

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

export function registerProfileRoutes(app: FastifyInstance, db: Database) {
  app.get<{ Params: { handleOrDid: string } }>(
    '/api/profile/:handleOrDid',
    async (request, reply) => {
      const { handleOrDid } = request.params;

      const isDid = handleOrDid.startsWith('did:');
      const condition = isDid ? eq(profiles.did, handleOrDid) : eq(profiles.handle, handleOrDid);

      const [profile] = await db.select().from(profiles).where(condition).limit(1);

      if (!profile) {
        // Fall back to public Bluesky API for ATproto users without Sifa-specific data
        try {
          const publicAgent = new Agent('https://public.api.bsky.app');
          const bskyProfile = await publicAgent.getProfile(
            { actor: handleOrDid },
            { signal: AbortSignal.timeout(3000) },
          );
          const [inviteCountResult] = await db
            .select({ value: count() })
            .from(invites)
            .where(eq(invites.subjectDid, bskyProfile.data.did));

          return reply.send({
            did: bskyProfile.data.did,
            handle: bskyProfile.data.handle,
            displayName: bskyProfile.data.displayName,
            avatar: bskyProfile.data.avatar,
            headline: null,
            about: bskyProfile.data.description ?? null,
            hasHeadlineOverride: false,
            hasAboutOverride: false,
            source: {
              headline: null,
              about: bskyProfile.data.description ?? null,
            },
            industry: null,
            locationCountry: null,
            locationRegion: null,
            locationCity: null,
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
            inviteCount: inviteCountResult?.value ?? 0,
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
      ]);

      const resolved = resolveProfileFields(
        { headline: profile.headline, about: profile.about },
        { headline: profile.headlineOverride, about: profile.aboutOverride },
      );

      const viewerDid = await resolveSessionDid(db, request.cookies?.session);

      const [
        followersResult,
        followingResult,
        connectionsCountResult,
        inviteCountResult,
        viewerRelationship,
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
      ]);

      const followersCount = followersResult[0]?.value ?? 0;
      const followingCount = followingResult[0]?.value ?? 0;

      // Assemble location display string from parts
      const locationParts = [profile.locationCity, profile.locationRegion, profile.locationCountry].filter(Boolean);
      const location = locationParts.length > 0 ? locationParts.join(', ') : null;

      // Find primary external account for website fallback
      const [primaryAccount] = await db
        .select()
        .from(externalAccounts)
        .where(and(eq(externalAccounts.did, profile.did), eq(externalAccounts.isPrimary, true)))
        .limit(1);

      return reply.send({
        did: profile.did,
        handle: profile.handle,
        displayName: profile.displayName,
        avatar: profile.avatarUrl,
        headline: resolved.headline,
        about: resolved.about,
        hasHeadlineOverride: resolved.hasHeadlineOverride,
        hasAboutOverride: resolved.hasAboutOverride,
        source: {
          headline: profile.headline,
          about: profile.about,
        },
        industry: profile.industry,
        locationCountry: profile.locationCountry,
        locationRegion: profile.locationRegion,
        locationCity: profile.locationCity,
        location,
        website: primaryAccount?.url ?? profile.website ?? null,
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
          startDate: p.startDate,
          endDate: p.endDate,
          current: p.current,
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
        publications: profilePublications.map((p) => ({
          rkey: p.rkey,
          title: p.title,
          publisher: p.publisher,
          url: p.url,
          description: p.description,
          date: p.publishedAt,
        })),
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
        inviteCount: inviteCountResult[0]?.value ?? 0,
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
