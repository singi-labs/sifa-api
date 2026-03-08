import type { NodeSavedState, NodeSavedStateStore } from '@atproto/oauth-client-node';

/**
 * Valkey (Redis-compatible) backed state store for ATproto OAuth.
 * Implements the SimpleStore<string, NodeSavedState> interface required by NodeOAuthClient.
 *
 * OAuth authorization state is short-lived (10 minute TTL) so Valkey is a
 * natural fit -- no database writes needed for ephemeral data that expires
 * quickly.
 */
export class ValkeyStateStore implements NodeSavedStateStore {
  constructor(private valkey: ValkeyClient) {}

  async get(key: string): Promise<NodeSavedState | undefined> {
    const data = await this.valkey.get(`oauth-state:${key}`);
    return data ? (JSON.parse(data) as NodeSavedState) : undefined;
  }

  async set(key: string, val: NodeSavedState): Promise<void> {
    // 10 minute TTL -- OAuth state should be consumed quickly
    await this.valkey.set(`oauth-state:${key}`, JSON.stringify(val), 'EX', 600);
  }

  async del(key: string): Promise<void> {
    await this.valkey.del(`oauth-state:${key}`);
  }
}

/**
 * Minimal interface for a Redis/Valkey client. Compatible with ioredis and
 * node-redis. Using a structural type avoids coupling to a specific client
 * library.
 */
export interface ValkeyClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, exFlag: 'EX', seconds: number): Promise<unknown>;
  del(key: string | string[]): Promise<number>;
}
