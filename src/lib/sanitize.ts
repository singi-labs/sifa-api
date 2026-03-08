import DOMPurify from 'isomorphic-dompurify';

export function sanitize(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}

export function sanitizeOptional(input: string | undefined | null): string | undefined {
  if (input == null) return undefined;
  return sanitize(input);
}
