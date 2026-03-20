export function normalizeUrl(url: string): string {
  let normalized = url.toLowerCase();
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');
  normalized = normalized.replace(/\/+$/, '');
  return normalized;
}

const PLATFORM_EXTRACTORS: Record<string, (url: URL) => string | null> = {
  github: (url) => {
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[0] ?? null;
  },
  linkedin: (url) => {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'in' && parts[1]) return parts[1];
    return null;
  },
  twitter: (url) => {
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[0] ?? null;
  },
  instagram: (url) => {
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[0] ?? null;
  },
  youtube: (url) => {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'channel' && parts[1]) return parts[1];
    if (parts[0]?.startsWith('@')) return parts[0];
    return null;
  },
  fediverse: (url) => {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0]?.startsWith('@')) return `${parts[0]}@${url.hostname}`;
    return null;
  },
};

export function extractPlatformUsername(platform: string, url: string): string | null {
  const normalizedPlatform = platform.toLowerCase();
  const extractor = PLATFORM_EXTRACTORS[normalizedPlatform];
  if (!extractor) return null;

  try {
    let parsableUrl = url;
    if (!/^https?:\/\//i.test(parsableUrl)) {
      parsableUrl = `https://${parsableUrl}`;
    }
    return extractor(new URL(parsableUrl));
  } catch {
    return null;
  }
}
