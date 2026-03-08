export interface JetstreamEvent {
  did: string;
  time_us: number;
  kind: 'commit' | 'identity' | 'account';
  commit?: {
    rev: string;
    operation: 'create' | 'update' | 'delete';
    collection: string;
    rkey: string;
    record?: Record<string, unknown>;
    cid?: string;
  };
  identity?: {
    did: string;
    handle: string;
  };
  account?: {
    active: boolean;
    did: string;
    status?: string;
  };
}
