# TipTap WYSIWYG Editor - Complete Guide

## Overview

This is a complete, production-ready TipTap WYSIWYG editor for your blog CMS. It features a WordPress/Medium-style interface with the TodoApp orange branding (#FF9F66).

## Components Created

### 1. TipTapEditor (`/src/components/blog/editor/TipTapEditor.tsx`)
Main editor component with all extensions configured.

**Features:**
- StarterKit (basic formatting)
- Image support with styling
- Link support with custom styling
- Text alignment (left, center, right, justify)
- Table support with headers
- Placeholder text
- Syntax highlighting
- Custom callout blocks

**Props:**
```typescript
interface TipTapEditorProps {
  content: string         // HTML content to edit
  onChange: (html: string) => void  // Called when content changes
  placeholder?: string    // Placeholder text (default: "Start writing your post...")
}
```

### 2. EditorToolbar (`/src/components/blog/editor/EditorToolbar.tsx`)
Professional toolbar with all formatting controls.

**Features:**
- Undo/Redo
- Headings (H1-H6) dropdown
- Text formatting (Bold, Italic, Strike, Code)
- Lists (Bullet, Numbered)
- Text alignment (Left, Center, Right, Justify)
- Link insertion with URL input
- Image upload button
- Table insertion
- Callout blocks (Info, Warning, Success, Error)

### 3. ImageUploadButton (`/src/components/blog/editor/ImageUploadButton.tsx`)
Image upload component with Supabase Storage integration.

**Features:**
- File picker with image validation
- 5MB file size limit
- Image preview before upload
- Alt text input for accessibility
- Upload to Supabase Storage (`blog-images` bucket)
- Automatic insertion at cursor position

### 4. CalloutExtension (`/src/components/blog/editor/CalloutExtension.ts`)
Custom TipTap extension for alert/callout blocks.

**Callout Types:**
- `info` - Blue background, info icon
- `warning` - Yellow background, warning icon
- `success` - Green background, success icon
- `error` - Red background, error icon

### 5. New Post Page (`/src/app/admin/posts/new/page.tsx`)
Complete post creation interface.

**Features:**
- Large title input
- Auto-generated slug (editable)
- TipTap rich text editor
- Featured image upload
- Excerpt textarea
- Category selection
- Tag input (comma-separated)
- SEO section (meta title, meta description, OG image)
- FAQ builder with add/remove functionality
- Live preview modal
- Auto-save every 30 seconds
- Save draft button
- Publish button

### 6. Edit Post Page (`/src/app/admin/posts/[id]/page.tsx`)
Edit existing posts with all features from new post page.

**Additional Features:**
- Loads existing post data
- Delete post functionality
- Auto-save every 30 seconds
- Last saved timestamp

## Setup Requirements

### 1. Supabase Storage Bucket

You need to create a storage bucket in Supabase:

1. Go to Supabase Dashboard > Storage
2. Create a new bucket named: `blog-images`
3. Make it public (for image URLs to work)
4. Set the following bucket policies:

```sql
-- Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'blog-images' );

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'blog-images'
  AND auth.role() = 'authenticated'
);
```

### 2. Database Tables

Make sure you have these tables in Supabase:
- `blog_posts` - Main posts table
- `blog_categories` - Categories
- `blog_tags` - Tags
- `blog_post_tags` - Post-tag junction
- `blog_faqs` - FAQ items
- `blog_authors` - Author profiles

## Usage

### Creating a New Post

1. Navigate to `/admin/posts/new`
2. Enter a title (slug auto-generates)
3. Write content using the TipTap editor
4. Add featured image (optional)
5. Fill in excerpt, category, tags
6. Add SEO metadata (optional)
7. Add FAQs (optional)
8. Click "Save Draft" or set status to "Published" and click "Publish Now"

### Editing an Existing Post

1. Navigate to `/admin/posts/[id]` (click edit from posts list)
2. Make changes
3. Changes auto-save every 30 seconds
4. Click "Save Changes" to save immediately
5. Click "Delete" to remove the post

### Editor Features

#### Text Formatting
- **Bold**: Ctrl/Cmd + B
- **Italic**: Ctrl/Cmd + I
- **Strikethrough**: Ctrl/Cmd + Shift + X
- **Code**: Ctrl/Cmd + E

#### Headings
- Use the "Headings" dropdown to select H1-H6
- Or use markdown shortcuts: `# `, `## `, `### `, etc.

#### Lists
- Bullet list: Click bullet icon or type `- `
- Numbered list: Click numbered icon or type `1. `

#### Links
1. Select text
2. Click link icon
3. Enter URL
4. Click "Add"

#### Images
1. Click image icon
2. Select image file
3. Add alt text
4. Click "Insert Image"

#### Tables
1. Click table icon
2. 3x3 table with header row is inserted
3. Click cells to edit
4. Use toolbar to modify table

#### Callouts
1. Click "Callout" dropdown
2. Select type (Info, Warning, Success, Error)
3. Type content inside the callout block

### Auto-Save

The editor automatically saves every 30 seconds when:
- Title is not empty
- Content has changed

You'll see "Last saved: [time]" in the header.

## Styling & Customization

### Brand Colors

The editor uses the TodoApp orange theme:
- Primary: `#FF9F66`
- Hover: `#ff8a47`

### Mobile Responsive

All components are mobile-first and fully responsive:
- Toolbar wraps on small screens
- Editor adjusts font sizes
- Sidebar stacks below editor on mobile
- Preview modal is scrollable

### Custom Styling

To customize the editor appearance, edit the styles in:
- `/src/components/blog/editor/TipTapEditor.tsx` (editor content styles)
- `/src/app/globals.css` (global theme variables)

## Troubleshooting

### Images not uploading

1. Check Supabase Storage bucket exists: `blog-images`
2. Verify bucket is public
3. Check bucket policies allow authenticated uploads
4. Verify environment variables are set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Auto-save not working

1. Check browser console for errors
2. Verify Supabase connection
3. Ensure user is authenticated
4. Check blog_authors table has entry for user

### Preview not showing styles

The preview uses `dangerouslySetInnerHTML` with the prose class. Make sure Tailwind Typography plugin is installed and configured.

## File Structure

```
/src
├── components/
│   └── blog/
│       └── editor/
│           ├── TipTapEditor.tsx       # Main editor
│           ├── EditorToolbar.tsx      # Toolbar component
│           ├── ImageUploadButton.tsx  # Image upload
│           └── CalloutExtension.ts    # Callout blocks
│
└── app/
    └── admin/
        └── posts/
            ├── new/
            │   └── page.tsx           # Create post page
            └── [id]/
                └── page.tsx           # Edit post page
```

## API Integration

The editor integrates with your existing BlogService:

```typescript
// Save post
await BlogService.createPost(postData, authorId)

// Update post
await BlogService.updatePost(postId, updates)

// Delete post
await BlogService.deletePost(postId)
```

## Performance Notes

- Editor initializes quickly with minimal bundle size
- Images are lazy-loaded
- Auto-save is debounced to prevent excessive saves
- Preview modal renders on-demand

## Browser Support

Tested and working on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile Safari (iOS)
- Chrome Mobile (Android)

## Future Enhancements

Potential improvements you can add:
- Drag-and-drop image upload
- Markdown import/export
- Collaborative editing
- Version history
- Word count
- Reading time calculator
- Custom embed blocks (YouTube, Twitter, etc.)
- Color picker for text
- Font size controls

## Support

For issues or questions:
1. Check TipTap documentation: https://tiptap.dev/
2. Review component code comments
3. Test in development mode with console open
