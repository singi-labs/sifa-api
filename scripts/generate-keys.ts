import * as jose from 'jose';
import { writeFileSync, mkdirSync } from 'node:fs';

async function generateKeys() {
  mkdirSync('./keys', { recursive: true });
  const { publicKey, privateKey } = await jose.generateKeyPair('ES256', { extractable: true });
  const publicJwk = await jose.exportJWK(publicKey);
  const privateJwk = await jose.exportJWK(privateKey);
  const kid = await jose.calculateJwkThumbprint(publicJwk);

  const jwks = {
    keys: [{ ...publicJwk, kid, use: 'sig', alg: 'ES256' }],
  };

  writeFileSync('./keys/jwks.json', JSON.stringify(jwks, null, 2));
  writeFileSync(
    './keys/private-key.json',
    JSON.stringify({ ...privateJwk, kid, use: 'sig', alg: 'ES256' }, null, 2),
  );

  console.log('Keys generated in ./keys/');
}

generateKeys();
