import WebSocket from 'ws';
import { logger } from '../logger.js';
import type { JetstreamEvent } from './types.js';

export const WANTED_COLLECTIONS = [
  'id.sifa.profile.self',
  'id.sifa.profile.position',
  'id.sifa.profile.education',
  'id.sifa.profile.skill',
  'id.sifa.profile.certification',
  'id.sifa.profile.project',
  'id.sifa.profile.volunteering',
  'id.sifa.profile.publication',
  'id.sifa.profile.course',
  'id.sifa.profile.honor',
  'id.sifa.profile.language',
  'id.sifa.endorsement',
  'id.sifa.endorsement.confirmation',
  'id.sifa.graph.follow',
] as const;

export function buildJetstreamUrl(baseUrl: string, cursor?: bigint): string {
  const url = new URL(baseUrl);
  for (const col of WANTED_COLLECTIONS) {
    url.searchParams.append('wantedCollections', col);
  }
  if (cursor !== undefined) {
    url.searchParams.set('cursor', cursor.toString());
  }
  return url.toString();
}

export interface JetstreamClientOptions {
  url: string;
  onEvent: (event: JetstreamEvent) => Promise<void>;
  onError?: (error: Error) => void;
  getCursor: () => Promise<bigint | undefined>;
}

export function createJetstreamClient(opts: JetstreamClientOptions) {
  let ws: WebSocket | null = null;
  let reconnectDelay = 1000;
  let running = false;

  async function connect() {
    running = true;
    const cursor = await opts.getCursor();
    const url = buildJetstreamUrl(opts.url, cursor);

    ws = new WebSocket(url);

    ws.on('open', () => {
      logger.info('Jetstream connected');
      reconnectDelay = 1000;
    });

    ws.on('message', (data: Buffer) => {
      void (async () => {
        try {
          const event = JSON.parse(data.toString()) as JetstreamEvent;
          await opts.onEvent(event);
        } catch (err) {
          logger.error({ err }, 'Failed to process Jetstream event');
        }
      })();
    });

    ws.on('close', () => {
      if (running) {
        logger.warn({ reconnectDelay }, 'Jetstream disconnected, reconnecting');
        setTimeout(() => { void connect(); }, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      }
    });

    ws.on('error', (err) => {
      logger.error({ err }, 'Jetstream WebSocket error');
      opts.onError?.(err);
    });
  }

  function disconnect() {
    running = false;
    ws?.close();
  }

  return { connect, disconnect };
}
