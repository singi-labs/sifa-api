import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createDb } from '../../src/db/index.js';
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
  canonicalSkills,
  profiles,
  skillPositionLinks,
} from '../../src/db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';

// These functions don't exist yet -- this test will fail (RED)
import {
  indexSkill,
  deleteSkill,
  indexPosition,
  deletePosition,
  indexEducation,
  deleteEducation,
  indexRecord,
  deleteRecord,
} from '../../src/services/record-indexer.js';

describe('Record indexer service', () => {
  const db = createDb(process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa');
  const testDid = 'did:plc:write-through-test';

  beforeAll(async () => {
    await db
      .insert(profiles)
      .values({
        did: testDid,
        handle: 'write-through-test.bsky.social',
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(canonicalSkills)
      .values({
        canonicalName: 'JavaScript',
        slug: 'javascript',
        category: 'technical',
        aliases: ['js', 'javascript', 'ecmascript'],
        userCount: 0,
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(skillPositionLinks).where(eq(skillPositionLinks.did, testDid));
    await db.delete(skills).where(eq(skills.did, testDid));
    await db.delete(positions).where(eq(positions.did, testDid));
    await db.delete(education).where(eq(education.did, testDid));
    await db.delete(certifications).where(eq(certifications.did, testDid));
    await db.delete(projects).where(eq(projects.did, testDid));
    await db.delete(volunteering).where(eq(volunteering.did, testDid));
    await db.delete(publications).where(eq(publications.did, testDid));
    await db.delete(courses).where(eq(courses.did, testDid));
    await db.delete(honors).where(eq(honors.did, testDid));
    await db.delete(languages).where(eq(languages.did, testDid));
    await db.execute(
      sql`DELETE FROM canonical_skills WHERE slug = 'javascript' AND canonical_name = 'JavaScript'`,
    );
    await db.execute(sql`DELETE FROM profiles WHERE did = ${testDid}`);
    await db.$client.end();
  });

  // --- Skill indexing ---

  describe('indexSkill', () => {
    afterEach(async () => {
      await db.delete(skills).where(eq(skills.did, testDid));
    });

    it('creates a skill record in local DB', async () => {
      await indexSkill(db, testDid, '3wt-skill-1', {
        skillName: 'TypeScript',
        category: 'technical',
        createdAt: '2026-03-16T00:00:00Z',
      });

      const rows = await db
        .select()
        .from(skills)
        .where(and(eq(skills.did, testDid), eq(skills.rkey, '3wt-skill-1')));
      expect(rows).toHaveLength(1);
      expect(rows[0].skillName).toBe('TypeScript');
      expect(rows[0].category).toBe('technical');
    });

    it('resolves canonical skill when alias matches', async () => {
      await indexSkill(db, testDid, '3wt-skill-2', {
        skillName: 'JS',
        category: 'technical',
        createdAt: '2026-03-16T00:00:00Z',
      });

      const rows = await db
        .select()
        .from(skills)
        .where(and(eq(skills.did, testDid), eq(skills.rkey, '3wt-skill-2')));
      expect(rows).toHaveLength(1);
      expect(rows[0].canonicalSkillId).not.toBeNull();
    });

    it('is idempotent -- second call updates, does not duplicate', async () => {
      await indexSkill(db, testDid, '3wt-skill-3', {
        skillName: 'React',
        category: 'technical',
        createdAt: '2026-03-16T00:00:00Z',
      });
      await indexSkill(db, testDid, '3wt-skill-3', {
        skillName: 'React',
        category: 'technical',
        createdAt: '2026-03-16T00:00:00Z',
      });

      const rows = await db
        .select()
        .from(skills)
        .where(and(eq(skills.did, testDid), eq(skills.rkey, '3wt-skill-3')));
      expect(rows).toHaveLength(1);
    });
  });

  describe('deleteSkill', () => {
    it('removes a skill record from local DB', async () => {
      await indexSkill(db, testDid, '3wt-skill-del', {
        skillName: 'Python',
        createdAt: '2026-03-16T00:00:00Z',
      });

      await deleteSkill(db, testDid, '3wt-skill-del');

      const rows = await db
        .select()
        .from(skills)
        .where(and(eq(skills.did, testDid), eq(skills.rkey, '3wt-skill-del')));
      expect(rows).toHaveLength(0);
    });

    it('is idempotent -- deleting non-existent record does not throw', async () => {
      await expect(deleteSkill(db, testDid, '3wt-nonexistent')).resolves.not.toThrow();
    });
  });

  // --- Position indexing ---

  describe('indexPosition', () => {
    afterEach(async () => {
      await db.delete(skillPositionLinks).where(eq(skillPositionLinks.did, testDid));
      await db.delete(positions).where(eq(positions.did, testDid));
    });

    it('creates a position record in local DB', async () => {
      await indexPosition(db, testDid, '3wt-pos-1', {
        companyName: 'Acme Corp',
        title: 'Senior Engineer',
        startDate: '2024-01',
        current: true,
        createdAt: '2026-03-16T00:00:00Z',
      });

      const rows = await db
        .select()
        .from(positions)
        .where(and(eq(positions.did, testDid), eq(positions.rkey, '3wt-pos-1')));
      expect(rows).toHaveLength(1);
      expect(rows[0].companyName).toBe('Acme Corp');
      expect(rows[0].title).toBe('Senior Engineer');
      expect(rows[0].current).toBe(true);
    });

    it('syncs skill-position links', async () => {
      // First create the skill
      await indexSkill(db, testDid, '3wt-link-skill', {
        skillName: 'Go',
        createdAt: '2026-03-16T00:00:00Z',
      });

      await indexPosition(db, testDid, '3wt-pos-link', {
        companyName: 'GoLand',
        title: 'Go Dev',
        startDate: '2024-01',
        current: false,
        skills: [{ uri: `at://${testDid}/id.sifa.profile.skill/3wt-link-skill`, cid: 'bafyfake' }],
        createdAt: '2026-03-16T00:00:00Z',
      });

      const links = await db
        .select()
        .from(skillPositionLinks)
        .where(
          and(
            eq(skillPositionLinks.did, testDid),
            eq(skillPositionLinks.positionRkey, '3wt-pos-link'),
          ),
        );
      expect(links).toHaveLength(1);
      expect(links[0].skillRkey).toBe('3wt-link-skill');
    });

    it('is idempotent', async () => {
      const record = {
        companyName: 'Dupe Corp',
        title: 'Eng',
        startDate: '2024-01',
        current: false,
        createdAt: '2026-03-16T00:00:00Z',
      };
      await indexPosition(db, testDid, '3wt-pos-idem', record);
      await indexPosition(db, testDid, '3wt-pos-idem', record);

      const rows = await db
        .select()
        .from(positions)
        .where(and(eq(positions.did, testDid), eq(positions.rkey, '3wt-pos-idem')));
      expect(rows).toHaveLength(1);
    });
  });

  describe('deletePosition', () => {
    it('removes position and its skill links', async () => {
      await indexPosition(db, testDid, '3wt-pos-del', {
        companyName: 'Del Corp',
        title: 'Eng',
        startDate: '2024-01',
        current: false,
        createdAt: '2026-03-16T00:00:00Z',
      });

      await deletePosition(db, testDid, '3wt-pos-del');

      const rows = await db
        .select()
        .from(positions)
        .where(and(eq(positions.did, testDid), eq(positions.rkey, '3wt-pos-del')));
      expect(rows).toHaveLength(0);
    });
  });

  // --- Education indexing ---

  describe('indexEducation', () => {
    afterEach(async () => {
      await db.delete(education).where(eq(education.did, testDid));
    });

    it('creates an education record in local DB', async () => {
      await indexEducation(db, testDid, '3wt-edu-1', {
        institution: 'MIT',
        degree: 'MSc',
        fieldOfStudy: 'Computer Science',
        startDate: '2020-09',
        endDate: '2022-06',
        createdAt: '2026-03-16T00:00:00Z',
      });

      const rows = await db
        .select()
        .from(education)
        .where(and(eq(education.did, testDid), eq(education.rkey, '3wt-edu-1')));
      expect(rows).toHaveLength(1);
      expect(rows[0].institution).toBe('MIT');
      expect(rows[0].degree).toBe('MSc');
    });
  });

  describe('deleteEducation', () => {
    it('removes an education record', async () => {
      await indexEducation(db, testDid, '3wt-edu-del', {
        institution: 'Oxford',
        createdAt: '2026-03-16T00:00:00Z',
      });
      await deleteEducation(db, testDid, '3wt-edu-del');

      const rows = await db
        .select()
        .from(education)
        .where(and(eq(education.did, testDid), eq(education.rkey, '3wt-edu-del')));
      expect(rows).toHaveLength(0);
    });
  });

  // --- Generic indexRecord for remaining collections ---

  describe('indexRecord (generic)', () => {
    it('creates a certification record', async () => {
      await indexRecord(db, 'id.sifa.profile.certification', testDid, '3wt-cert-1', {
        name: 'AWS Solutions Architect',
        authority: 'Amazon',
        createdAt: '2026-03-16T00:00:00Z',
      });

      const rows = await db
        .select()
        .from(certifications)
        .where(and(eq(certifications.did, testDid), eq(certifications.rkey, '3wt-cert-1')));
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('AWS Solutions Architect');
    });

    it('creates a project record', async () => {
      await indexRecord(db, 'id.sifa.profile.project', testDid, '3wt-proj-1', {
        name: 'Open Source Tool',
        url: 'https://example.com',
        createdAt: '2026-03-16T00:00:00Z',
      });

      const rows = await db
        .select()
        .from(projects)
        .where(and(eq(projects.did, testDid), eq(projects.rkey, '3wt-proj-1')));
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Open Source Tool');
    });

    it('creates a course record', async () => {
      await indexRecord(db, 'id.sifa.profile.course', testDid, '3wt-course-1', {
        name: 'Distributed Systems',
        institution: 'MIT OCW',
        createdAt: '2026-03-16T00:00:00Z',
      });

      const rows = await db
        .select()
        .from(courses)
        .where(and(eq(courses.did, testDid), eq(courses.rkey, '3wt-course-1')));
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Distributed Systems');
    });

    it('creates a volunteering record', async () => {
      await indexRecord(db, 'id.sifa.profile.volunteering', testDid, '3wt-vol-1', {
        organization: 'Code for All',
        role: 'Mentor',
        createdAt: '2026-03-16T00:00:00Z',
      });

      const rows = await db
        .select()
        .from(volunteering)
        .where(and(eq(volunteering.did, testDid), eq(volunteering.rkey, '3wt-vol-1')));
      expect(rows).toHaveLength(1);
      expect(rows[0].organization).toBe('Code for All');
    });

    it('creates a publication record', async () => {
      await indexRecord(db, 'id.sifa.profile.publication', testDid, '3wt-pub-1', {
        title: 'My Paper',
        publisher: 'IEEE',
        createdAt: '2026-03-16T00:00:00Z',
      });

      const rows = await db
        .select()
        .from(publications)
        .where(and(eq(publications.did, testDid), eq(publications.rkey, '3wt-pub-1')));
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe('My Paper');
    });

    it('creates an honor record', async () => {
      await indexRecord(db, 'id.sifa.profile.honor', testDid, '3wt-honor-1', {
        title: 'Best Paper Award',
        issuer: 'ACM',
        createdAt: '2026-03-16T00:00:00Z',
      });

      const rows = await db
        .select()
        .from(honors)
        .where(and(eq(honors.did, testDid), eq(honors.rkey, '3wt-honor-1')));
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe('Best Paper Award');
    });

    it('creates a language record', async () => {
      await indexRecord(db, 'id.sifa.profile.language', testDid, '3wt-lang-1', {
        name: 'Dutch',
        proficiency: 'native',
        createdAt: '2026-03-16T00:00:00Z',
      });

      const rows = await db
        .select()
        .from(languages)
        .where(and(eq(languages.did, testDid), eq(languages.rkey, '3wt-lang-1')));
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Dutch');
    });

    it('is idempotent for generic records', async () => {
      const record = { name: 'Idempotent Cert', createdAt: '2026-03-16T00:00:00Z' };
      await indexRecord(db, 'id.sifa.profile.certification', testDid, '3wt-cert-idem', record);
      await indexRecord(db, 'id.sifa.profile.certification', testDid, '3wt-cert-idem', record);

      const rows = await db
        .select()
        .from(certifications)
        .where(and(eq(certifications.did, testDid), eq(certifications.rkey, '3wt-cert-idem')));
      expect(rows).toHaveLength(1);
    });
  });

  describe('deleteRecord (generic)', () => {
    it('deletes a certification record', async () => {
      await indexRecord(db, 'id.sifa.profile.certification', testDid, '3wt-cert-del', {
        name: 'To Delete',
        createdAt: '2026-03-16T00:00:00Z',
      });
      await deleteRecord(db, 'id.sifa.profile.certification', testDid, '3wt-cert-del');

      const rows = await db
        .select()
        .from(certifications)
        .where(and(eq(certifications.did, testDid), eq(certifications.rkey, '3wt-cert-del')));
      expect(rows).toHaveLength(0);
    });

    it('is idempotent -- deleting non-existent record does not throw', async () => {
      await expect(
        deleteRecord(db, 'id.sifa.profile.certification', testDid, '3wt-nonexistent'),
      ).resolves.not.toThrow();
    });
  });
});
