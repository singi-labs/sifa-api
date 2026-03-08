import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3100),
  PUBLIC_URL: z.string().url(),
  DATABASE_URL: z.string(),
  VALKEY_URL: z.string(),
  SIFA_DID: z.string().startsWith('did:'),
  JETSTREAM_URL: z.string().url(),
  OAUTH_JWKS_PATH: z.string(),
  GLITCHTIP_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${result.error.format()}`);
  }
  return result.data;
}
