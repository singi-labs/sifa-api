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
    aliases: ['py', 'python3'],
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
    aliases: ['rust-lang'],
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

  // Technical - Frontend
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
    canonicalName: 'HTML',
    slug: 'html',
    category: 'technical',
    aliases: ['html5'],
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

  // Technical - Backend / Infra
  {
    canonicalName: 'Node.js',
    slug: 'node-js',
    category: 'technical',
    aliases: ['nodejs', 'node'],
    wikidataId: 'Q756100',
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
    aliases: ['gql'],
    wikidataId: 'Q25104949',
  },
  {
    canonicalName: 'REST APIs',
    slug: 'rest-apis',
    category: 'technical',
    aliases: ['restful', 'rest', 'api design'],
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
    aliases: ['linux administration', 'unix'],
    wikidataId: 'Q388',
  },

  // Technical - Cloud
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

  // Technical - Data / ML
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
    aliases: ['structured query language'],
    wikidataId: 'Q47607',
  },

  // Technical - Testing / DevOps
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

  // Business
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
    aliases: ['product owner', 'product strategy'],
  },
  {
    canonicalName: 'Agile',
    slug: 'agile',
    category: 'business',
    aliases: ['scrum', 'kanban', 'agile methodology'],
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
    aliases: ['sales management', 'b2b sales', 'account management'],
  },

  // Creative
  {
    canonicalName: 'UI Design',
    slug: 'ui-design',
    category: 'creative',
    aliases: ['user interface design', 'ui'],
  },
  {
    canonicalName: 'UX Design',
    slug: 'ux-design',
    category: 'creative',
    aliases: ['user experience design', 'ux', 'ux research'],
  },
  {
    canonicalName: 'Graphic Design',
    slug: 'graphic-design',
    category: 'creative',
    aliases: ['visual design'],
  },
  {
    canonicalName: 'Copywriting',
    slug: 'copywriting',
    category: 'creative',
    aliases: ['content writing', 'technical writing'],
  },

  // Interpersonal
  {
    canonicalName: 'Leadership',
    slug: 'leadership',
    category: 'interpersonal',
    aliases: ['team leadership', 'people management'],
  },
  {
    canonicalName: 'Communication',
    slug: 'communication',
    category: 'interpersonal',
    aliases: ['public speaking', 'presentation skills'],
  },
  {
    canonicalName: 'Team Collaboration',
    slug: 'team-collaboration',
    category: 'interpersonal',
    aliases: ['teamwork', 'cross-functional collaboration'],
  },
  {
    canonicalName: 'Mentoring',
    slug: 'mentoring',
    category: 'interpersonal',
    aliases: ['coaching', 'mentorship'],
  },

  // Interpersonal - additional
  {
    canonicalName: 'Cross-functional Leadership',
    slug: 'cross-functional-leadership',
    category: 'interpersonal',
    aliases: [
      'cross-functional team leadership',
      'cross-functional management',
      'matrix management',
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
    aliases: ['influence', 'influencing skills'],
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

  // Community (new category)
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

  // Business - additional
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
    aliases: ['business process improvement', 'workflow optimization', 'operational efficiency'],
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
    aliases: ['sla management', 'service-level agreements', 'service level agreement'],
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
    aliases: ['cms', 'web content management', 'content management systems'],
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

  // Creative - additional
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

  // Technical - additional
  {
    canonicalName: 'Software Engineering',
    slug: 'software-engineering',
    category: 'technical',
    aliases: ['software development', 'programming', 'software design'],
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

  // Security (new category)
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
    ],
  },
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
