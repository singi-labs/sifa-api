/**
 * Post templates for the "Profile of the Day" Bluesky posts.
 *
 * Each template contains a `{displayName}` placeholder that gets replaced
 * with the featured user's display name. The final post appends a handle
 * mention and link card separately.
 */

export const FEATURED_TEMPLATES: readonly string[] = [
  "Today's featured profile on Sifa: {displayName} 👋",
  "{displayName} is today's Sifa profile of the day 🔍",
  "Meet {displayName}, today's featured profile on Sifa ✨",
  'Have you connected with {displayName} yet? Featured on Sifa today 👀',
  '{displayName} is our Sifa profile of the day 🌟',
  "Check out {displayName}'s profile on Sifa today 🔗",
  "Get to know {displayName}, today's featured Sifa profile 🧑‍💻",
  '{displayName} is front and center on Sifa today 📌',
  "Worth a look: {displayName} is today's featured Sifa profile 👇",
  '{displayName} on Sifa today ☀️',
  '{displayName} got our attention. Profile of the day on Sifa 👀',
  "{displayName} is today's Sifa pick 🎯",
  'One profile, one day: {displayName} on Sifa 📍',
  "Go explore {displayName}'s profile on Sifa 🔎",
  '{displayName}. Check out their Sifa profile today 💬',
  "Who is {displayName}? Today's featured profile on Sifa 🤔",
  'Featured today on Sifa: {displayName} ✨',
  "Today we're featuring {displayName} on Sifa 📣",
  '{displayName} is doing cool stuff. See their Sifa profile 🛠️',
  'Say hi to {displayName}, featured on Sifa today 👋',
  'Our pick of the day on Sifa: {displayName} 🎯',
  'Someone worth following: {displayName}, featured on Sifa 🙌',
  "{displayName} is today's Sifa profile of the day 🥇",
  '{displayName} is on the move. See their Sifa profile 🚶',
  "Check out {displayName}'s path so far on Sifa 📄",
  'New day, new featured profile. Say hello to {displayName} on Sifa 🌅',
  'Looking for someone interesting? {displayName} on Sifa today 👀',
  '{displayName} is featured on the decentralized professional network today 🌐',
  "{displayName}, today's profile of the day on Sifa. Go take a look 👇",
  '{displayName} is featured on Sifa today 🔵',
  'Featuring {displayName} on Sifa today. Worth a visit 🏠',
  "Today on Sifa, it's all about {displayName} ☀️",
  "Today's featured Sifa profile: {displayName} 📋",
  'Building in public, growing in the open. Today: {displayName} 🌱',
  '{displayName} on Sifa today. Go check it out 👉',
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
