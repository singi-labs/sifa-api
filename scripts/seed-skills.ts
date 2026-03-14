import 'dotenv/config';
import { createDb } from '../src/db/index.js';
import { canonicalSkills } from '../src/db/schema/index.js';
import { logger } from '../src/logger.js';

interface SkillSeed {
  canonicalName: string;
  slug: string;
  category: string;
  aliases: string[];
  wikidataId?: string;
}

const SKILLS: SkillSeed[] = [
  // Technical - Programming Languages
  { canonicalName: 'JavaScript', slug: 'javascript', category: 'technical', aliases: ['js', 'ecmascript', 'es6'], wikidataId: 'Q2005' },
  { canonicalName: 'TypeScript', slug: 'typescript', category: 'technical', aliases: ['ts'], wikidataId: 'Q978185' },
  { canonicalName: 'Python', slug: 'python', category: 'technical', aliases: ['py', 'python3'], wikidataId: 'Q28865' },
  { canonicalName: 'Java', slug: 'java', category: 'technical', aliases: ['java se', 'java ee'], wikidataId: 'Q251' },
  { canonicalName: 'C#', slug: 'c-sharp', category: 'technical', aliases: ['csharp', 'c sharp', 'dotnet'], wikidataId: 'Q2370' },
  { canonicalName: 'C++', slug: 'c-plus-plus', category: 'technical', aliases: ['cpp'], wikidataId: 'Q2407' },
  { canonicalName: 'Go', slug: 'go', category: 'technical', aliases: ['golang'], wikidataId: 'Q37227' },
  { canonicalName: 'Rust', slug: 'rust', category: 'technical', aliases: ['rust-lang'], wikidataId: 'Q575650' },
  { canonicalName: 'Ruby', slug: 'ruby', category: 'technical', aliases: ['rb'], wikidataId: 'Q161053' },
  { canonicalName: 'PHP', slug: 'php', category: 'technical', aliases: ['php8'], wikidataId: 'Q59' },
  { canonicalName: 'Swift', slug: 'swift', category: 'technical', aliases: ['swift5'], wikidataId: 'Q17118377' },
  { canonicalName: 'Kotlin', slug: 'kotlin', category: 'technical', aliases: ['kt'], wikidataId: 'Q3816023' },

  // Technical - Frontend
  { canonicalName: 'React', slug: 'react', category: 'technical', aliases: ['reactjs', 'react.js'], wikidataId: 'Q19399674' },
  { canonicalName: 'Vue.js', slug: 'vue-js', category: 'technical', aliases: ['vue', 'vuejs'], wikidataId: 'Q24589705' },
  { canonicalName: 'Angular', slug: 'angular', category: 'technical', aliases: ['angularjs', 'angular2'], wikidataId: 'Q28925578' },
  { canonicalName: 'Next.js', slug: 'next-js', category: 'technical', aliases: ['nextjs', 'next'], wikidataId: 'Q56062623' },
  { canonicalName: 'HTML', slug: 'html', category: 'technical', aliases: ['html5'], wikidataId: 'Q8811' },
  { canonicalName: 'CSS', slug: 'css', category: 'technical', aliases: ['css3', 'cascading style sheets'], wikidataId: 'Q46441' },
  { canonicalName: 'Tailwind CSS', slug: 'tailwind-css', category: 'technical', aliases: ['tailwind', 'tailwindcss'] },

  // Technical - Backend / Infra
  { canonicalName: 'Node.js', slug: 'node-js', category: 'technical', aliases: ['nodejs', 'node'], wikidataId: 'Q756100' },
  { canonicalName: 'PostgreSQL', slug: 'postgresql', category: 'technical', aliases: ['postgres', 'pg', 'psql'], wikidataId: 'Q192490' },
  { canonicalName: 'MySQL', slug: 'mysql', category: 'technical', aliases: ['mariadb'], wikidataId: 'Q850' },
  { canonicalName: 'MongoDB', slug: 'mongodb', category: 'technical', aliases: ['mongo'], wikidataId: 'Q1165204' },
  { canonicalName: 'Redis', slug: 'redis', category: 'technical', aliases: ['valkey'], wikidataId: 'Q2136322' },
  { canonicalName: 'Docker', slug: 'docker', category: 'technical', aliases: ['containers', 'containerization'], wikidataId: 'Q15206305' },
  { canonicalName: 'Kubernetes', slug: 'kubernetes', category: 'technical', aliases: ['k8s'], wikidataId: 'Q22661306' },
  { canonicalName: 'GraphQL', slug: 'graphql', category: 'technical', aliases: ['gql'], wikidataId: 'Q25104949' },
  { canonicalName: 'REST APIs', slug: 'rest-apis', category: 'technical', aliases: ['restful', 'rest', 'api design'] },
  { canonicalName: 'Git', slug: 'git', category: 'technical', aliases: ['version control', 'github', 'gitlab'], wikidataId: 'Q186055' },
  { canonicalName: 'Linux', slug: 'linux', category: 'technical', aliases: ['linux administration', 'unix'], wikidataId: 'Q388' },

  // Technical - Cloud
  { canonicalName: 'AWS', slug: 'aws', category: 'technical', aliases: ['amazon web services', 'amazon aws'], wikidataId: 'Q456157' },
  { canonicalName: 'Google Cloud', slug: 'google-cloud', category: 'technical', aliases: ['gcp', 'google cloud platform'], wikidataId: 'Q21048343' },
  { canonicalName: 'Microsoft Azure', slug: 'microsoft-azure', category: 'technical', aliases: ['azure'], wikidataId: 'Q725967' },
  { canonicalName: 'Terraform', slug: 'terraform', category: 'technical', aliases: ['iac', 'infrastructure as code'], wikidataId: 'Q21051411' },

  // Technical - Data / ML
  { canonicalName: 'Machine Learning', slug: 'machine-learning', category: 'technical', aliases: ['ml', 'deep learning'], wikidataId: 'Q2539' },
  { canonicalName: 'Data Science', slug: 'data-science', category: 'technical', aliases: ['data analysis', 'data analytics'] },
  { canonicalName: 'SQL', slug: 'sql', category: 'technical', aliases: ['structured query language'], wikidataId: 'Q47607' },

  // Technical - Testing / DevOps
  { canonicalName: 'CI/CD', slug: 'ci-cd', category: 'technical', aliases: ['continuous integration', 'continuous deployment', 'github actions'] },
  { canonicalName: 'Test-Driven Development', slug: 'test-driven-development', category: 'technical', aliases: ['tdd', 'unit testing', 'automated testing'] },

  // Business
  { canonicalName: 'Project Management', slug: 'project-management', category: 'business', aliases: ['pm', 'project planning'] },
  { canonicalName: 'Product Management', slug: 'product-management', category: 'business', aliases: ['product owner', 'product strategy'] },
  { canonicalName: 'Agile', slug: 'agile', category: 'business', aliases: ['scrum', 'kanban', 'agile methodology'] },
  { canonicalName: 'Business Analysis', slug: 'business-analysis', category: 'business', aliases: ['ba', 'requirements analysis'] },
  { canonicalName: 'Strategic Planning', slug: 'strategic-planning', category: 'business', aliases: ['strategy', 'business strategy'] },
  { canonicalName: 'Marketing', slug: 'marketing', category: 'business', aliases: ['digital marketing', 'content marketing'] },
  { canonicalName: 'Sales', slug: 'sales', category: 'business', aliases: ['sales management', 'b2b sales', 'account management'] },

  // Creative
  { canonicalName: 'UI Design', slug: 'ui-design', category: 'creative', aliases: ['user interface design', 'ui'] },
  { canonicalName: 'UX Design', slug: 'ux-design', category: 'creative', aliases: ['user experience design', 'ux', 'ux research'] },
  { canonicalName: 'Graphic Design', slug: 'graphic-design', category: 'creative', aliases: ['visual design'] },
  { canonicalName: 'Copywriting', slug: 'copywriting', category: 'creative', aliases: ['content writing', 'technical writing'] },

  // Interpersonal
  { canonicalName: 'Leadership', slug: 'leadership', category: 'interpersonal', aliases: ['team leadership', 'people management'] },
  { canonicalName: 'Communication', slug: 'communication', category: 'interpersonal', aliases: ['public speaking', 'presentation skills'] },
  { canonicalName: 'Team Collaboration', slug: 'team-collaboration', category: 'interpersonal', aliases: ['teamwork', 'cross-functional collaboration'] },
  { canonicalName: 'Mentoring', slug: 'mentoring', category: 'interpersonal', aliases: ['coaching', 'mentorship'] },
];

async function seedSkills() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const db = createDb(databaseUrl);

  logger.info({ count: SKILLS.length }, 'Seeding canonical skills');

  let inserted = 0;
  let skipped = 0;

  for (const skill of SKILLS) {
    const result = await db
      .insert(canonicalSkills)
      .values({
        canonicalName: skill.canonicalName,
        slug: skill.slug,
        category: skill.category,
        aliases: skill.aliases,
        wikidataId: skill.wikidataId ?? null,
      })
      .onConflictDoNothing();

    if (result.rowCount && result.rowCount > 0) {
      inserted++;
    } else {
      skipped++;
    }
  }

  logger.info({ inserted, skipped }, 'Skill seeding complete');

  await db.$client.end();
}

seedSkills().catch((error: unknown) => {
  logger.error(error, 'Failed to seed skills');
  process.exit(1);
});
