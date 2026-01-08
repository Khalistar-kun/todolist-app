# SEO Features Quick Reference

Quick reference for developers implementing SEO features in blog posts.

---

## Table of Contents

### Import
```typescript
import { generateTOC, generateTOCServer } from '@/lib/blog/generateTOC'
import { TableOfContents } from '@/components/blog/TableOfContents'
```

### Generate TOC
```typescript
// Client-side
const { toc, updatedHtml } = generateTOC(post.content)

// Server-side (Next.js)
const { toc, updatedHtml } = generateTOCServer(post.content)
```

### Display TOC
```tsx
<TableOfContents items={toc} />
```

### Complete Example
```tsx
export default function BlogPost({ post }) {
  const { toc, updatedHtml } = generateTOC(post.content)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <article className="lg:col-span-3">
        <div dangerouslySetInnerHTML={{ __html: updatedHtml }} />
      </article>
      <aside className="lg:col-span-1">
        <TableOfContents items={toc} />
      </aside>
    </div>
  )
}
```

---

## FAQ Schema

### Import
```typescript
import {
  generateFAQSchemaFromBlogFAQs,
  generateEnhancedFAQSchema
} from '@/lib/blog/generateFAQSchema'
import { FAQSection } from '@/components/blog/FAQSection'
```

### Generate Schema
```typescript
// From database FAQs
const schema = generateFAQSchemaFromBlogFAQs(post.faqs)

// Enhanced with metadata
const schema = generateEnhancedFAQSchema(faqs, {
  pageUrl: 'https://example.com/blog/post',
  headline: 'FAQ Title',
  author: { name: 'John Doe' }
})
```

### Display FAQ Section
```tsx
{post.faqs && post.faqs.length > 0 && (
  <FAQSection faqs={post.faqs} className="mt-12" />
)}
```

### Manual Schema Injection
```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
/>
```

---

## Internal Linking

### Import (Editor Only)
```typescript
import { InternalLinkButton } from '@/components/blog/editor/InternalLinkButton'
```

### Usage
Already integrated in EditorToolbar. Click the Link2 icon in the editor.

### Programmatic Link Insertion
```typescript
editor
  .chain()
  .focus()
  .setLink({ href: '/blog/post-slug' })
  .insertContent('Link Text')
  .run()
```

---

## Complete Blog Post Template

```tsx
// app/blog/[slug]/page.tsx
import { BlogService } from '@/lib/blog/BlogService'
import { generateTOCServer } from '@/lib/blog/generateTOC'
import { TableOfContents } from '@/components/blog/TableOfContents'
import { FAQSection } from '@/components/blog/FAQSection'

export default async function BlogPostPage({
  params
}: {
  params: { slug: string }
}) {
  // Fetch post
  const post = await BlogService.getPostBySlug(params.slug)
  if (!post) return <div>Not found</div>

  // Generate TOC
  const { toc, updatedHtml } = generateTOCServer(post.content)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Mobile TOC */}
        <TableOfContents items={toc} className="lg:hidden mb-8" />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <article className="lg:col-span-3">
            <h1>{post.title}</h1>
            <div dangerouslySetInnerHTML={{ __html: updatedHtml }} />

            {/* FAQs */}
            {post.faqs && post.faqs.length > 0 && (
              <FAQSection faqs={post.faqs} className="mt-12" />
            )}
          </article>

          {/* Desktop TOC */}
          <aside className="hidden lg:block">
            <TableOfContents items={toc} />
          </aside>
        </div>
      </div>
    </div>
  )
}
```

---

## TypeScript Types

```typescript
interface TOCItem {
  id: string
  text: string
  level: number
}

interface FAQSchemaItem {
  question: string
  answer: string
}

interface BlogFAQ {
  id: string
  post_id: string
  question: string
  answer: string
  display_order: number
}
```

---

## Validation Tools

- **FAQ Schema**: https://search.google.com/test/rich-results
- **Schema Validation**: https://validator.schema.org/
- **Mobile Test**: https://search.google.com/test/mobile-friendly

---

## Styling Classes

### Brand Colors
- Primary: `bg-brand-500` `text-brand-500` `border-brand-500`
- Light: `bg-brand-50` `text-brand-700`
- Hover: `hover:bg-brand-600`

### Common Patterns
```tsx
// Active state
className="bg-brand-50 text-brand-700 border-l-2 border-brand-500"

// Hover state
className="hover:bg-gray-50 hover:text-brand-500"

// Button
className="bg-brand-500 text-white hover:bg-brand-600"
```

---

## Common Issues

### TOC not showing
- Ensure content has h2/h3/h4 headings
- Check heading text is not empty

### FAQ schema not validating
- Test at https://search.google.com/test/rich-results
- Ensure question/answer are non-empty strings

### Internal link modal empty
- Check `/api/blog/posts?status=published` returns posts
- Verify posts have `status: 'published'`

---

## Performance Tips

1. Use `generateTOCServer()` in Server Components
2. Cache TOC in `table_of_contents` JSONB field (optional)
3. Limit FAQ schema to 5-10 items for rich results
4. Fetch max 100 posts for internal linking

---

## Best Practices

### Headings
```html
<!-- Good -->
<h2>Introduction to Next.js</h2>
<h3>Key Features</h3>
<h4>Server-Side Rendering</h4>

<!-- Bad (skips h3) -->
<h2>Introduction to Next.js</h2>
<h4>Server-Side Rendering</h4>
```

### FAQs
```typescript
// Good - natural language
{
  question: "What is Next.js?",
  answer: "Next.js is a React framework for building web applications."
}

// Bad - too short or keyword-stuffed
{
  question: "Next.js?",
  answer: "Framework."
}
```

### Internal Links
```typescript
// Good - descriptive text
"Learn more about [Next.js Server Components](/blog/server-components)"

// Bad - generic text
"Click [here](/blog/server-components) to learn more"
```

---

## File Paths Reference

```
/src/lib/blog/
  ├── generateTOC.ts          (TOC utilities)
  ├── generateFAQSchema.ts    (FAQ schema utilities)
  ├── BlogService.ts          (Blog CRUD operations)
  └── types.ts                (TypeScript types)

/src/components/blog/
  ├── TableOfContents.tsx     (TOC component)
  ├── FAQSection.tsx          (FAQ accordion)
  └── editor/
      ├── InternalLinkButton.tsx  (Link modal)
      ├── EditorToolbar.tsx       (Editor toolbar)
      └── TipTapEditor.tsx        (Main editor)

/src/app/api/blog/
  └── posts/
      └── route.ts            (Posts API endpoint)
```

---

## Quick Commands

```bash
# Validate schema
curl https://validator.schema.org/ -X POST \
  -H "Content-Type: application/json" \
  -d @schema.json

# Test rich results
# Visit: https://search.google.com/test/rich-results

# Check mobile-friendliness
# Visit: https://search.google.com/test/mobile-friendly
```

---

## Related Documentation

- **SEO_FEATURES_GUIDE.md** - Detailed usage guide
- **SEO_IMPLEMENTATION_SUMMARY.md** - Technical implementation details
- **Database schema**: `supabase/migrations/blog_schema.sql`
