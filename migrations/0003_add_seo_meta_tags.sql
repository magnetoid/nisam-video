CREATE TABLE IF NOT EXISTS "seo_meta_tags" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_url TEXT NOT NULL UNIQUE,
  page_type TEXT NOT NULL CHECK (page_type IN ('home', 'video', 'category', 'tag', 'custom')),
  title TEXT,
  description TEXT,
  keywords TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  twitter_title TEXT,
  twitter_description TEXT,
  twitter_image TEXT,
  canonical_url TEXT,
  schema_markup JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  seo_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "seo_meta_tags_page_type_idx" ON "seo_meta_tags" (page_type);
CREATE INDEX IF NOT EXISTS "seo_meta_tags_is_active_idx" ON "seo_meta_tags" (is_active);
CREATE INDEX IF NOT EXISTS "seo_meta_tags_created_at_idx" ON "seo_meta_tags" (created_at DESC);
CREATE INDEX IF NOT EXISTS "seo_meta_tags_page_url_idx" ON "seo_meta_tags" (page_url);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_seo_meta_tags_updated_at BEFORE UPDATE
  ON seo_meta_tags FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
