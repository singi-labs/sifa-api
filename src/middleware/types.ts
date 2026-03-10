import type { OAuthSession } from '@atproto/oauth-client';

declare module 'fastify' {
  interface FastifyRequest {
    did: string | null;
    oauthSession: OAuthSession | null;
  }
}
