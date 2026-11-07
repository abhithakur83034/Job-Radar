/**
 * Shared skill vocabulary for résumé parsing and match scoring, so both recognise
 * the same skills under the same names.
 *
 * Each entry: canonical key (lowercase) -> display name + other spellings seen in
 * résumés and job posts.
 */
export const SKILLS = {
  // Languages
  javascript: { name: 'JavaScript', aliases: ['js', 'ecmascript', 'es6'] },
  typescript: { name: 'TypeScript', aliases: ['ts'] },
  python: { name: 'Python', aliases: [] },
  java: { name: 'Java', aliases: [] },
  golang: { name: 'Go', aliases: ['go lang'] },
  'c#': { name: 'C#', aliases: ['csharp', 'c sharp'] },
  'c++': { name: 'C++', aliases: ['cpp'] },
  rust: { name: 'Rust', aliases: [] },
  ruby: { name: 'Ruby', aliases: [] },
  php: { name: 'PHP', aliases: [] },
  kotlin: { name: 'Kotlin', aliases: [] },
  swift: { name: 'Swift', aliases: [] },
  scala: { name: 'Scala', aliases: [] },
  dart: { name: 'Dart', aliases: [] },
  sql: { name: 'SQL', aliases: [] },
  'html/css': { name: 'HTML/CSS', aliases: ['html5', 'css3', 'html', 'css'] },
  // Frontend
  react: { name: 'React', aliases: ['react.js', 'reactjs', 'react js'] },
  'next.js': { name: 'Next.js', aliases: ['nextjs', 'next js'] },
  'react native': { name: 'React Native', aliases: ['react-native'] },
  vue: { name: 'Vue', aliases: ['vue.js', 'vuejs'] },
  angular: { name: 'Angular', aliases: ['angularjs', 'angular.js'] },
  svelte: { name: 'Svelte', aliases: ['sveltekit'] },
  redux: { name: 'Redux', aliases: ['redux toolkit'] },
  'tailwind css': { name: 'Tailwind CSS', aliases: ['tailwind', 'tailwindcss'] },
  sass: { name: 'Sass', aliases: ['scss'] },
  webpack: { name: 'Webpack', aliases: [] },
  vite: { name: 'Vite', aliases: [] },
  flutter: { name: 'Flutter', aliases: [] },
  // Backend
  'node.js': { name: 'Node.js', aliases: ['node', 'nodejs', 'node js'] },
  express: { name: 'Express', aliases: ['express.js', 'expressjs'] },
  nestjs: { name: 'NestJS', aliases: ['nest.js', 'nest js'] },
  django: { name: 'Django', aliases: [] },
  flask: { name: 'Flask', aliases: [] },
  fastapi: { name: 'FastAPI', aliases: [] },
  spring: { name: 'Spring Boot', aliases: ['spring boot', 'springboot'] },
  '.net': { name: '.NET', aliases: ['dotnet', 'asp.net'] },
  rails: { name: 'Ruby on Rails', aliases: ['ruby on rails', 'ror'] },
  laravel: { name: 'Laravel', aliases: [] },
  graphql: { name: 'GraphQL', aliases: ['graph ql'] },
  rest: { name: 'REST APIs', aliases: ['restful', 'rest api', 'rest apis'] },
  grpc: { name: 'gRPC', aliases: [] },
  microservices: { name: 'Microservices', aliases: ['micro-services', 'microservice'] },
  // Data stores & messaging
  postgresql: { name: 'PostgreSQL', aliases: ['postgres', 'psql'] },
  mysql: { name: 'MySQL', aliases: ['my sql'] },
  mongodb: { name: 'MongoDB', aliases: ['mongo', 'mongoose'] },
  redis: { name: 'Redis', aliases: [] },
  elasticsearch: { name: 'Elasticsearch', aliases: ['elastic search', 'opensearch'] },
  dynamodb: { name: 'DynamoDB', aliases: [] },
  kafka: { name: 'Kafka', aliases: ['apache kafka'] },
  rabbitmq: { name: 'RabbitMQ', aliases: [] },
  // Cloud & DevOps
  aws: { name: 'AWS', aliases: ['amazon web services'] },
  gcp: { name: 'GCP', aliases: ['google cloud', 'google cloud platform'] },
  azure: { name: 'Azure', aliases: ['microsoft azure'] },
  docker: { name: 'Docker', aliases: [] },
  kubernetes: { name: 'Kubernetes', aliases: ['k8s'] },
  terraform: { name: 'Terraform', aliases: [] },
  'ci/cd': { name: 'CI/CD', aliases: ['cicd', 'ci cd', 'continuous integration'] },
  'github actions': { name: 'GitHub Actions', aliases: [] },
  jenkins: { name: 'Jenkins', aliases: [] },
  linux: { name: 'Linux', aliases: [] },
  git: { name: 'Git', aliases: [] },
  // Testing
  jest: { name: 'Jest', aliases: [] },
  vitest: { name: 'Vitest', aliases: [] },
  cypress: { name: 'Cypress', aliases: [] },
  playwright: { name: 'Playwright', aliases: [] },
  // Data / ML
  'machine learning': { name: 'Machine Learning', aliases: ['ml'] },
  'artificial intelligence': { name: 'AI', aliases: ['ai'] },
  pandas: { name: 'pandas', aliases: [] },
  pytorch: { name: 'PyTorch', aliases: [] },
  tensorflow: { name: 'TensorFlow', aliases: [] },
  spark: { name: 'Spark', aliases: ['apache spark', 'pyspark'] },
  llm: { name: 'LLMs', aliases: ['llms', 'large language models'] },
  rag: { name: 'RAG', aliases: ['retrieval augmented generation', 'retrieval-augmented generation'] },
  'system design': { name: 'System Design', aliases: [] },
  // Product management
  'product management': { name: 'Product Management', aliases: [] },
  'product strategy': { name: 'Product Strategy', aliases: ['product vision'] },
  roadmapping: { name: 'Roadmapping', aliases: ['roadmap', 'roadmaps', 'product roadmap', 'product roadmaps'] },
  'product discovery': { name: 'Product Discovery', aliases: [] },
  prd: { name: 'PRDs', aliases: ['prds', 'product requirements', 'product requirement documents', 'product requirements documents'] },
  'user stories': { name: 'User Stories', aliases: ['user story'] },
  okrs: { name: 'OKRs', aliases: ['okr'] },
  prioritization: { name: 'Prioritization', aliases: ['prioritisation', 'rice', 'moscow'] },
  'go-to-market': { name: 'Go-to-Market', aliases: ['go to market', 'gtm'] },
  'pricing strategy': { name: 'Pricing Strategy', aliases: ['pricing and packaging'] },
  'stakeholder management': { name: 'Stakeholder Management', aliases: [] },
  'user research': { name: 'User Research', aliases: ['user interviews', 'customer interviews'] },
  'usability testing': { name: 'Usability Testing', aliases: [] },
  wireframing: { name: 'Wireframing', aliases: ['wireframes', 'wireframe'] },
  'a/b testing': { name: 'A/B Testing', aliases: ['a/b tests', 'a/b test', 'ab testing', 'split testing', 'experimentation'] },
  'product analytics': { name: 'Product Analytics', aliases: ['funnel analysis', 'cohort analysis'] },
  // Delivery and collaboration
  agile: { name: 'Agile', aliases: [] },
  scrum: { name: 'Scrum', aliases: [] },
  kanban: { name: 'Kanban', aliases: [] },
  jira: { name: 'Jira', aliases: [] },
  confluence: { name: 'Confluence', aliases: [] },
  figma: { name: 'Figma', aliases: [] },
  // Analytics and BI tools
  mixpanel: { name: 'Mixpanel', aliases: [] },
  amplitude: { name: 'Amplitude', aliases: [] },
  'google analytics': { name: 'Google Analytics', aliases: ['ga4', 'google analytics 4'] },
  looker: { name: 'Looker', aliases: [] },
  metabase: { name: 'Metabase', aliases: [] },
  tableau: { name: 'Tableau', aliases: [] },
  'power bi': { name: 'Power BI', aliases: ['powerbi'] },
};

const ALIAS_LOOKUP = new Map();
for (const [canonical, { name, aliases }] of Object.entries(SKILLS)) {
  for (const n of [canonical, name.toLowerCase(), ...aliases]) ALIAS_LOOKUP.set(n, canonical);
}

/** Canonical key for a skill, so "Node.js" and "nodejs" count as the same skill. */
export function canonicalSkill(term) {
  const key = String(term).trim().toLowerCase().replace(/\s+/g, ' ');
  return ALIAS_LOOKUP.get(key) ?? key;
}

/** Display name for a canonical skill key (falls back to the key). */
export function skillDisplayName(canonical) {
  return SKILLS[canonical]?.name ?? canonical;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const patternCache = new Map();
/**
 * Whole-word, case-insensitive regex for a skill and its spellings. Word boundaries
 * also work for names with symbols (c#, .net, node.js), and a preceding "." blocks
 * matches like the "js" inside "Node.js".
 */
export function skillPattern(canonical) {
  if (!patternCache.has(canonical)) {
    const entry = SKILLS[canonical];
    const names = [...new Set([canonical, ...(entry ? [entry.name.toLowerCase(), ...entry.aliases] : [])])]
      .sort((a, b) => b.length - a.length)
      .map((n) => escapeRegex(n).replace(/\\?\s+/g, '[\\s-]?'));
    patternCache.set(canonical, new RegExp(`(?<![a-z0-9+#.])(?:${names.join('|')})(?![a-z0-9+#]|\\.[a-z])`, 'i'));
  }
  return patternCache.get(canonical);
}

/** All skills from the vocabulary found in a text, as display names. */
export function findSkillsInText(text) {
  return Object.keys(SKILLS)
    .filter((canonical) => skillPattern(canonical).test(text))
    .map(skillDisplayName);
}
