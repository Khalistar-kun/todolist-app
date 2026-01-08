-- ============================================================================
-- FIX BLOG SCHEMA - Add missing columns to existing tables
-- ============================================================================

-- First, drop and recreate the tables cleanly
DROP TABLE IF EXISTS public.blog_post_tags CASCADE;
DROP TABLE IF EXISTS public.blog_post_categories CASCADE;
DROP TABLE IF EXISTS public.blog_faqs CASCADE;
DROP TABLE IF EXISTS public.blog_posts CASCADE;
DROP TABLE IF EXISTS public.blog_media CASCADE;
DROP TABLE IF EXISTS public.blog_tags CASCADE;
DROP TABLE IF EXISTS public.blog_categories CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS post_status CASCADE;
DROP TYPE IF EXISTS media_type CASCADE;

-- Create custom types
CREATE TYPE post_status AS ENUM ('draft', 'published', 'scheduled', 'archived');
CREATE TYPE media_type AS ENUM ('image', 'video', 'document', 'audio', 'other');

-- ============================================================================
-- Blog Categories
-- ============================================================================
CREATE TABLE public.blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  meta_title TEXT,
  meta_description TEXT,
  post_count INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_blog_categories_slug ON public.blog_categories(slug);
CREATE INDEX idx_blog_categories_parent ON public.blog_categories(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_blog_categories_active ON public.blog_categories(is_active) WHERE is_active = true;
CREATE INDEX idx_blog_categories_sort ON public.blog_categories(sort_order, name);

-- ============================================================================
-- Blog Tags
-- ============================================================================
CREATE TABLE public.blog_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT,
  post_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_blog_tags_name ON public.blog_tags(name);
CREATE INDEX idx_blog_tags_post_count ON public.blog_tags(post_count DESC);

-- ============================================================================
-- Blog Media
-- ============================================================================
CREATE TABLE public.blog_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  media_type media_type NOT NULL DEFAULT 'image',
  alt_text TEXT,
  caption TEXT,
  width INTEGER,
  height INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blog_media_uploaded_by ON public.blog_media(uploaded_by);
CREATE INDEX idx_blog_media_created ON public.blog_media(created_at DESC);
CREATE INDEX idx_blog_media_filename ON public.blog_media(filename);
CREATE INDEX idx_blog_media_usage ON public.blog_media(usage_count DESC);

-- ============================================================================
-- Blog Posts
-- ============================================================================
CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image TEXT,
  status post_status NOT NULL DEFAULT 'draft',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  view_count INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  og_image TEXT,
  og_title TEXT,
  og_description TEXT,
  table_of_contents JSONB,
  schema_markup JSONB,
  reading_time_minutes INTEGER,
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT,
  author_avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX idx_blog_posts_author ON public.blog_posts(author_id);
CREATE INDEX idx_blog_posts_published ON public.blog_posts(published_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX idx_blog_posts_featured ON public.blog_posts(is_featured) WHERE is_featured = true;
CREATE INDEX idx_blog_posts_pinned ON public.blog_posts(is_pinned) WHERE is_pinned = true;
CREATE INDEX idx_blog_posts_scheduled ON public.blog_posts(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_blog_posts_views ON public.blog_posts(view_count DESC);
CREATE INDEX idx_blog_posts_title_search ON public.blog_posts USING gin(to_tsvector('english', title || ' ' || COALESCE(excerpt, '') || ' ' || content));

-- ============================================================================
-- Blog Post Categories (Junction Table)
-- ============================================================================
CREATE TABLE public.blog_post_categories (
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.blog_categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (post_id, category_id)
);

CREATE INDEX idx_blog_post_categories_category ON public.blog_post_categories(category_id);
CREATE INDEX idx_blog_post_categories_primary ON public.blog_post_categories(is_primary) WHERE is_primary = true;

-- ============================================================================
-- Blog Post Tags (Junction Table)
-- ============================================================================
CREATE TABLE public.blog_post_tags (
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_blog_post_tags_tag ON public.blog_post_tags(tag_id);

-- ============================================================================
-- Blog FAQs
-- ============================================================================
CREATE TABLE public.blog_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blog_faqs_post ON public.blog_faqs(post_id, sort_order);
CREATE INDEX idx_blog_faqs_active ON public.blog_faqs(is_active) WHERE is_active = true;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Blog Categories: Public read, authenticated write
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blog categories are viewable by everyone" ON public.blog_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Authenticated users can create categories" ON public.blog_categories
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update categories" ON public.blog_categories
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Blog Tags: Public read, authenticated write
ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blog tags are viewable by everyone" ON public.blog_tags
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create tags" ON public.blog_tags
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update tags" ON public.blog_tags
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Blog Posts: Public read published, authenticated write
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published posts are viewable by everyone" ON public.blog_posts
  FOR SELECT USING (status = 'published' OR auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create posts" ON public.blog_posts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authors can update their own posts" ON public.blog_posts
  FOR UPDATE USING (auth.uid() = author_id OR auth.role() = 'authenticated');

CREATE POLICY "Authors can delete their own posts" ON public.blog_posts
  FOR DELETE USING (auth.uid() = author_id OR auth.role() = 'authenticated');

-- Blog Media: Public read, authenticated write
ALTER TABLE public.blog_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blog media is viewable by everyone" ON public.blog_media
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can upload media" ON public.blog_media
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Uploaders can update their media" ON public.blog_media
  FOR UPDATE USING (auth.uid() = uploaded_by OR auth.role() = 'authenticated');

CREATE POLICY "Uploaders can delete their media" ON public.blog_media
  FOR DELETE USING (auth.uid() = uploaded_by OR auth.role() = 'authenticated');

-- Junction tables
ALTER TABLE public.blog_post_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Post categories viewable by everyone" ON public.blog_post_categories FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage post categories" ON public.blog_post_categories FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE public.blog_post_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Post tags viewable by everyone" ON public.blog_post_tags FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage post tags" ON public.blog_post_tags FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE public.blog_faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FAQs viewable by everyone" ON public.blog_faqs FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can manage FAQs" ON public.blog_faqs FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_categories_updated_at BEFORE UPDATE ON public.blog_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER blog_tags_updated_at BEFORE UPDATE ON public.blog_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER blog_posts_updated_at BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER blog_faqs_updated_at BEFORE UPDATE ON public.blog_faqs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
