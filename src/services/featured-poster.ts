import type { AtpAgent } from '@atproto/api';
import type { FastifyBaseLogger } from 'fastify';
import { FEATURED_TEMPLATES, pickTemplate, renderTemplate } from '../lib/featured-templates.js';

export interface BuildFeaturedPostInput {
  displayName: string;
  handle: string;
  did: string;
  dateStr: string;
  profileUrl: string;
}

export interface PostRecord {
  text: string;
  facets: Array<{
    index: { byteStart: number; byteEnd: number };
    features: Array<{ $type: string; did: string }>;
  }>;
  embed: {
    $type: 'app.bsky.embed.external';
    external: { uri: string; title: string; description: string };
  };
  createdAt: string;
}

export function buildFeaturedPost(input: BuildFeaturedPostInput): PostRecord {
  const { displayName, handle, did, dateStr, profileUrl } = input;

  const templateIndex = pickTemplate(dateStr);
  const template = FEATURED_TEMPLATES[templateIndex];
  if (!template) {
    throw new Error(`No template found at index ${String(templateIndex)}`);
  }

  const renderedText = renderTemplate(template, displayName, handle);
  const mentionSuffix = `@${handle}`;
  const fullText = `${renderedText}\n\n${mentionSuffix}`;

  const encoder = new TextEncoder();
  const fullBytes = encoder.encode(fullText);
  const mentionBytes = encoder.encode(mentionSuffix);
  const byteStart = fullBytes.length - mentionBytes.length;
  const byteEnd = fullBytes.length;

  return {
    text: fullText,
    facets: [
      {
        index: { byteStart, byteEnd },
        features: [{ $type: 'app.bsky.richtext.facet#mention', did }],
      },
    ],
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: profileUrl,
        title: `${displayName} on Sifa`,
        description: `Check out ${displayName}'s professional profile on Sifa.`,
      },
    },
    createdAt: new Date().toISOString(),
  };
}

export async function postToBluesky(
  agent: AtpAgent,
  post: PostRecord,
  log: FastifyBaseLogger,
): Promise<boolean> {
  try {
    await agent.post({ ...post });
    log.info('Featured profile post published to Bluesky');
    return true;
  } catch (err) {
    log.error({ err }, 'Failed to publish featured profile post to Bluesky');
    return false;
  }
}
