import type { FastifyInstance } from 'fastify';
import { eq, and, count } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { profiles, positions, education, skills, connections } from '../db/schema/index.js';

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

      const [followersResult, followingResult] = await Promise.all([
        db
          .select({ value: count() })
          .from(connections)
          .where(and(eq(connections.subjectDid, profile.did), eq(connections.source, 'sifa'))),
        db
          .select({ value: count() })
          .from(connections)
          .where(and(eq(connections.followerDid, profile.did), eq(connections.source, 'sifa'))),
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
        connectionsCount: 0, // Placeholder for mutual sifa follows
      });
    },
  );
}
