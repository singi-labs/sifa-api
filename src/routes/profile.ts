import type { FastifyInstance } from 'fastify';
import { eq, and, count, sql } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { profiles, positions, education, skills, connections } from '../db/schema/index.js';
import { resolveSessionDid } from '../middleware/auth.js';

export async function getMutualFollowCount(db: Database, did: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS count FROM connections a
    JOIN connections b ON a.subject_did = b.follower_did AND a.follower_did = b.subject_did
    WHERE a.follower_did = ${did} AND a.source = 'sifa' AND b.source = 'sifa'
  `);
  return (result.rows[0] as { count: number } | undefined)?.count ?? 0;
}

export async function checkViewerRelationship(db: Database, viewerDid: string, profileDid: string) {
  const [viewerFollowsProfile, profileFollowsViewer] = await Promise.all([
    db.select({ value: count() }).from(connections).where(
      and(eq(connections.followerDid, viewerDid), eq(connections.subjectDid, profileDid), eq(connections.source, 'sifa')),
    ),
    db.select({ value: count() }).from(connections).where(
      and(eq(connections.followerDid, profileDid), eq(connections.subjectDid, viewerDid), eq(connections.source, 'sifa')),
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
      const condition = isDid
        ? eq(profiles.did, handleOrDid)
        : eq(profiles.handle, handleOrDid);

      const [profile] = await db.select().from(profiles).where(condition).limit(1);

      if (!profile) {
        return reply.status(404).send({ error: 'NotFound', message: 'Profile not found' });
      }

      const [profilePositions, profileEducation, profileSkills] = await Promise.all([
        db.select().from(positions).where(eq(positions.did, profile.did)),
        db.select().from(education).where(eq(education.did, profile.did)),
        db.select().from(skills).where(eq(skills.did, profile.did)),
      ]);

      const viewerDid = await resolveSessionDid(db, request.cookies?.session);

      const [followersResult, followingResult, connectionsCountResult, viewerRelationship] = await Promise.all([
        db
          .select({ value: count() })
          .from(connections)
          .where(and(eq(connections.subjectDid, profile.did), eq(connections.source, 'sifa'))),
        db
          .select({ value: count() })
          .from(connections)
          .where(and(eq(connections.followerDid, profile.did), eq(connections.source, 'sifa'))),
        getMutualFollowCount(db, profile.did),
        viewerDid && viewerDid !== profile.did
          ? checkViewerRelationship(db, viewerDid, profile.did)
          : Promise.resolve(undefined),
      ]);

      const followersCount = followersResult[0]?.value ?? 0;
      const followingCount = followingResult[0]?.value ?? 0;

      return reply.send({
        did: profile.did,
        handle: profile.handle,
        headline: profile.headline,
        about: profile.about,
        industry: profile.industry,
        locationCountry: profile.locationCountry,
        locationRegion: profile.locationRegion,
        locationCity: profile.locationCity,
        website: profile.website,
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
        followersCount,
        followingCount,
        connectionsCount: connectionsCountResult,
        ...(viewerRelationship ? { isFollowing: viewerRelationship.isFollowing, isConnection: viewerRelationship.isConnection } : {}),
      });
    },
  );
}
