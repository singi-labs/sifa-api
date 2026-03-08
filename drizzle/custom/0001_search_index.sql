CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_profiles_search
  ON profiles
  USING GIN (
    to_tsvector('english',
      coalesce(handle, '') || ' ' ||
      coalesce(headline, '') || ' ' ||
      coalesce(about, '')
    )
  );

CREATE INDEX IF NOT EXISTS idx_skills_name_trgm
  ON skills
  USING GIN (skill_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_positions_company_trgm
  ON positions
  USING GIN (company_name gin_trgm_ops);
