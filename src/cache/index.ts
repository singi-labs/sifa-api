import { Redis } from 'ioredis';

export function createValkey(url: string) {
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
}

export type ValkeyClient = Redis;
