/**
 * Post templates for the "Profile of the Day" Bluesky posts.
 *
 * Each template contains a `{displayName}` placeholder that gets replaced
 * with the featured user's display name. The final post appends a handle
 * mention and link card separately.
 */

export const FEATURED_TEMPLATES: readonly string[] = [
  "Today's featured professional on Sifa: {displayName}",
  "Spotlighting {displayName} as today's Sifa profile of the day",
  'Meet {displayName} -- our featured Sifa profile today',
  'Have you connected with {displayName} yet? Featured on Sifa today',
  '{displayName} is in the spotlight on Sifa today',
  'Discover the work of {displayName} -- featured on Sifa',
  "Get to know {displayName}, today's highlighted Sifa profile",
  'Putting {displayName} front and center on Sifa today',
  "Worth checking out: {displayName} is today's featured Sifa profile",
  'Shining a light on {displayName} today on Sifa',
  '{displayName} caught our attention. Featured profile of the day on Sifa',
  'Your daily dose of professional inspiration: {displayName} on Sifa',
  'One profile, one day: {displayName} on Sifa',
  "Take a moment to explore {displayName}'s profile on Sifa",
  'Big things from {displayName}. Check out their Sifa profile today',
  "Who is {displayName}? Find out on Sifa -- today's featured profile",
  'Featured today on Sifa: the work and journey of {displayName}',
  'Every day we highlight someone great. Today: {displayName}',
  '{displayName} brings something unique. See their Sifa profile',
  'Curious minds, meet {displayName} -- featured on Sifa today',
  'Our pick of the day on Sifa: {displayName}',
  'Here is someone worth following: {displayName}, featured on Sifa',
  "Celebrating {displayName} as today's Sifa profile of the day",
  '{displayName} is making moves. See their featured Sifa profile',
  'Professional journeys worth exploring -- starting with {displayName}',
  'New day, new featured profile. Say hello to {displayName} on Sifa',
  'Looking for inspiration? Check out {displayName} on Sifa today',
  'The decentralized professional network highlights {displayName} today',
  "{displayName} -- today's profile of the day on Sifa. Go take a look",
  'Another day, another standout. {displayName} is featured on Sifa',
  'We are highlighting {displayName} on Sifa today. Worth a visit',
  'Today on Sifa, the spotlight belongs to {displayName}',
  "Introducing today's featured Sifa profile: {displayName}",
  "Building in public, growing in the open. Today's feature: {displayName}",
  'Great profiles deserve attention. Today: {displayName} on Sifa',
] as const;

/**
 * Deterministic hash-based template picker. Same date string always
 * returns the same template index.
 */
export function pickTemplate(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    // Simple djb2-style hash
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  // Ensure positive index
  return Math.abs(hash) % FEATURED_TEMPLATES.length;
}

/**
 * Replaces `{displayName}` in the template string.
 */
export function renderTemplate(template: string, displayName: string, _handle: string): string {
  return template.replace('{displayName}', displayName);
}
