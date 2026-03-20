export interface ProfileSource {
  headline: string | null;
  about: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ProfileOverride {
  headline: string | null;
  about: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ResolvedProfileFields {
  headline: string | null;
  about: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  hasHeadlineOverride: boolean;
  hasAboutOverride: boolean;
  hasDisplayNameOverride: boolean;
  hasAvatarUrlOverride: boolean;
}

/**
 * Resolve profile fields with overrides.
 * Override takes precedence; null override means "use source."
 */
export function resolveProfileFields(
  source: ProfileSource,
  override: ProfileOverride,
): ResolvedProfileFields {
  return {
    headline: override.headline ?? source.headline,
    about: override.about ?? source.about,
    displayName: override.displayName ?? source.displayName,
    avatarUrl: override.avatarUrl ?? source.avatarUrl,
    hasHeadlineOverride: override.headline !== null,
    hasAboutOverride: override.about !== null,
    hasDisplayNameOverride: override.displayName !== null,
    hasAvatarUrlOverride: override.avatarUrl !== null,
  };
}
