# Blog SEO Deployment Checklist

Use this checklist before deploying blog posts to production.

## Pre-Launch Checklist

### 1. Metadata Optimization

- [ ] **Title Tag** (50-60 characters)
  - Contains primary keyword
  - Compelling and click-worthy
  - Unique across all posts
  - Format: "Post Title | TodoApp Blog"

- [ ] **Meta Description** (150-160 characters)
  - Contains primary/secondary keywords
  - Includes call-to-action
  - Accurately describes content
  - Unique across all posts

- [ ] **Featured Image**
  - Minimum 1200x630px (OG image ratio)
  - High quality, relevant to content
  - Alt text is descriptive
  - File size optimized (<200KB)

- [ ] **OG Image**
  - Set or defaults to featured image
  - 1200x630px required
  - Text readable on mobile preview

- [ ] **Canonical URL**
  - Set to avoid duplicate content
  - Uses HTTPS
  - No trailing slash (consistent)

### 2. Content Quality

- [ ] **Heading Structure**
  - Single H1 (post title)
  - Logical H2/H3 hierarchy
  - Headings contain keywords
  - 3-5 H2 sections minimum

- [ ] **Content Length**
  - Minimum 800 words for SEO value
  - 1,500-2,500 words ideal for pillar content
  - Reading time auto-calculated

- [ ] **Keyword Optimization**
  - Primary keyword in first paragraph
  - Keywords in headings (H2/H3)
  - Natural keyword density (1-2%)
  - LSI keywords included

- [ ] **Internal Links**
  - 3-5 internal links to related posts/pages
  - Descriptive anchor text (not "click here")
  - Links to relevant categories

- [ ] **External Links**
  - 2-3 authoritative sources cited
  - Open in new tab (target="_blank")
  - Nofollow for sponsored/affiliate links

- [ ] **Images**
  - Alt text for all images
  - Descriptive file names
  - Responsive sizing with srcset
  - Lazy loading enabled

### 3. Structured Data

- [ ] **Article Schema**
  - Headline, description, image
  - Author information
  - Published/modified dates
  - Publisher (TodoApp)

- [ ] **Breadcrumb Schema**
  - Home → Blog → Category → Post
  - Position numbers correct
  - URLs are absolute

- [ ] **FAQ Schema** (if applicable)
  - Question/answer pairs
  - Properly formatted HTML in answers
  - Valid JSON-LD syntax

- [ ] **Validate with Tools**
  - Google Rich Results Test
  - Schema.org Validator
  - No errors or warnings

### 4. Social Media

- [ ] **Open Graph Tags**
  - og:title (post title)
  - og:description (excerpt)
  - og:image (1200x630px)
  - og:type (article)
  - og:url (canonical URL)

- [ ] **Twitter Cards**
  - twitter:card (summary_large_image)
  - twitter:title
  - twitter:description
  - twitter:image
  - twitter:creator (if author has Twitter)

- [ ] **Preview Testing**
  - Facebook Sharing Debugger
  - Twitter Card Validator
  - LinkedIn Post Inspector

### 5. Technical SEO

- [ ] **URL Structure**
  - Clean, readable slug
  - No special characters
  - Hyphens for word separation
  - Keep under 75 characters

- [ ] **Mobile-First**
  - Responsive design tested
  - Touch targets 44x44px minimum
  - Font sizes readable (16px min)
  - No horizontal scroll

- [ ] **Page Speed**
  - Lighthouse score 90+
  - LCP under 2.5s
  - FID under 100ms
  - CLS under 0.1

- [ ] **Accessibility**
  - ARIA labels for interactive elements
  - Keyboard navigation works
  - Focus states visible
  - Color contrast WCAG AA

- [ ] **Security**
  - HTTPS enabled
  - No mixed content warnings
  - CSP headers set
  - XSS protection enabled

### 6. Content Elements

- [ ] **Author Bio**
  - Name, photo, bio filled
  - Social links working
  - Consistent across posts

- [ ] **Category**
  - Post assigned to category
  - Category page exists
  - Category SEO metadata set

- [ ] **Tags**
  - 3-5 relevant tags
  - Tags have landing pages
  - Avoid tag spam

- [ ] **Publishing Date**
  - Published date set
  - Formatted correctly
  - Matches content freshness

- [ ] **Reading Time**
  - Auto-calculated (or manual)
  - Displays correctly
  - Matches actual content

### 7. User Experience

- [ ] **Table of Contents**
  - Auto-generates from H2/H3
  - Smooth scroll works
  - Active section highlights
  - Mobile collapsible

- [ ] **Share Buttons**
  - All platforms work
  - Copy link functionality
  - Native share on mobile
  - URLs properly encoded

- [ ] **Related Posts**
  - 3 relevant posts shown
  - Same category or tags
  - Thumbnails display
  - Links work correctly

- [ ] **FAQs** (if included)
  - 3-5 common questions
  - Clear, helpful answers
  - Accordion works smoothly
  - Schema markup valid

### 8. Pre-Publish Tests

- [ ] **Preview Mode**
  - Content renders correctly
  - Images load properly
  - Layout looks good
  - No console errors

- [ ] **Cross-Browser**
  - Chrome/Edge
  - Firefox
  - Safari
  - Mobile browsers

- [ ] **Device Testing**
  - iPhone (various sizes)
  - Android (various sizes)
  - iPad/tablets
  - Desktop (various resolutions)

- [ ] **Link Testing**
  - All internal links work
  - All external links work
  - No broken images
  - No 404 errors

### 9. Post-Publish

- [ ] **Search Console**
  - Submit URL for indexing
  - Check for crawl errors
  - Monitor impressions/clicks
  - Fix any issues reported

- [ ] **Analytics**
  - Tracking code fires
  - Page views recorded
  - Events tracked (shares, etc.)
  - No tracking errors

- [ ] **Sitemap**
  - Post appears in sitemap
  - Sitemap submitted to GSC
  - No errors in sitemap
  - Priority/changefreq set

- [ ] **Social Sharing**
  - Share to Twitter (test preview)
  - Share to Facebook (test preview)
  - Share to LinkedIn (test preview)
  - Copy link works

### 10. Promotion

- [ ] **Internal Promotion**
  - Add to related posts
  - Link from existing content
  - Update category pages
  - Add to homepage/featured

- [ ] **External Promotion**
  - Share on social media
  - Email newsletter
  - Slack/Discord communities
  - Submit to aggregators

- [ ] **Backlink Building**
  - Reach out to cited sources
  - Guest post opportunities
  - Industry forums/communities
  - Outreach to influencers

## Validation Tools

### SEO Testing
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)
- [Google PageSpeed Insights](https://pagespeed.web.dev/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

### Social Media Preview
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

### Accessibility
- [WAVE Accessibility Tool](https://wave.webaim.org/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [Lighthouse Accessibility Audit](https://web.dev/accessibility/)

### Performance
- [WebPageTest](https://www.webpagetest.org/)
- [GTmetrix](https://gtmetrix.com/)
- [Chrome DevTools Coverage](https://developer.chrome.com/docs/devtools/coverage/)

## Monitoring Metrics

### Week 1
- Indexing status (Search Console)
- Impressions/clicks (GSC)
- Page views (Analytics)
- Bounce rate
- Average time on page

### Month 1
- Organic traffic growth
- Keyword rankings
- Backlinks acquired
- Social shares
- Comments/engagement

### Quarter 1
- Top performing posts
- Conversion rate (CTA clicks)
- Email signups from blog
- Revenue attribution
- ROI calculation

## Quick Reference

### Ideal Metrics

| Metric | Target | Tool |
|--------|--------|------|
| Title length | 50-60 chars | Manual |
| Meta desc | 150-160 chars | Manual |
| Content length | 1,500+ words | Word counter |
| Reading time | 5-10 min | Auto-calculated |
| Internal links | 3-5 | Manual |
| External links | 2-3 | Manual |
| Images | 3-5 | Manual |
| H2 headings | 3-5 | Manual |
| Lighthouse score | 90+ | PageSpeed |
| LCP | <2.5s | PageSpeed |
| Mobile score | 90+ | PageSpeed |
| Schema errors | 0 | Rich Results |

## Common Issues

### Post not indexing
1. Check robots.txt not blocking
2. Submit URL to Search Console
3. Add internal links from popular pages
4. Verify sitemap includes post
5. Wait 3-7 days for crawl

### Low impressions
1. Improve title/meta description
2. Target longer-tail keywords
3. Build backlinks
4. Update older posts with links
5. Promote on social media

### High bounce rate
1. Improve content quality
2. Add relevant internal links
3. Optimize page speed
4. Better match search intent
5. Improve mobile experience

### Schema validation errors
1. Check JSON-LD syntax
2. Ensure required fields present
3. Use absolute URLs
4. Validate date formats
5. Test in Rich Results tool

## Approval Workflow

1. **Draft Complete** - Writer marks ready
2. **Editorial Review** - Editor checks content quality
3. **SEO Review** - SEO specialist checks this checklist
4. **Technical Review** - Developer checks implementation
5. **Final Approval** - Content manager publishes
6. **Post-Publish QA** - Verify live site, submit to GSC

---

**Last Updated:** November 18, 2025
**Version:** 1.0
**Owner:** SEO Team
