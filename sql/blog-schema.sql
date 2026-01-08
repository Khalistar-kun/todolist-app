-- ============================================================================
-- BLOG CMS DATABASE SCHEMA FOR TODOAPP
-- ============================================================================
-- Description: Comprehensive blog content management system with SEO support
-- Features: Posts, Categories, Tags, FAQs, Media Library, View Tracking
-- Database: PostgreSQL (Supabase)
-- Version: 1.0
-- Created: 2025-11-18
-- ============================================================================
--
-- INSTALLATION INSTRUCTIONS:
-- 1. Open Supabase Dashboard > SQL Editor
-- 2. Create a new query
-- 3. Copy and paste this entire file
-- 4. Click "Run" to execute
-- 5. Verify all tables are created in the Table Editor
--
-- FEATURES:
-- - Complete SEO support (meta tags, OG images, JSON-LD schema)
-- - Many-to-many relationships (categories, tags)
-- - Draft/Published workflow with scheduling
-- - View counting and analytics
-- - Media library with usage tracking
-- - FAQ sections for posts
-- - Table of contents (JSONB)
-- - Reading time calculation
-- - Slug generation and uniqueness
-- - Full-text search ready
-- - Row Level Security (RLS) policies
-- - Automatic timestamp management
-- - Mobile-first optimized indexes
--
-- ============================================================================

-- Enable required extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm; -- For full-text search

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

-- Post status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'post_status') then
    create type post_status as enum ('draft', 'published', 'scheduled', 'archived');
  end if;
exception when duplicate_object then null;
end$$;

-- Media type enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'media_type') then
    create type media_type as enum ('image', 'video', 'document', 'audio', 'other');
  end if;
exception when duplicate_object then null;
end$$;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Blog Categories
-- ----------------------------------------------------------------------------
create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  parent_id uuid references public.blog_categories(id) on delete set null,
  -- SEO fields
  meta_title text,
  meta_description text,
  -- Metadata
  post_count integer not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- Indexes for blog_categories
create index if not exists idx_blog_categories_slug on public.blog_categories(slug);
create index if not exists idx_blog_categories_parent on public.blog_categories(parent_id) where parent_id is not null;
create index if not exists idx_blog_categories_active on public.blog_categories(is_active) where is_active = true;
create index if not exists idx_blog_categories_sort on public.blog_categories(sort_order, name);

comment on table public.blog_categories is 'Blog post categories with hierarchical support';
comment on column public.blog_categories.parent_id is 'Support for nested/hierarchical categories';
comment on column public.blog_categories.post_count is 'Denormalized count for performance';

-- ----------------------------------------------------------------------------
-- Blog Tags
-- ----------------------------------------------------------------------------
create table if not exists public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  -- Metadata
  post_count integer not null default 0,
  color text, -- Hex color code for UI (e.g., #FF5733)
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for blog_tags
create index if not exists idx_blog_tags_slug on public.blog_tags(slug);
create index if not exists idx_blog_tags_name on public.blog_tags using gin(name gin_trgm_ops);
create index if not exists idx_blog_tags_post_count on public.blog_tags(post_count desc);

comment on table public.blog_tags is 'Blog post tags for flexible categorization';
comment on column public.blog_tags.color is 'Optional hex color for tag badges in UI';

-- ----------------------------------------------------------------------------
-- Blog Media Library
-- ----------------------------------------------------------------------------
create table if not exists public.blog_media (
  id uuid primary key default gen_random_uuid(),
  -- File information
  filename text not null,
  original_filename text not null,
  file_path text not null, -- Path in storage bucket
  file_url text not null, -- Public URL
  mime_type text not null,
  file_size integer not null, -- Size in bytes
  media_type media_type not null default 'other',
  -- Image-specific fields
  width integer,
  height integer,
  alt_text text,
  caption text,
  -- Metadata
  title text,
  description text,
  usage_count integer not null default 0, -- How many posts use this media
  -- SEO
  seo_title text,
  -- Storage bucket info
  bucket_name text not null default 'blog-media',
  -- Timestamps
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for blog_media
create index if not exists idx_blog_media_type on public.blog_media(media_type);
create index if not exists idx_blog_media_uploaded_by on public.blog_media(uploaded_by);
create index if not exists idx_blog_media_created on public.blog_media(created_at desc);
create index if not exists idx_blog_media_filename on public.blog_media using gin(filename gin_trgm_ops);
create index if not exists idx_blog_media_usage on public.blog_media(usage_count desc);

comment on table public.blog_media is 'Centralized media library for blog content';
comment on column public.blog_media.usage_count is 'Tracks how many posts reference this media';

-- ----------------------------------------------------------------------------
-- Blog Posts (Main Content Table)
-- ----------------------------------------------------------------------------
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  -- Core content
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null,
  -- Featured media
  featured_image_id uuid references public.blog_media(id) on delete set null,
  featured_image_url text, -- Denormalized for performance
  featured_image_alt text,
  -- Author
  author_id uuid references auth.users(id) on delete set null,
  author_name text, -- Denormalized for performance
  -- Status and publishing
  status post_status not null default 'draft',
  published_at timestamptz,
  scheduled_for timestamptz,
  -- SEO fields
  meta_title text,
  meta_description text,
  og_title text,
  og_description text,
  og_image_url text,
  canonical_url text,
  -- Structured data (JSON-LD)
  schema_markup jsonb, -- Store schema.org Article markup
  -- Table of contents
  table_of_contents jsonb, -- Array of {id, level, title, anchor}
  -- Analytics
  view_count integer not null default 0,
  reading_time_minutes integer, -- Calculated based on content length
  -- Engagement
  allow_comments boolean not null default true,
  comment_count integer not null default 0,
  -- Featured/pinned
  is_featured boolean not null default false,
  is_pinned boolean not null default false,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_viewed_at timestamptz
);

-- Indexes for blog_posts
create index if not exists idx_blog_posts_slug on public.blog_posts(slug);
create index if not exists idx_blog_posts_status on public.blog_posts(status);
create index if not exists idx_blog_posts_author on public.blog_posts(author_id);
create index if not exists idx_blog_posts_published on public.blog_posts(published_at desc) where status = 'published';
create index if not exists idx_blog_posts_featured on public.blog_posts(is_featured) where is_featured = true;
create index if not exists idx_blog_posts_pinned on public.blog_posts(is_pinned) where is_pinned = true;
create index if not exists idx_blog_posts_scheduled on public.blog_posts(scheduled_for) where status = 'scheduled';
create index if not exists idx_blog_posts_views on public.blog_posts(view_count desc);
create index if not exists idx_blog_posts_title_search on public.blog_posts using gin(title gin_trgm_ops);
create index if not exists idx_blog_posts_content_search on public.blog_posts using gin(content gin_trgm_ops);
-- Composite index for listing published posts
create index if not exists idx_blog_posts_list on public.blog_posts(status, published_at desc, is_pinned desc);

comment on table public.blog_posts is 'Main blog posts table with comprehensive SEO and analytics';
comment on column public.blog_posts.schema_markup is 'JSON-LD structured data for rich snippets';
comment on column public.blog_posts.table_of_contents is 'Auto-generated TOC from content headings';
comment on column public.blog_posts.reading_time_minutes is 'Calculated: ~200 words per minute';

-- ----------------------------------------------------------------------------
-- Blog Post Categories (Junction Table)
-- ----------------------------------------------------------------------------
create table if not exists public.blog_post_categories (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  category_id uuid not null references public.blog_categories(id) on delete cascade,
  is_primary boolean not null default false, -- One primary category per post
  created_at timestamptz not null default now(),
  -- Ensure unique post-category pairs
  unique(post_id, category_id)
);

-- Indexes for blog_post_categories
create index if not exists idx_blog_post_categories_post on public.blog_post_categories(post_id);
create index if not exists idx_blog_post_categories_category on public.blog_post_categories(category_id);
create index if not exists idx_blog_post_categories_primary on public.blog_post_categories(post_id, is_primary) where is_primary = true;

comment on table public.blog_post_categories is 'Many-to-many relationship between posts and categories';
comment on column public.blog_post_categories.is_primary is 'Each post should have one primary category';

-- ----------------------------------------------------------------------------
-- Blog Post Tags (Junction Table)
-- ----------------------------------------------------------------------------
create table if not exists public.blog_post_tags (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  tag_id uuid not null references public.blog_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Ensure unique post-tag pairs
  unique(post_id, tag_id)
);

-- Indexes for blog_post_tags
create index if not exists idx_blog_post_tags_post on public.blog_post_tags(post_id);
create index if not exists idx_blog_post_tags_tag on public.blog_post_tags(tag_id);

comment on table public.blog_post_tags is 'Many-to-many relationship between posts and tags';

-- ----------------------------------------------------------------------------
-- Blog FAQs
-- ----------------------------------------------------------------------------
create table if not exists public.blog_faqs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  -- SEO - FAQ schema markup
  schema_markup jsonb, -- Store schema.org FAQPage/Question markup
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for blog_faqs
create index if not exists idx_blog_faqs_post on public.blog_faqs(post_id, sort_order);
create index if not exists idx_blog_faqs_active on public.blog_faqs(post_id, is_active) where is_active = true;

comment on table public.blog_faqs is 'FAQ sections for blog posts with schema.org support';
comment on column public.blog_faqs.schema_markup is 'FAQ schema for rich snippets in search';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Generate slug from text
-- ----------------------------------------------------------------------------
create or replace function generate_slug(text_input text)
returns text as $$
declare
  slug text;
begin
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  slug := lower(trim(text_input));
  slug := regexp_replace(slug, '[^a-z0-9\s-]', '', 'g');
  slug := regexp_replace(slug, '\s+', '-', 'g');
  slug := regexp_replace(slug, '-+', '-', 'g');
  slug := trim(both '-' from slug);
  return slug;
end;
$$ language plpgsql immutable;

comment on function generate_slug is 'Converts text to URL-friendly slug format';

-- ----------------------------------------------------------------------------
-- Calculate reading time
-- ----------------------------------------------------------------------------
create or replace function calculate_reading_time(content_text text)
returns integer as $$
declare
  word_count integer;
  reading_time integer;
begin
  -- Count words (split by whitespace)
  word_count := array_length(regexp_split_to_array(content_text, '\s+'), 1);
  -- Average reading speed: 200 words per minute
  reading_time := ceiling(word_count::float / 200.0);
  -- Minimum 1 minute
  if reading_time < 1 then
    reading_time := 1;
  end if;
  return reading_time;
end;
$$ language plpgsql immutable;

comment on function calculate_reading_time is 'Calculates reading time based on ~200 words/minute';

-- ----------------------------------------------------------------------------
-- Increment view count
-- ----------------------------------------------------------------------------
create or replace function increment_post_views(post_id_input uuid)
returns void as $$
begin
  update public.blog_posts
  set
    view_count = view_count + 1,
    last_viewed_at = now()
  where id = post_id_input;
end;
$$ language plpgsql;

comment on function increment_post_views is 'Safely increment post view count';

-- ----------------------------------------------------------------------------
-- Update category post count
-- ----------------------------------------------------------------------------
create or replace function update_category_post_count()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update public.blog_categories
    set post_count = post_count + 1
    where id = NEW.category_id;
  elsif (TG_OP = 'DELETE') then
    update public.blog_categories
    set post_count = post_count - 1
    where id = OLD.category_id and post_count > 0;
  end if;
  return null;
end;
$$ language plpgsql;

comment on function update_category_post_count is 'Maintains denormalized post count in categories';

-- ----------------------------------------------------------------------------
-- Update tag post count
-- ----------------------------------------------------------------------------
create or replace function update_tag_post_count()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update public.blog_tags
    set post_count = post_count + 1
    where id = NEW.tag_id;
  elsif (TG_OP = 'DELETE') then
    update public.blog_tags
    set post_count = post_count - 1
    where id = OLD.tag_id and post_count > 0;
  end if;
  return null;
end;
$$ language plpgsql;

comment on function update_tag_post_count is 'Maintains denormalized post count in tags';

-- ----------------------------------------------------------------------------
-- Update media usage count
-- ----------------------------------------------------------------------------
create or replace function update_media_usage_count()
returns trigger as $$
begin
  -- Handle featured image changes
  if (TG_OP = 'INSERT' or TG_OP = 'UPDATE') then
    if NEW.featured_image_id is not null then
      update public.blog_media
      set usage_count = (
        select count(*) from public.blog_posts
        where featured_image_id = NEW.featured_image_id
      )
      where id = NEW.featured_image_id;
    end if;

    -- Decrement old featured image if changed
    if (TG_OP = 'UPDATE' and OLD.featured_image_id is not null and
        OLD.featured_image_id != NEW.featured_image_id) then
      update public.blog_media
      set usage_count = (
        select count(*) from public.blog_posts
        where featured_image_id = OLD.featured_image_id
      )
      where id = OLD.featured_image_id;
    end if;
  elsif (TG_OP = 'DELETE' and OLD.featured_image_id is not null) then
    update public.blog_media
    set usage_count = (
      select count(*) from public.blog_posts
      where featured_image_id = OLD.featured_image_id
    )
    where id = OLD.featured_image_id;
  end if;

  return null;
end;
$$ language plpgsql;

comment on function update_media_usage_count is 'Tracks how many posts use each media file';

-- ----------------------------------------------------------------------------
-- Auto-generate slug if not provided
-- ----------------------------------------------------------------------------
create or replace function auto_generate_slug()
returns trigger as $$
declare
  base_slug text;
  final_slug text;
  counter integer := 0;
begin
  -- Only generate if slug is null or empty
  if NEW.slug is null or trim(NEW.slug) = '' then
    base_slug := generate_slug(NEW.name);
    final_slug := base_slug;

    -- Check for uniqueness and append counter if needed
    if TG_TABLE_NAME = 'blog_categories' then
      while exists (select 1 from public.blog_categories where slug = final_slug and id != coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) loop
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
      end loop;
    elsif TG_TABLE_NAME = 'blog_tags' then
      while exists (select 1 from public.blog_tags where slug = final_slug and id != coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) loop
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
      end loop;
    end if;

    NEW.slug := final_slug;
  end if;

  return NEW;
end;
$$ language plpgsql;

comment on function auto_generate_slug is 'Auto-generates unique slug from name if not provided';

-- ----------------------------------------------------------------------------
-- Auto-generate post slug from title
-- ----------------------------------------------------------------------------
create or replace function auto_generate_post_slug()
returns trigger as $$
declare
  base_slug text;
  final_slug text;
  counter integer := 0;
begin
  -- Only generate if slug is null or empty
  if NEW.slug is null or trim(NEW.slug) = '' then
    base_slug := generate_slug(NEW.title);
    final_slug := base_slug;

    -- Ensure uniqueness
    while exists (select 1 from public.blog_posts where slug = final_slug and id != coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) loop
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    end loop;

    NEW.slug := final_slug;
  end if;

  return NEW;
end;
$$ language plpgsql;

comment on function auto_generate_post_slug is 'Auto-generates unique slug from post title';

-- ----------------------------------------------------------------------------
-- Auto-calculate reading time
-- ----------------------------------------------------------------------------
create or replace function auto_calculate_reading_time()
returns trigger as $$
begin
  NEW.reading_time_minutes := calculate_reading_time(NEW.content);
  return NEW;
end;
$$ language plpgsql;

comment on function auto_calculate_reading_time is 'Auto-calculates reading time on insert/update';

-- ----------------------------------------------------------------------------
-- Set published_at timestamp
-- ----------------------------------------------------------------------------
create or replace function set_published_at()
returns trigger as $$
begin
  -- Set published_at when status changes to published
  if NEW.status = 'published' and (OLD is null or OLD.status != 'published') then
    NEW.published_at := coalesce(NEW.published_at, now());
  end if;

  return NEW;
end;
$$ language plpgsql;

comment on function set_published_at is 'Auto-sets published_at when post is published';

-- ----------------------------------------------------------------------------
-- Denormalize author name
-- ----------------------------------------------------------------------------
create or replace function denormalize_author_info()
returns trigger as $$
begin
  if NEW.author_id is not null then
    select full_name into NEW.author_name
    from public.profiles
    where id = NEW.author_id;

    -- Fallback to email if full_name is null
    if NEW.author_name is null then
      select email into NEW.author_name
      from public.profiles
      where id = NEW.author_id;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql;

comment on function denormalize_author_info is 'Denormalizes author name for performance';

-- ----------------------------------------------------------------------------
-- Denormalize featured image info
-- ----------------------------------------------------------------------------
create or replace function denormalize_featured_image()
returns trigger as $$
begin
  if NEW.featured_image_id is not null then
    select file_url, alt_text
    into NEW.featured_image_url, NEW.featured_image_alt
    from public.blog_media
    where id = NEW.featured_image_id;
  else
    NEW.featured_image_url := null;
    NEW.featured_image_alt := null;
  end if;

  return NEW;
end;
$$ language plpgsql;

comment on function denormalize_featured_image is 'Denormalizes featured image data for performance';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Reuse existing updated_at trigger function from main schema
-- (set_updated_at function already exists)

-- Blog Categories
drop trigger if exists blog_categories_updated_at on public.blog_categories;
create trigger blog_categories_updated_at
  before update on public.blog_categories
  for each row execute function set_updated_at();

drop trigger if exists blog_categories_auto_slug on public.blog_categories;
create trigger blog_categories_auto_slug
  before insert or update on public.blog_categories
  for each row execute function auto_generate_slug();

-- Blog Tags
drop trigger if exists blog_tags_updated_at on public.blog_tags;
create trigger blog_tags_updated_at
  before update on public.blog_tags
  for each row execute function set_updated_at();

drop trigger if exists blog_tags_auto_slug on public.blog_tags;
create trigger blog_tags_auto_slug
  before insert or update on public.blog_tags
  for each row execute function auto_generate_slug();

-- Blog Media
drop trigger if exists blog_media_updated_at on public.blog_media;
create trigger blog_media_updated_at
  before update on public.blog_media
  for each row execute function set_updated_at();

-- Blog Posts
drop trigger if exists blog_posts_updated_at on public.blog_posts;
create trigger blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function set_updated_at();

drop trigger if exists blog_posts_auto_slug on public.blog_posts;
create trigger blog_posts_auto_slug
  before insert or update on public.blog_posts
  for each row execute function auto_generate_post_slug();

drop trigger if exists blog_posts_reading_time on public.blog_posts;
create trigger blog_posts_reading_time
  before insert or update on public.blog_posts
  for each row execute function auto_calculate_reading_time();

drop trigger if exists blog_posts_published_at on public.blog_posts;
create trigger blog_posts_published_at
  before insert or update on public.blog_posts
  for each row execute function set_published_at();

drop trigger if exists blog_posts_author_info on public.blog_posts;
create trigger blog_posts_author_info
  before insert or update on public.blog_posts
  for each row execute function denormalize_author_info();

drop trigger if exists blog_posts_featured_image on public.blog_posts;
create trigger blog_posts_featured_image
  before insert or update on public.blog_posts
  for each row execute function denormalize_featured_image();

drop trigger if exists blog_posts_media_usage on public.blog_posts;
create trigger blog_posts_media_usage
  after insert or update or delete on public.blog_posts
  for each row execute function update_media_usage_count();

-- Blog Post Categories (junction)
drop trigger if exists blog_post_categories_count on public.blog_post_categories;
create trigger blog_post_categories_count
  after insert or delete on public.blog_post_categories
  for each row execute function update_category_post_count();

-- Blog Post Tags (junction)
drop trigger if exists blog_post_tags_count on public.blog_post_tags;
create trigger blog_post_tags_count
  after insert or delete on public.blog_post_tags
  for each row execute function update_tag_post_count();

-- Blog FAQs
drop trigger if exists blog_faqs_updated_at on public.blog_faqs;
create trigger blog_faqs_updated_at
  before update on public.blog_faqs
  for each row execute function set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
alter table public.blog_categories enable row level security;
alter table public.blog_tags enable row level security;
alter table public.blog_media enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_post_categories enable row level security;
alter table public.blog_post_tags enable row level security;
alter table public.blog_faqs enable row level security;

-- ----------------------------------------------------------------------------
-- Blog Categories Policies
-- ----------------------------------------------------------------------------

-- Public read access for active categories
create policy "Categories are publicly readable"
  on public.blog_categories for select
  to anon, authenticated
  using (is_active = true);

-- Authenticated users can create categories
create policy "Authenticated users can create categories"
  on public.blog_categories for insert
  to authenticated
  with check (true);

-- Users can update their own categories or if they're admin
create policy "Users can update categories"
  on public.blog_categories for update
  to authenticated
  using (created_by = auth.uid());

-- Users can delete their own categories
create policy "Users can delete categories"
  on public.blog_categories for delete
  to authenticated
  using (created_by = auth.uid());

-- ----------------------------------------------------------------------------
-- Blog Tags Policies
-- ----------------------------------------------------------------------------

-- Public read access for all tags
create policy "Tags are publicly readable"
  on public.blog_tags for select
  to anon, authenticated
  using (true);

-- Authenticated users can create tags
create policy "Authenticated users can create tags"
  on public.blog_tags for insert
  to authenticated
  with check (true);

-- Authenticated users can update tags
create policy "Authenticated users can update tags"
  on public.blog_tags for update
  to authenticated
  using (true);

-- Authenticated users can delete tags
create policy "Authenticated users can delete tags"
  on public.blog_tags for delete
  to authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- Blog Media Policies
-- ----------------------------------------------------------------------------

-- Public read access for all media
create policy "Media is publicly readable"
  on public.blog_media for select
  to anon, authenticated
  using (true);

-- Authenticated users can upload media
create policy "Authenticated users can upload media"
  on public.blog_media for insert
  to authenticated
  with check (true);

-- Users can update their own media
create policy "Users can update their own media"
  on public.blog_media for update
  to authenticated
  using (uploaded_by = auth.uid());

-- Users can delete their own media
create policy "Users can delete their own media"
  on public.blog_media for delete
  to authenticated
  using (uploaded_by = auth.uid());

-- ----------------------------------------------------------------------------
-- Blog Posts Policies
-- ----------------------------------------------------------------------------

-- Public read access for published posts only
create policy "Published posts are publicly readable"
  on public.blog_posts for select
  to anon, authenticated
  using (status = 'published' and published_at <= now());

-- Authors can read their own drafts
create policy "Authors can read their own posts"
  on public.blog_posts for select
  to authenticated
  using (author_id = auth.uid());

-- Authenticated users can create posts
create policy "Authenticated users can create posts"
  on public.blog_posts for insert
  to authenticated
  with check (author_id = auth.uid());

-- Authors can update their own posts
create policy "Authors can update their own posts"
  on public.blog_posts for update
  to authenticated
  using (author_id = auth.uid());

-- Authors can delete their own posts
create policy "Authors can delete their own posts"
  on public.blog_posts for delete
  to authenticated
  using (author_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Blog Post Categories Policies (Junction)
-- ----------------------------------------------------------------------------

-- Public read for published posts
create policy "Post categories are publicly readable"
  on public.blog_post_categories for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.blog_posts
      where id = post_id and status = 'published'
    )
  );

-- Authors can read their own post categories
create policy "Authors can read their own post categories"
  on public.blog_post_categories for select
  to authenticated
  using (
    exists (
      select 1 from public.blog_posts
      where id = post_id and author_id = auth.uid()
    )
  );

-- Authors can manage their own post categories
create policy "Authors can manage their own post categories"
  on public.blog_post_categories for all
  to authenticated
  using (
    exists (
      select 1 from public.blog_posts
      where id = post_id and author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.blog_posts
      where id = post_id and author_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- Blog Post Tags Policies (Junction)
-- ----------------------------------------------------------------------------

-- Public read for published posts
create policy "Post tags are publicly readable"
  on public.blog_post_tags for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.blog_posts
      where id = post_id and status = 'published'
    )
  );

-- Authors can read their own post tags
create policy "Authors can read their own post tags"
  on public.blog_post_tags for select
  to authenticated
  using (
    exists (
      select 1 from public.blog_posts
      where id = post_id and author_id = auth.uid()
    )
  );

-- Authors can manage their own post tags
create policy "Authors can manage their own post tags"
  on public.blog_post_tags for all
  to authenticated
  using (
    exists (
      select 1 from public.blog_posts
      where id = post_id and author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.blog_posts
      where id = post_id and author_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- Blog FAQs Policies
-- ----------------------------------------------------------------------------

-- Public read for active FAQs of published posts
create policy "FAQs are publicly readable"
  on public.blog_faqs for select
  to anon, authenticated
  using (
    is_active = true and
    exists (
      select 1 from public.blog_posts
      where id = post_id and status = 'published'
    )
  );

-- Authors can read their own post FAQs
create policy "Authors can read their own post FAQs"
  on public.blog_faqs for select
  to authenticated
  using (
    exists (
      select 1 from public.blog_posts
      where id = post_id and author_id = auth.uid()
    )
  );

-- Authors can manage their own post FAQs
create policy "Authors can manage their own post FAQs"
  on public.blog_faqs for all
  to authenticated
  using (
    exists (
      select 1 from public.blog_posts
      where id = post_id and author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.blog_posts
      where id = post_id and author_id = auth.uid()
    )
  );

-- ============================================================================
-- HELPFUL VIEWS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Published Posts with Full Details
-- ----------------------------------------------------------------------------
create or replace view public.blog_posts_published as
select
  p.*,
  -- Primary category
  (
    select c.name
    from public.blog_categories c
    join public.blog_post_categories pc on pc.category_id = c.id
    where pc.post_id = p.id and pc.is_primary = true
    limit 1
  ) as primary_category,
  -- All categories as array
  (
    select array_agg(c.name order by c.name)
    from public.blog_categories c
    join public.blog_post_categories pc on pc.category_id = c.id
    where pc.post_id = p.id
  ) as categories,
  -- All tags as array
  (
    select array_agg(t.name order by t.name)
    from public.blog_tags t
    join public.blog_post_tags pt on pt.tag_id = t.id
    where pt.post_id = p.id
  ) as tags,
  -- FAQ count
  (
    select count(*)
    from public.blog_faqs f
    where f.post_id = p.id and f.is_active = true
  ) as faq_count
from public.blog_posts p
where p.status = 'published' and p.published_at <= now();

comment on view public.blog_posts_published is 'Published posts with denormalized categories, tags, and counts';

-- ============================================================================
-- SAMPLE DATA (Optional - Comment out if not needed)
-- ============================================================================

-- Sample category
insert into public.blog_categories (name, slug, description, meta_title, meta_description)
values
  ('Productivity', 'productivity', 'Tips and tricks for staying productive',
   'Productivity Tips | TodoApp Blog', 'Discover productivity tips and task management strategies'),
  ('Updates', 'updates', 'Product updates and announcements',
   'TodoApp Updates | Product News', 'Latest updates and new features from TodoApp')
on conflict (slug) do nothing;

-- Sample tag
insert into public.blog_tags (name, slug, description, color)
values
  ('Getting Started', 'getting-started', 'Beginner-friendly content', '#3B82F6'),
  ('Advanced', 'advanced', 'Advanced tips and techniques', '#EF4444'),
  ('Tutorial', 'tutorial', 'Step-by-step tutorials', '#10B981')
on conflict (slug) do nothing;

-- ============================================================================
-- POST-INSTALLATION VERIFICATION
-- ============================================================================

-- Run these queries to verify installation:
--
-- 1. Check all tables exist:
--    SELECT table_name FROM information_schema.tables
--    WHERE table_schema = 'public' AND table_name LIKE 'blog_%';
--
-- 2. Check all indexes:
--    SELECT tablename, indexname FROM pg_indexes
--    WHERE schemaname = 'public' AND tablename LIKE 'blog_%';
--
-- 3. Check all triggers:
--    SELECT trigger_name, event_object_table FROM information_schema.triggers
--    WHERE trigger_schema = 'public' AND event_object_table LIKE 'blog_%';
--
-- 4. Check all RLS policies:
--    SELECT schemaname, tablename, policyname FROM pg_policies
--    WHERE schemaname = 'public' AND tablename LIKE 'blog_%';
--
-- ============================================================================
-- MAINTENANCE QUERIES
-- ============================================================================

-- Recalculate all post counts for categories:
-- UPDATE blog_categories c SET post_count = (
--   SELECT COUNT(*) FROM blog_post_categories pc WHERE pc.category_id = c.id
-- );

-- Recalculate all post counts for tags:
-- UPDATE blog_tags t SET post_count = (
--   SELECT COUNT(*) FROM blog_post_tags pt WHERE pt.tag_id = t.id
-- );

-- Recalculate all media usage counts:
-- UPDATE blog_media m SET usage_count = (
--   SELECT COUNT(*) FROM blog_posts p WHERE p.featured_image_id = m.id
-- );

-- Recalculate all reading times:
-- UPDATE blog_posts SET reading_time_minutes = calculate_reading_time(content);

-- ============================================================================
-- SCHEMA INSTALLATION COMPLETE
-- ============================================================================

-- Congratulations! Your blog CMS schema is now installed.
--
-- Next steps:
-- 1. Create storage bucket: Go to Storage > Create bucket > "blog-media"
-- 2. Set bucket to public if needed
-- 3. Create your first blog post through the application
-- 4. Monitor performance with the indexes
-- 5. Adjust RLS policies based on your admin user setup
--
-- For questions or issues, refer to the comments throughout this file.
-- ============================================================================
