import { readFileSync } from 'node:fs';
import * as jose from 'jose';

export interface JwksDocument {
  keys: jose.JWK[];
}

export function loadJwks(path: string): JwksDocument {
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as JwksDocument;
}

export function loadPrivateKey(path: string): jose.JWK {
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as jose.JWK;
}
