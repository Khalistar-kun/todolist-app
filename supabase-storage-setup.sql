-- Supabase Storage Setup for Blog Images
-- Run this in your Supabase SQL Editor

-- Note: Storage buckets cannot be created via SQL in Supabase
-- You must create the bucket manually in the Supabase Dashboard first:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Click "New Bucket"
-- 3. Name: blog-images
-- 4. Make it public: YES
-- 5. Click "Create Bucket"

-- After creating the bucket, run these policies:

-- Policy 1: Allow public read access to all images
CREATE POLICY "Public Access to Blog Images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'blog-images' );

-- Policy 2: Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload blog images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'blog-images'
);

-- Policy 3: Allow authenticated users to update their uploaded images
CREATE POLICY "Authenticated users can update blog images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'blog-images' )
WITH CHECK ( bucket_id = 'blog-images' );

-- Policy 4: Allow authenticated users to delete images
CREATE POLICY "Authenticated users can delete blog images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'blog-images' );

-- Verify the policies were created
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%blog%';
