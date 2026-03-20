import 'dotenv/config';
import { createDb, type Database } from '../src/db/index.js';
import { canonicalSkills, unresolvedSkills } from '../src/db/schema/index.js';
import { normalizeSkillName, createSlug } from '../src/services/skill-normalization.js';
import { isNull, sql } from 'drizzle-orm';
import { logger } from '../src/logger.js';

interface SkillSeed {
  canonicalName: string;
  slug: string;
  category: string;
  aliases: string[];
  wikidataId?: string;
}

const SKILLS: SkillSeed[] = [
  // ──────────────────────────────────────────────
  // Technical - Programming Languages
  // ──────────────────────────────────────────────
  {
    canonicalName: 'JavaScript',
    slug: 'javascript',
    category: 'technical',
    aliases: ['js', 'ecmascript', 'es6'],
    wikidataId: 'Q2005',
  },
  {
    canonicalName: 'TypeScript',
    slug: 'typescript',
    category: 'technical',
    aliases: ['ts'],
    wikidataId: 'Q978185',
  },
  {
    canonicalName: 'Python',
    slug: 'python',
    category: 'technical',
    aliases: ['py', 'python3', 'python (programming language)', 'python for cybersecurity'],
    wikidataId: 'Q28865',
  },
  {
    canonicalName: 'Java',
    slug: 'java',
    category: 'technical',
    aliases: ['java se', 'java ee'],
    wikidataId: 'Q251',
  },
  {
    canonicalName: 'C#',
    slug: 'c-sharp',
    category: 'technical',
    aliases: ['csharp', 'c sharp', 'dotnet'],
    wikidataId: 'Q2370',
  },
  {
    canonicalName: 'C++',
    slug: 'c-plus-plus',
    category: 'technical',
    aliases: ['cpp'],
    wikidataId: 'Q2407',
  },
  {
    canonicalName: 'C',
    slug: 'c',
    category: 'technical',
    aliases: ['c (programming language)'],
    wikidataId: 'Q15777',
  },
  {
    canonicalName: 'Go',
    slug: 'go',
    category: 'technical',
    aliases: ['golang'],
    wikidataId: 'Q37227',
  },
  {
    canonicalName: 'Rust',
    slug: 'rust',
    category: 'technical',
    aliases: ['rust-lang', 'rust (programming language)'],
    wikidataId: 'Q575650',
  },
  {
    canonicalName: 'Ruby',
    slug: 'ruby',
    category: 'technical',
    aliases: ['rb'],
    wikidataId: 'Q161053',
  },
  {
    canonicalName: 'PHP',
    slug: 'php',
    category: 'technical',
    aliases: ['php8'],
    wikidataId: 'Q59',
  },
  {
    canonicalName: 'Swift',
    slug: 'swift',
    category: 'technical',
    aliases: ['swift5'],
    wikidataId: 'Q17118377',
  },
  {
    canonicalName: 'Kotlin',
    slug: 'kotlin',
    category: 'technical',
    aliases: ['kt'],
    wikidataId: 'Q3816023',
  },
  {
    canonicalName: 'Nim',
    slug: 'nim',
    category: 'technical',
    aliases: ['nim-lang'],
  },
  {
    canonicalName: 'Shell Scripting',
    slug: 'shell-scripting',
    category: 'technical',
    aliases: ['bash scripting', 'bash'],
  },
  {
    canonicalName: 'ActionScript',
    slug: 'actionscript',
    category: 'technical',
    aliases: ['flash', 'actionscript 3'],
  },

  // ──────────────────────────────────────────────
  // Technical - Frontend
  // ──────────────────────────────────────────────
  {
    canonicalName: 'React',
    slug: 'react',
    category: 'technical',
    aliases: ['reactjs', 'react.js'],
    wikidataId: 'Q19399674',
  },
  {
    canonicalName: 'Vue.js',
    slug: 'vue-js',
    category: 'technical',
    aliases: ['vue', 'vuejs'],
    wikidataId: 'Q24589705',
  },
  {
    canonicalName: 'Angular',
    slug: 'angular',
    category: 'technical',
    aliases: ['angularjs', 'angular2'],
    wikidataId: 'Q28925578',
  },
  {
    canonicalName: 'Next.js',
    slug: 'next-js',
    category: 'technical',
    aliases: ['nextjs', 'next'],
    wikidataId: 'Q56062623',
  },
  {
    canonicalName: 'Svelte',
    slug: 'svelte',
    category: 'technical',
    aliases: ['sveltekit'],
  },
  {
    canonicalName: 'jQuery',
    slug: 'jquery',
    category: 'technical',
    aliases: [],
  },
  {
    canonicalName: 'HTML',
    slug: 'html',
    category: 'technical',
    aliases: ['html5', 'html 5', 'xhtml'],
    wikidataId: 'Q8811',
  },
  {
    canonicalName: 'CSS',
    slug: 'css',
    category: 'technical',
    aliases: ['css3', 'cascading style sheets'],
    wikidataId: 'Q46441',
  },
  {
    canonicalName: 'Tailwind CSS',
    slug: 'tailwind-css',
    category: 'technical',
    aliases: ['tailwind', 'tailwindcss'],
  },

  // ──────────────────────────────────────────────
  // Technical - Backend / Infra
  // ──────────────────────────────────────────────
  {
    canonicalName: 'Node.js',
    slug: 'node-js',
    category: 'technical',
    aliases: ['nodejs', 'node'],
    wikidataId: 'Q756100',
  },
  {
    canonicalName: 'Django',
    slug: 'django',
    category: 'technical',
    aliases: ['django rest framework'],
    wikidataId: 'Q170584',
  },
  {
    canonicalName: 'Spring Framework',
    slug: 'spring-framework',
    category: 'technical',
    aliases: ['spring', 'spring boot', 'framework spring'],
    wikidataId: 'Q856079',
  },
  {
    canonicalName: '.NET Framework',
    slug: 'dot-net-framework',
    category: 'technical',
    aliases: ['.net', 'dot-net', '.net framework'],
  },
  {
    canonicalName: 'PostgreSQL',
    slug: 'postgresql',
    category: 'technical',
    aliases: ['postgres', 'pg', 'psql'],
    wikidataId: 'Q192490',
  },
  {
    canonicalName: 'MySQL',
    slug: 'mysql',
    category: 'technical',
    aliases: ['mariadb'],
    wikidataId: 'Q850',
  },
  {
    canonicalName: 'MongoDB',
    slug: 'mongodb',
    category: 'technical',
    aliases: ['mongo'],
    wikidataId: 'Q1165204',
  },
  {
    canonicalName: 'Redis',
    slug: 'redis',
    category: 'technical',
    aliases: ['valkey'],
    wikidataId: 'Q2136322',
  },
  {
    canonicalName: 'Databases',
    slug: 'databases',
    category: 'technical',
    aliases: ['database administration', 'database troubleshooting', 'database management'],
  },
  {
    canonicalName: 'Docker',
    slug: 'docker',
    category: 'technical',
    aliases: ['containers', 'containerization'],
    wikidataId: 'Q15206305',
  },
  {
    canonicalName: 'Kubernetes',
    slug: 'kubernetes',
    category: 'technical',
    aliases: ['k8s'],
    wikidataId: 'Q22661306',
  },
  {
    canonicalName: 'GraphQL',
    slug: 'graphql',
    category: 'technical',
    aliases: ['gql', 'apollo graphql'],
    wikidataId: 'Q25104949',
  },
  {
    canonicalName: 'REST APIs',
    slug: 'rest-apis',
    category: 'technical',
    aliases: ['restful', 'rest', 'api design', 'rest api', 'web services'],
  },
  {
    canonicalName: 'Git',
    slug: 'git',
    category: 'technical',
    aliases: ['version control', 'github', 'gitlab'],
    wikidataId: 'Q186055',
  },
  {
    canonicalName: 'Linux',
    slug: 'linux',
    category: 'technical',
    aliases: ['linux administration', 'unix', 'linux system administration', 'linux & bash'],
    wikidataId: 'Q388',
  },

  // ──────────────────────────────────────────────
  // Technical - Cloud
  // ──────────────────────────────────────────────
  {
    canonicalName: 'AWS',
    slug: 'aws',
    category: 'technical',
    aliases: ['amazon web services', 'amazon aws'],
    wikidataId: 'Q456157',
  },
  {
    canonicalName: 'Google Cloud',
    slug: 'google-cloud',
    category: 'technical',
    aliases: ['gcp', 'google cloud platform'],
    wikidataId: 'Q21048343',
  },
  {
    canonicalName: 'Microsoft Azure',
    slug: 'microsoft-azure',
    category: 'technical',
    aliases: ['azure'],
    wikidataId: 'Q725967',
  },
  {
    canonicalName: 'Terraform',
    slug: 'terraform',
    category: 'technical',
    aliases: ['iac', 'infrastructure as code'],
    wikidataId: 'Q21051411',
  },

  // ──────────────────────────────────────────────
  // Technical - Data / ML
  // ──────────────────────────────────────────────
  {
    canonicalName: 'Machine Learning',
    slug: 'machine-learning',
    category: 'technical',
    aliases: ['ml', 'deep learning'],
    wikidataId: 'Q2539',
  },
  {
    canonicalName: 'Data Science',
    slug: 'data-science',
    category: 'technical',
    aliases: ['data analysis', 'data analytics'],
  },
  {
    canonicalName: 'SQL',
    slug: 'sql',
    category: 'technical',
    aliases: [
      'structured query language',
      'sql (structured query language)',
      'sql for data retrieval',
    ],
    wikidataId: 'Q47607',
  },
  {
    canonicalName: 'pandas',
    slug: 'pandas',
    category: 'technical',
    aliases: ['pandas (software)', 'pandas library'],
  },
  {
    canonicalName: 'dbt',
    slug: 'dbt',
    category: 'technical',
    aliases: ['data build tool', 'data build tool (dbt)'],
  },
  {
    canonicalName: 'Computer Vision',
    slug: 'computer-vision',
    category: 'technical',
    aliases: ['image recognition', 'object detection'],
  },

  // ──────────────────────────────────────────────
  // Technical - Testing / DevOps
  // ──────────────────────────────────────────────
  {
    canonicalName: 'CI/CD',
    slug: 'ci-cd',
    category: 'technical',
    aliases: ['continuous integration', 'continuous deployment', 'github actions'],
  },
  {
    canonicalName: 'Test-Driven Development',
    slug: 'test-driven-development',
    category: 'technical',
    aliases: ['tdd', 'unit testing', 'automated testing'],
  },

  // ──────────────────────────────────────────────
  // Technical - Programming Paradigms
  // ──────────────────────────────────────────────
  {
    canonicalName: 'Object-Oriented Programming',
    slug: 'object-oriented-programming',
    category: 'technical',
    aliases: ['oop', 'programmation orientée objet (poo)', 'object oriented design'],
  },
  {
    canonicalName: 'Functional Programming',
    slug: 'functional-programming',
    category: 'technical',
    aliases: ['fp', 'programmation fonctionnelle'],
  },
  {
    canonicalName: 'SDLC',
    slug: 'sdlc',
    category: 'technical',
    aliases: [
      'software development life cycle',
      'software development life cycle (sdlc)',
      'software development lifecycle',
    ],
  },

  // ──────────────────────────────────────────────
  // Technical - Platforms / Tools
  // ──────────────────────────────────────────────
  {
    canonicalName: 'WordPress',
    slug: 'wordpress',
    category: 'technical',
    aliases: ['wordpress development', 'wordpress cms'],
    wikidataId: 'Q13166',
  },
  {
    canonicalName: 'Salesforce',
    slug: 'salesforce',
    category: 'technical',
    aliases: ['salesforce.com', 'salesforce crm'],
  },
  {
    canonicalName: 'Microsoft Office',
    slug: 'microsoft-office',
    category: 'technical',
    aliases: ['microsoft 365', 'ms office', 'microsoft word', 'microsoft access'],
  },
  {
    canonicalName: 'Microsoft Excel',
    slug: 'microsoft-excel',
    category: 'technical',
    aliases: ['excel', 'ms excel'],
  },
  {
    canonicalName: 'Google Workspace',
    slug: 'google-workspace',
    category: 'technical',
    aliases: ['google apps', 'g suite'],
  },
  {
    canonicalName: 'n8n',
    slug: 'n8n',
    category: 'technical',
    aliases: ['n8n.io'],
  },
  {
    canonicalName: 'Unity',
    slug: 'unity',
    category: 'technical',
    aliases: ['unity3d', 'unity game engine'],
    wikidataId: 'Q177984',
  },
  {
    canonicalName: 'Arduino',
    slug: 'arduino',
    category: 'technical',
    aliases: ['arduino programming'],
    wikidataId: 'Q2029106',
  },
  {
    canonicalName: 'LaTeX',
    slug: 'latex',
    category: 'technical',
    aliases: ['latex typesetting'],
    wikidataId: 'Q5310',
  },
  {
    canonicalName: 'Dreamweaver',
    slug: 'dreamweaver',
    category: 'technical',
    aliases: ['adobe dreamweaver'],
  },
  {
    canonicalName: 'AT Protocol',
    slug: 'at-protocol',
    category: 'technical',
    aliases: ['atproto', 'at protocol', 'authenticated transfer protocol'],
  },
  {
    canonicalName: 'Revit',
    slug: 'revit',
    category: 'technical',
    aliases: ['autodesk revit'],
  },
  {
    canonicalName: 'SketchUp',
    slug: 'sketchup',
    category: 'technical',
    aliases: ['google sketchup', 'trimble sketchup'],
  },
  {
    canonicalName: 'macOS',
    slug: 'macos',
    category: 'technical',
    aliases: ['mac os', 'os x', 'mac os x'],
  },
  {
    canonicalName: 'ChromeOS',
    slug: 'chromeos',
    category: 'technical',
    aliases: ['chrome os'],
  },

  // ──────────────────────────────────────────────
  // Technical - Web
  // ──────────────────────────────────────────────
  {
    canonicalName: 'Progressive Web Apps',
    slug: 'progressive-web-apps',
    category: 'technical',
    aliases: ['pwa', 'progressive web applications (pwas)', 'progressive web applications'],
  },
  {
    canonicalName: 'Accessibility',
    slug: 'accessibility',
    category: 'technical',
    aliases: ['a11y', 'wcag', 'web accessibility'],
  },

  // ──────────────────────────────────────────────
  // Technical - IoT / Embedded / Hardware
  // ──────────────────────────────────────────────
  {
    canonicalName: 'Internet of Things',
    slug: 'internet-of-things',
    category: 'technical',
    aliases: [
      'iot',
      'internet of things (iot)',
      'internet of vehicles (iov)',
      'home automation',
      'smart home',
    ],
  },
  {
    canonicalName: 'Industrial Automation',
    slug: 'industrial-automation',
    category: 'technical',
    aliases: ['automation engineering', 'plc programming'],
  },
  {
    canonicalName: 'Augmented Reality',
    slug: 'augmented-reality',
    category: 'technical',
    aliases: ['ar', 'augmented reality (ar)', 'mixed reality'],
  },
  {
    canonicalName: 'CAD',
    slug: 'cad',
    category: 'technical',
    aliases: [
      'computer-aided design',
      'computer-aided design (cad)',
      'autocad',
      'autodesk fusion 360',
      'onshape',
    ],
  },
  {
    canonicalName: 'SolidWorks',
    slug: 'solidworks',
    category: 'technical',
    aliases: ['solid works'],
  },
  {
    canonicalName: 'KeyShot',
    slug: 'keyshot',
    category: 'technical',
    aliases: ['keyshot rendering'],
  },

  // ──────────────────────────────────────────────
  // Technical - Additional (from earlier seed)
  // ──────────────────────────────────────────────
  {
    canonicalName: 'Software Engineering',
    slug: 'software-engineering',
    category: 'technical',
    aliases: [
      'software development',
      'programming',
      'software design',
      'programutveckling',
      'programmering',
    ],
  },
  {
    canonicalName: 'Web Development',
    slug: 'web-development',
    category: 'technical',
    aliases: [
      'frontend development',
      'backend development',
      'fullstack development',
      'full-stack development',
      'web dev',
      'web application development',
      'front-end',
      'front-end development',
      'back-end web development',
      'html/css/js',
      'web 2.0',
      'développement full-stack',
    ],
  },
  {
    canonicalName: 'Systems Design',
    slug: 'systems-design',
    category: 'technical',
    aliases: [
      'system design',
      'software architecture',
      'system architecture',
      'antifragile systems design',
      'distributed systems',
      'architecture',
      'architecture mvc',
    ],
  },
  {
    canonicalName: 'Quality Assurance',
    slug: 'quality-assurance',
    category: 'technical',
    aliases: [
      'qa',
      'quality assurance (qa)',
      'software testing',
      'regression testing',
      'defect tracking',
      'test automation',
      'testing',
      'automatisation des tests',
    ],
  },
  {
    canonicalName: 'Technical Documentation',
    slug: 'technical-documentation',
    category: 'technical',
    aliases: ['documentation', 'api documentation', 'developer documentation'],
  },
  {
    canonicalName: 'Technical Training',
    slug: 'technical-training',
    category: 'technical',
    aliases: ['it training', 'technology training', 'technical support readiness'],
  },
  {
    canonicalName: 'Windows Administration',
    slug: 'windows-administration',
    category: 'technical',
    aliases: ['windows server', 'active directory', 'microsoft windows'],
  },
  {
    canonicalName: 'Generative AI',
    slug: 'generative-ai',
    category: 'technical',
    aliases: [
      'gen ai',
      'llm',
      'large language models',
      'ai building',
      'generative ai for cybersecurity',
      'ai development',
      'ai code generation',
    ],
  },
  {
    canonicalName: 'Data Integrity',
    slug: 'data-integrity',
    category: 'technical',
    aliases: ['data quality', 'data governance', 'data management'],
  },
  {
    canonicalName: 'Requirements Analysis',
    slug: 'requirements-analysis',
    category: 'technical',
    aliases: ['system requirements', 'requirements engineering', 'requirements gathering'],
  },
  {
    canonicalName: 'System Integration',
    slug: 'system-integration',
    category: 'technical',
    aliases: ['integration', 'api integration', 'enterprise integration', 'systems integration'],
  },
  {
    canonicalName: 'System Deployment',
    slug: 'system-deployment',
    category: 'technical',
    aliases: ['deployment automation', 'system balancing', 'infrastructure improvement'],
  },
  {
    canonicalName: 'Hardware Management',
    slug: 'hardware-management',
    category: 'technical',
    aliases: [
      'hardware compatibility testing',
      'hardware and software lifecycle management',
      'hardware lifecycle',
      'it asset management',
      'computer hardware troubleshooting',
      'computer hardware',
    ],
  },
  {
    canonicalName: 'XML',
    slug: 'xml',
    category: 'technical',
    aliases: ['extensible markup language', 'xslt', 'xsd'],
  },
  {
    canonicalName: 'Magento',
    slug: 'magento',
    category: 'technical',
    aliases: ['adobe commerce', 'magento ecommerce', 'magento 2'],
  },
  {
    canonicalName: 'Spryker',
    slug: 'spryker',
    category: 'technical',
    aliases: ['spryker cloud commerce os'],
  },
  {
    canonicalName: 'Joomla',
    slug: 'joomla',
    category: 'technical',
    aliases: ['joomla cms'],
  },

  // ──────────────────────────────────────────────
  // Business
  // ──────────────────────────────────────────────
  {
    canonicalName: 'Project Management',
    slug: 'project-management',
    category: 'business',
    aliases: ['pm', 'project planning'],
  },
  {
    canonicalName: 'Product Management',
    slug: 'product-management',
    category: 'business',
    aliases: ['product owner', 'product strategy', 'product planning'],
  },
  {
    canonicalName: 'Agile',
    slug: 'agile',
    category: 'business',
    aliases: [
      'scrum',
      'kanban',
      'agile methodology',
      'agile application development',
      'user stories',
    ],
  },
  {
    canonicalName: 'Business Analysis',
    slug: 'business-analysis',
    category: 'business',
    aliases: ['ba', 'requirements analysis'],
  },
  {
    canonicalName: 'Strategic Planning',
    slug: 'strategic-planning',
    category: 'business',
    aliases: ['strategy', 'business strategy'],
  },
  {
    canonicalName: 'Marketing',
    slug: 'marketing',
    category: 'business',
    aliases: ['digital marketing', 'content marketing'],
  },
  {
    canonicalName: 'Sales',
    slug: 'sales',
    category: 'business',
    aliases: [
      'sales management',
      'b2b sales',
      'account management',
      'sales strategy & pipeline development',
    ],
  },
  {
    canonicalName: 'Management',
    slug: 'management',
    category: 'business',
    aliases: ['general management', 'operations management'],
  },
  {
    canonicalName: 'Social Media',
    slug: 'social-media',
    category: 'business',
    aliases: ['social networks', 'social platforms'],
  },
  {
    canonicalName: 'Social Media Marketing',
    slug: 'social-media-marketing',
    category: 'business',
    aliases: ['smm', 'social advertising'],
  },
  {
    canonicalName: 'Market Research',
    slug: 'market-research',
    category: 'business',
    aliases: ['market analysis', 'competitive analysis'],
  },
  {
    canonicalName: 'Customer Service',
    slug: 'customer-service',
    category: 'business',
    aliases: ['customer support', 'client services'],
  },
  {
    canonicalName: 'Customer Experience',
    slug: 'customer-experience',
    category: 'business',
    aliases: ['cx', 'customer experience management'],
  },
  {
    canonicalName: 'Customer Success',
    slug: 'customer-success',
    category: 'business',
    aliases: ['customer success management', 'csm'],
  },
  {
    canonicalName: 'Product Development',
    slug: 'product-development',
    category: 'business',
    aliases: ['new product development', 'npd'],
  },
  {
    canonicalName: 'Recruiting',
    slug: 'recruiting',
    category: 'business',
    aliases: ['recruiting and hiring', 'talent acquisition', 'hiring'],
  },
  {
    canonicalName: 'Financial Services',
    slug: 'financial-services',
    category: 'business',
    aliases: ['banking', 'financial industry'],
  },
  {
    canonicalName: 'Insurance',
    slug: 'insurance',
    category: 'business',
    aliases: ['insurance brokerage', 'insurance industry'],
  },
  {
    canonicalName: 'Manufacturing',
    slug: 'manufacturing',
    category: 'business',
    aliases: ['production management', 'manufacturing operations'],
  },
  {
    canonicalName: 'SaaS',
    slug: 'saas',
    category: 'business',
    aliases: ['software as a service', 'saas & cloud solutions expertise'],
  },
  {
    canonicalName: 'Lean',
    slug: 'lean',
    category: 'business',
    aliases: ['lean transformation', 'lean manufacturing', 'lean methodology'],
  },
  {
    canonicalName: 'Revenue Management',
    slug: 'revenue-management',
    category: 'business',
    aliases: ['revenue growth optimization', 'revenue optimization'],
  },
  {
    canonicalName: 'Workplace Safety',
    slug: 'workplace-safety',
    category: 'business',
    aliases: ['occupational safety', 'osha'],
  },

  // Business - additional (from earlier seed)
  {
    canonicalName: 'E-commerce',
    slug: 'e-commerce',
    category: 'business',
    aliases: ['ecommerce', 'e-business', 'online retail', 'online commerce', 'e commerce'],
  },
  {
    canonicalName: 'Conversion Optimization',
    slug: 'conversion-optimization',
    category: 'business',
    aliases: [
      'cro',
      'conversion rate optimization',
      'e-commerce optimization',
      'ecommerce optimization',
    ],
  },
  {
    canonicalName: 'Digital Strategy',
    slug: 'digital-strategy',
    category: 'business',
    aliases: ['digital transformation', 'digital business strategy', 'online strategy'],
  },
  {
    canonicalName: 'Online Marketing',
    slug: 'online-marketing',
    category: 'business',
    aliases: ['internet marketing', 'web marketing'],
  },
  {
    canonicalName: 'Marketing Strategy',
    slug: 'marketing-strategy',
    category: 'business',
    aliases: ['go-to-market strategy', 'marketing planning', 'growth marketing'],
  },
  {
    canonicalName: 'Growth Hacking',
    slug: 'growth-hacking',
    category: 'business',
    aliases: ['growth strategy', 'user acquisition', 'viral marketing'],
  },
  {
    canonicalName: 'SEO',
    slug: 'seo',
    category: 'business',
    aliases: ['search engine optimization', 'technical seo', 'on-page seo', 'seo strategy'],
  },
  {
    canonicalName: 'A/B Testing',
    slug: 'a-b-testing',
    category: 'business',
    aliases: ['split testing', 'multivariate testing', 'experimentation', 'a/b test'],
  },
  {
    canonicalName: 'Web Analytics',
    slug: 'web-analytics',
    category: 'business',
    aliases: ['google analytics', 'digital analytics', 'web tracking'],
  },
  {
    canonicalName: 'Analytics',
    slug: 'analytics',
    category: 'business',
    aliases: ['business analytics', 'product analytics'],
  },
  {
    canonicalName: 'Data Visualization',
    slug: 'data-visualization',
    category: 'business',
    aliases: ['data viz', 'dashboards', 'business intelligence visualization'],
  },
  {
    canonicalName: 'Entrepreneurship',
    slug: 'entrepreneurship',
    category: 'business',
    aliases: ['startup', 'founder', 'entrepreneur', 'business development', 'business ideas'],
  },
  {
    canonicalName: 'Performance Management',
    slug: 'performance-management',
    category: 'business',
    aliases: ['kpi management', 'okr', 'objectives and key results'],
  },
  {
    canonicalName: 'Process Improvement',
    slug: 'process-improvement',
    category: 'business',
    aliases: [
      'business process improvement',
      'workflow optimization',
      'operational efficiency',
      'root cause analysis (rca)',
      'root cause analysis',
    ],
  },
  {
    canonicalName: 'Vendor Management',
    slug: 'vendor-management',
    category: 'business',
    aliases: ['supplier management', 'partner management', 'procurement'],
  },
  {
    canonicalName: 'Resource Management',
    slug: 'resource-management',
    category: 'business',
    aliases: ['capacity planning', 'workforce planning'],
  },
  {
    canonicalName: 'Knowledge Management',
    slug: 'knowledge-management',
    category: 'business',
    aliases: ['knowledge base management', 'organizational learning', 'documentation management'],
  },
  {
    canonicalName: 'Compliance Management',
    slug: 'compliance-management',
    category: 'business',
    aliases: ['regulatory compliance', 'governance', 'grc'],
  },
  {
    canonicalName: 'Risk Assessment',
    slug: 'risk-assessment',
    category: 'business',
    aliases: ['risk management', 'risk analysis', 'cost-benefit analysis'],
  },
  {
    canonicalName: 'IT Consulting',
    slug: 'it-consulting',
    category: 'business',
    aliases: ['technology consulting', 'digital consulting'],
  },
  {
    canonicalName: 'Software Project Management',
    slug: 'software-project-management',
    category: 'business',
    aliases: [
      'web project management',
      'it project management',
      'technical project management',
      'project coordination',
    ],
  },
  {
    canonicalName: 'Service Level Management',
    slug: 'service-level-management',
    category: 'business',
    aliases: [
      'sla management',
      'service-level agreements',
      'service level agreement',
      'service-level agreements (sla)',
    ],
  },
  {
    canonicalName: 'Crisis Communications',
    slug: 'crisis-communications',
    category: 'business',
    aliases: ['crisis management', 'reputation management'],
  },
  {
    canonicalName: 'Content Management',
    slug: 'content-management',
    category: 'business',
    aliases: [
      'cms',
      'web content management',
      'content management systems',
      'content management systems (cms)',
    ],
  },
  {
    canonicalName: 'Blogging',
    slug: 'blogging',
    category: 'business',
    aliases: ['blog writing', 'content publishing'],
  },
  {
    canonicalName: 'Writing',
    slug: 'writing',
    category: 'business',
    aliases: ['business writing', 'professional writing'],
  },
  {
    canonicalName: 'CRM',
    slug: 'crm',
    category: 'business',
    aliases: ['customer relationship management', 'customer relationship management (crm)'],
  },
  {
    canonicalName: 'Business Networking',
    slug: 'business-networking',
    category: 'business',
    aliases: ['professional networking', 'relationship building', 'business alignment'],
  },
  {
    canonicalName: 'Financial Systems',
    slug: 'financial-systems',
    category: 'business',
    aliases: [
      'financial management systems',
      'erp',
      'enterprise resource planning',
      'financial software',
    ],
  },
  {
    canonicalName: 'Agile Methodologies',
    slug: 'agile-methodologies',
    category: 'business',
    aliases: ['agile project management', 'agile practices', 'agile frameworks'],
  },

  // ──────────────────────────────────────────────
  // Creative
  // ──────────────────────────────────────────────
  {
    canonicalName: 'UI Design',
    slug: 'ui-design',
    category: 'creative',
    aliases: ['user interface design', 'ui', 'android design'],
  },
  {
    canonicalName: 'UX Design',
    slug: 'ux-design',
    category: 'creative',
    aliases: [
      'user experience design',
      'ux',
      'ux research',
      'user experience design (ued)',
      'user experience (ux)',
      'user-centered design',
      'lean ux',
      'user journeys',
      'customer journey mapping',
    ],
  },
  {
    canonicalName: 'Graphic Design',
    slug: 'graphic-design',
    category: 'creative',
    aliases: ['visual design', 'design production', 'icon design', 'design', 'designs'],
  },
  {
    canonicalName: 'Copywriting',
    slug: 'copywriting',
    category: 'creative',
    aliases: ['content writing', 'technical writing', 'web content writing'],
  },
  {
    canonicalName: 'Web Design',
    slug: 'web-design',
    category: 'creative',
    aliases: ['website design'],
  },
  {
    canonicalName: 'Product Design',
    slug: 'product-design',
    category: 'creative',
    aliases: ['product design support'],
  },
  {
    canonicalName: 'Interaction Design',
    slug: 'interaction-design',
    category: 'creative',
    aliases: ['ixd'],
  },
  {
    canonicalName: 'Design Thinking',
    slug: 'design-thinking',
    category: 'creative',
    aliases: ['design strategy', 'design practice', 'human-centered design'],
  },
  {
    canonicalName: 'Information Architecture',
    slug: 'information-architecture',
    category: 'creative',
    aliases: ['ia', 'content architecture'],
  },
  {
    canonicalName: 'Wireframing',
    slug: 'wireframing',
    category: 'creative',
    aliases: ['wireframes', 'mockups'],
  },
  {
    canonicalName: 'Prototyping',
    slug: 'prototyping',
    category: 'creative',
    aliases: ['rapid prototyping', 'prototype development', 'origami'],
  },
  {
    canonicalName: 'User Research',
    slug: 'user-research',
    category: 'creative',
    aliases: ['design research', 'user testing research'],
  },
  {
    canonicalName: 'Service Design',
    slug: 'service-design',
    category: 'creative',
    aliases: ['service design thinking'],
  },
  {
    canonicalName: 'Design Systems',
    slug: 'design-systems',
    category: 'creative',
    aliases: ['design tokens', 'component libraries'],
  },
  {
    canonicalName: 'Design Operations',
    slug: 'design-operations',
    category: 'creative',
    aliases: ['designops', 'design ops'],
  },
  {
    canonicalName: 'Design Leadership',
    slug: 'design-leadership',
    category: 'creative',
    aliases: ['design advocacy', 'design coaching', 'design management'],
  },
  {
    canonicalName: 'Content Design',
    slug: 'content-design',
    category: 'creative',
    aliases: ['ux writing'],
  },
  {
    canonicalName: 'Photography',
    slug: 'photography',
    category: 'creative',
    aliases: ['photo editing', 'digital photography'],
  },
  {
    canonicalName: 'Digital Illustration',
    slug: 'digital-illustration',
    category: 'creative',
    aliases: ['illustration', 'digital art'],
  },
  {
    canonicalName: 'Logo Design',
    slug: 'logo-design',
    category: 'creative',
    aliases: ['brand identity design'],
  },
  {
    canonicalName: 'Sketching',
    slug: 'sketching',
    category: 'creative',
    aliases: ['freehand sketching', 'concept sketching'],
  },
  {
    canonicalName: 'Branding',
    slug: 'branding',
    category: 'creative',
    aliases: ['brand strategy', 'brand development'],
  },
  {
    canonicalName: 'Digital Publishing',
    slug: 'digital-publishing',
    category: 'creative',
    aliases: ['electronic publishing', 'epub'],
  },
  {
    canonicalName: 'Architectural Design',
    slug: 'architectural-design',
    category: 'creative',
    aliases: ['building architecture', 'architectural drafting'],
  },
  {
    canonicalName: 'Level Design',
    slug: 'level-design',
    category: 'creative',
    aliases: ['level design / map design', 'map design', 'game level design'],
  },
  {
    canonicalName: 'Usability',
    slug: 'usability',
    category: 'creative',
    aliases: [
      'usability testing',
      'user testing',
      'usability research',
      'user experience testing',
      'user experience',
      'hci',
      'human-computer interaction',
    ],
  },

  // ──────────────────────────────────────────────
  // Creative - Design Software
  // ──────────────────────────────────────────────
  {
    canonicalName: 'Adobe Creative Suite',
    slug: 'adobe-creative-suite',
    category: 'creative',
    aliases: ['adobe creative cloud', 'creative suite'],
  },
  {
    canonicalName: 'Adobe Photoshop',
    slug: 'adobe-photoshop',
    category: 'creative',
    aliases: ['photoshop', 'ps'],
  },
  {
    canonicalName: 'Adobe Illustrator',
    slug: 'adobe-illustrator',
    category: 'creative',
    aliases: ['illustrator', 'ai'],
  },
  {
    canonicalName: 'Adobe InDesign',
    slug: 'adobe-indesign',
    category: 'creative',
    aliases: ['indesign'],
  },
  {
    canonicalName: 'Adobe Premiere Pro',
    slug: 'adobe-premiere-pro',
    category: 'creative',
    aliases: ['premiere pro', 'premiere'],
  },
  {
    canonicalName: 'Affinity Designer',
    slug: 'affinity-designer',
    category: 'creative',
    aliases: [],
  },
  {
    canonicalName: 'Affinity Photo',
    slug: 'affinity-photo',
    category: 'creative',
    aliases: [],
  },

  // ──────────────────────────────────────────────
  // Interpersonal
  // ──────────────────────────────────────────────
  {
    canonicalName: 'Leadership',
    slug: 'leadership',
    category: 'interpersonal',
    aliases: ['team leadership', 'people management', 'strategic leadership'],
  },
  {
    canonicalName: 'Communication',
    slug: 'communication',
    category: 'interpersonal',
    aliases: ['public speaking', 'presentation skills', 'presentations'],
  },
  {
    canonicalName: 'Team Collaboration',
    slug: 'team-collaboration',
    category: 'interpersonal',
    aliases: ['teamwork', 'cross-functional collaboration', 'collaboration', 'virtual teams'],
  },
  {
    canonicalName: 'Mentoring',
    slug: 'mentoring',
    category: 'interpersonal',
    aliases: ['coaching', 'mentorship'],
  },
  {
    canonicalName: 'Cross-functional Leadership',
    slug: 'cross-functional-leadership',
    category: 'interpersonal',
    aliases: [
      'cross-functional team leadership',
      'cross-functional management',
      'matrix management',
      'global cross-functional team leadership',
    ],
  },
  {
    canonicalName: 'Technical Leadership',
    slug: 'technical-leadership',
    category: 'interpersonal',
    aliases: ['tech lead', 'engineering leadership', 'technical management'],
  },
  {
    canonicalName: 'Stakeholder Management',
    slug: 'stakeholder-management',
    category: 'interpersonal',
    aliases: ['stakeholder communication', 'executive communication', 'stakeholder engagement'],
  },
  {
    canonicalName: 'Conflict Resolution',
    slug: 'conflict-resolution',
    category: 'interpersonal',
    aliases: ['mediation', 'negotiation', 'dispute resolution'],
  },
  {
    canonicalName: 'Persuasion',
    slug: 'persuasion',
    category: 'interpersonal',
    aliases: ['influence', 'influencing skills', 'convincing people'],
  },
  {
    canonicalName: 'Human Behavior',
    slug: 'human-behavior',
    category: 'interpersonal',
    aliases: [
      'human behaviour',
      'behavioral psychology',
      'cognitive psychology',
      'psychology',
      'social psychology',
      'consumer behavior',
      'human factors',
    ],
  },
  {
    canonicalName: 'Research',
    slug: 'research',
    category: 'interpersonal',
    aliases: [
      'research skills',
      'qualitative research',
      'quantitative research',
      'technical research',
    ],
  },
  {
    canonicalName: 'Teaching',
    slug: 'teaching',
    category: 'interpersonal',
    aliases: ['instruction', 'training', 'education'],
  },
  {
    canonicalName: 'Problem Solving',
    slug: 'problem-solving',
    category: 'interpersonal',
    aliases: ['analytical thinking', 'critical thinking'],
  },
  {
    canonicalName: 'Motivation',
    slug: 'motivation',
    category: 'interpersonal',
    aliases: ['self-motivation', 'team motivation'],
  },

  // ──────────────────────────────────────────────
  // Interpersonal - Languages
  // ──────────────────────────────────────────────
  {
    canonicalName: 'English',
    slug: 'english',
    category: 'interpersonal',
    aliases: ['english language', 'english proficiency'],
  },
  {
    canonicalName: 'French',
    slug: 'french',
    category: 'interpersonal',
    aliases: ['français', 'french language'],
  },
  {
    canonicalName: 'Spanish',
    slug: 'spanish',
    category: 'interpersonal',
    aliases: ['espagnol', 'español', 'spanish language'],
  },

  // ──────────────────────────────────────────────
  // Community
  // ──────────────────────────────────────────────
  {
    canonicalName: 'Community Strategy',
    slug: 'community-strategy',
    category: 'community',
    aliases: ['community development', 'community program management', 'community programs'],
  },
  {
    canonicalName: 'Community Building',
    slug: 'community-building',
    category: 'community',
    aliases: ['building communities', 'community growth', 'audience building'],
  },
  {
    canonicalName: 'Community Management',
    slug: 'community-management',
    category: 'community',
    aliases: ['online community management', 'community operations', 'community mangement'],
  },
  {
    canonicalName: 'Community Engagement',
    slug: 'community-engagement',
    category: 'community',
    aliases: ['member engagement', 'community activation', 'community outreach'],
  },
  {
    canonicalName: 'Developer Relations',
    slug: 'developer-relations',
    category: 'community',
    aliases: [
      'devrel',
      'developer advocacy',
      'developer evangelism',
      'technology evangelism',
      'tech evangelism',
    ],
  },
  {
    canonicalName: 'Content Moderation',
    slug: 'content-moderation',
    category: 'community',
    aliases: ['platform moderation', 'trust and safety', 'content policy enforcement'],
  },
  {
    canonicalName: 'Platform Integrity',
    slug: 'platform-integrity',
    category: 'community',
    aliases: [
      'platform safety',
      'platform health',
      'platform trust',
      'eula enforcement',
      'policy enforcement',
      'policy administration',
    ],
  },
  {
    canonicalName: 'Open Source',
    slug: 'open-source',
    category: 'community',
    aliases: [
      'open source development',
      'open source software',
      'oss',
      'foss',
      'open-source contribution',
    ],
  },
  {
    canonicalName: 'Event Management',
    slug: 'event-management',
    category: 'community',
    aliases: ['event planning', 'conference management', 'meetup organization'],
  },

  // ──────────────────────────────────────────────
  // Security
  // ──────────────────────────────────────────────
  {
    canonicalName: 'Cybersecurity',
    slug: 'cybersecurity',
    category: 'security',
    aliases: [
      'cyber security',
      'information security',
      'infosec',
      'information security (infosec)',
      'account security',
      'cia triad',
    ],
  },
  {
    canonicalName: 'Network Security',
    slug: 'network-security',
    category: 'security',
    aliases: ['network protection', 'firewall management', 'network defense', 'perimeter security'],
  },
  {
    canonicalName: 'Incident Response',
    slug: 'incident-response',
    category: 'security',
    aliases: ['incident management', 'incident resolution', 'security incident management'],
  },
  {
    canonicalName: 'Vulnerability Management',
    slug: 'vulnerability-management',
    category: 'security',
    aliases: ['vulnerability assessment', 'patch management', 'security patching'],
  },
  {
    canonicalName: 'Threat Intelligence',
    slug: 'threat-intelligence',
    category: 'security',
    aliases: ['cyber threat intelligence', 'threat analysis', 'threat intelligence (transferable)'],
  },
  {
    canonicalName: 'Security Auditing',
    slug: 'security-auditing',
    category: 'security',
    aliases: [
      'security audit',
      'security auditing (internal)',
      'internal audits',
      'audit documentation',
      'compliance auditing',
    ],
  },
  {
    canonicalName: 'Identity and Access Management',
    slug: 'identity-and-access-management',
    category: 'security',
    aliases: [
      'iam',
      'identity and access management (iam)',
      'access management',
      'privileged access management',
      'pam',
    ],
  },
  {
    canonicalName: 'SIEM',
    slug: 'siem',
    category: 'security',
    aliases: [
      'security information and event management',
      'siem (security information and event management)',
      'splunk',
      'chronicle',
    ],
  },
  {
    canonicalName: 'Network Administration',
    slug: 'network-administration',
    category: 'security',
    aliases: ['network management', 'network infrastructure', 'networking'],
  },
  {
    canonicalName: 'ITSM',
    slug: 'itsm',
    category: 'security',
    aliases: [
      'it service management',
      'information technology service management (itsm)',
      'service desk',
      'help desk',
    ],
  },
  {
    canonicalName: 'Endpoint Management',
    slug: 'endpoint-management',
    category: 'security',
    aliases: ['device management', 'mdm', 'mobile device management', 'endpoint security'],
  },
  {
    canonicalName: 'Penetration Testing',
    slug: 'penetration-testing',
    category: 'security',
    aliases: ['pen testing', 'ethical hacking', 'security testing'],
  },
  {
    canonicalName: 'Compliance Frameworks',
    slug: 'compliance-frameworks',
    category: 'security',
    aliases: [
      'nist',
      'nist cybersecurity framework (csf)',
      'iso 27001',
      'cissp domains',
      'security frameworks',
    ],
  },
  {
    canonicalName: 'Technical Support',
    slug: 'technical-support',
    category: 'security',
    aliases: [
      'it support',
      'helpdesk',
      'technical troubleshooting',
      'application support',
      'desktop support',
    ],
  },
  {
    canonicalName: 'Remote Monitoring and Management',
    slug: 'remote-monitoring-management',
    category: 'security',
    aliases: [
      'rmm',
      'remote management & monitoring (rmm)',
      'remote monitoring & management (rmm)',
      'kaseya',
      'connectwise',
      'autotask',
      'it glue',
    ],
  },
  {
    canonicalName: 'Packet Analysis',
    slug: 'packet-analysis',
    category: 'security',
    aliases: ['wireshark', 'tcpdump', 'network analysis', 'suricata', 'packet capture'],
  },
  {
    canonicalName: 'Intrusion Detection',
    slug: 'intrusion-detection',
    category: 'security',
    aliases: ['ids', 'intrusion detection systems (ids)', 'intrusion prevention', 'ips'],
  },
  {
    canonicalName: 'Digital Rights Management',
    slug: 'digital-rights-management',
    category: 'security',
    aliases: ['drm', 'digital rights management (drm)', 'content rights management'],
  },
  {
    canonicalName: 'Medical Devices',
    slug: 'medical-devices',
    category: 'security',
    aliases: [
      'medical device regulation (mdr)',
      'medical device regulation',
      'iec 62304',
      'iso 13485',
      'mdr compliance',
      'medical device r&d',
    ],
  },
  {
    canonicalName: 'Computer Forensics',
    slug: 'computer-forensics',
    category: 'security',
    aliases: ['digital forensics', 'forensic analysis'],
  },
  {
    canonicalName: 'Public Safety',
    slug: 'public-safety',
    category: 'security',
    aliases: ['public safety communications', 'emergency management'],
  },
];

async function seedSkills(db: Database) {
  logger.info({ count: SKILLS.length }, 'Seeding canonical skills');

  let inserted = 0;
  let updated = 0;

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
      .onConflictDoUpdate({
        target: canonicalSkills.slug,
        set: {
          aliases: skill.aliases,
          category: skill.category,
          wikidataId: skill.wikidataId ?? null,
          updatedAt: new Date(),
        },
      });

    if (result.rowCount && result.rowCount > 0) {
      // Can't distinguish insert from update via rowCount alone, but both are 1
      inserted++;
    }
  }

  // Check how many were truly new vs updated
  updated = 0; // logged as total upserted
  logger.info({ upserted: inserted }, 'Skill seeding complete');
}

/**
 * Re-resolve unresolved skills against the updated canonical skills list.
 * For each unresolved skill, check slug match then alias match.
 * If matched, mark as resolved.
 */
async function resolveUnresolvedSkills(db: Database) {
  const pending = await db
    .select()
    .from(unresolvedSkills)
    .where(isNull(unresolvedSkills.resolvedAt));

  logger.info({ count: pending.length }, 'Attempting to resolve unresolved skills');

  let resolved = 0;
  let remaining = 0;

  for (const skill of pending) {
    const normalized = normalizeSkillName(skill.rawName);
    const slug = createSlug(skill.rawName);

    // 1. Check slug match
    const bySlug = await db
      .select()
      .from(canonicalSkills)
      .where(sql`${canonicalSkills.slug} = ${slug}`)
      .limit(1);

    if (bySlug[0]) {
      await db
        .update(unresolvedSkills)
        .set({
          resolvedAt: new Date(),
          resolvedToId: bySlug[0].id,
        })
        .where(sql`${unresolvedSkills.id} = ${skill.id}`);
      resolved++;
      continue;
    }

    // 2. Check alias match
    const byAlias = await db
      .select()
      .from(canonicalSkills)
      .where(sql`${normalized} = ANY(${canonicalSkills.aliases})`)
      .limit(1);

    if (byAlias[0]) {
      await db
        .update(unresolvedSkills)
        .set({
          resolvedAt: new Date(),
          resolvedToId: byAlias[0].id,
        })
        .where(sql`${unresolvedSkills.id} = ${skill.id}`);
      resolved++;
      continue;
    }

    remaining++;
    logger.debug({ rawName: skill.rawName, normalized }, 'Still unresolved');
  }

  logger.info({ resolved, remaining }, 'Unresolved skill resolution complete');
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const db = createDb(databaseUrl);

  await seedSkills(db);
  await resolveUnresolvedSkills(db);

  await db.$client.end();
}

main().catch((error: unknown) => {
  logger.error(error, 'Failed to seed skills');
  process.exit(1);
});
