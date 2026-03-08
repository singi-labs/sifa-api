import type { FastifyRequest } from 'fastify';
import type { OAuthSession } from '@atproto/oauth-client';

/**
 * Fastify request augmented by the auth middleware with the authenticated
 * user's DID and their restored AT Protocol OAuth session.
 *
 * The OAuthSession provides a fetchHandler that can be used to make
 * authenticated requests to the user's PDS. Route handlers that need to
 * write to a PDS should pass this session to the PDS writer service.
 */
export interface AuthenticatedRequest extends FastifyRequest {
  did: string;
  session: OAuthSession;
}
