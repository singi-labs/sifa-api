import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';

export interface StorageService {
  store(data: Buffer, mimeType: string, prefix: string): Promise<string>;
  delete(url: string): Promise<void>;
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function createLocalStorage(
  uploadDir: string,
  baseUrl: string,
  logger: Pick<FastifyBaseLogger, 'debug'>,
): StorageService {
  return {
    async store(data: Buffer, mimeType: string, prefix: string): Promise<string> {
      const ext = MIME_TO_EXT[mimeType] ?? '.bin';
      const filename = `${prefix}-${randomUUID()}${ext}`;
      const dir = join(uploadDir, prefix);
      await mkdir(dir, { recursive: true });
      const filepath = join(dir, filename);
      await writeFile(filepath, data);
      logger.debug({ filepath, size: data.length }, 'File stored');
      return `${baseUrl}/uploads/${prefix}/${filename}`;
    },

    async delete(url: string): Promise<void> {
      try {
        const uploadsIdx = url.indexOf('/uploads/');
        if (uploadsIdx === -1) return;
        const relativePath = url.slice(uploadsIdx + '/uploads/'.length);
        const filepath = join(uploadDir, relativePath);
        await unlink(filepath);
        logger.debug({ filepath }, 'File deleted');
      } catch {
        // Best-effort deletion
      }
    },
  };
}
