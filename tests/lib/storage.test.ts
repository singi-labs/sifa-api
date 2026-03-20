import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createLocalStorage } from '../../src/lib/storage.js';

const TEST_DIR = join(import.meta.dirname, '../.test-uploads');
const BASE_URL = 'https://sifa.id';

const mockLogger = { debug: () => {} } as any;

describe('createLocalStorage', () => {
  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('stores a file and returns a public URL', async () => {
    const storage = createLocalStorage(TEST_DIR, BASE_URL, mockLogger);
    const data = Buffer.from('fake image data');
    const url = await storage.store(data, 'image/webp', 'avatars');

    expect(url).toMatch(/^https:\/\/sifa\.id\/uploads\/avatars\/avatars-[a-f0-9-]+\.webp$/);

    const relativePath = url.replace(`${BASE_URL}/uploads/`, '');
    expect(existsSync(join(TEST_DIR, relativePath))).toBe(true);
  });

  it('deletes a stored file', async () => {
    const storage = createLocalStorage(TEST_DIR, BASE_URL, mockLogger);
    const data = Buffer.from('fake image data');
    const url = await storage.store(data, 'image/webp', 'avatars');

    await storage.delete(url);

    const relativePath = url.replace(`${BASE_URL}/uploads/`, '');
    expect(existsSync(join(TEST_DIR, relativePath))).toBe(false);
  });

  it('uses correct extension for mime type', async () => {
    const storage = createLocalStorage(TEST_DIR, BASE_URL, mockLogger);
    const url = await storage.store(Buffer.from('x'), 'image/jpeg', 'avatars');
    expect(url).toMatch(/\.jpg$/);
  });

  it('handles delete of non-existent URL gracefully', async () => {
    const storage = createLocalStorage(TEST_DIR, BASE_URL, mockLogger);
    await expect(
      storage.delete('https://sifa.id/uploads/avatars/nonexistent.webp'),
    ).resolves.toBeUndefined();
  });
});
