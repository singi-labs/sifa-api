export interface ProfileSource {
  headline: string | null;
  about: string | null;
}

export interface ProfileOverride {
  headline: string | null;
  about: string | null;
}

export interface ResolvedProfileFields {
  headline: string | null;
  about: string | null;
  hasHeadlineOverride: boolean;
  hasAboutOverride: boolean;
}

/**
 * Resolve profile headline and about fields.
 * Override takes precedence; null override means "use source."
 */
export function resolveProfileFields(
  source: ProfileSource,
  override: ProfileOverride,
): ResolvedProfileFields {
  return {
    headline: override.headline ?? source.headline,
    about: override.about ?? source.about,
    hasHeadlineOverride: override.headline !== null,
    hasAboutOverride: override.about !== null,
  };
}
