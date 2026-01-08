/**
 * FAQ Schema Generator
 * Generates schema.org FAQPage JSON-LD structured data
 */

import type { BlogFAQ } from './types'

export interface FAQSchemaItem {
  question: string
  answer: string
}

/**
 * Generates schema.org/FAQPage JSON-LD structured data
 * @param faqs Array of FAQ items
 * @param pageUrl Optional URL of the page containing the FAQs
 * @returns JSON-LD object for FAQPage
 */
export function generateFAQSchema(
  faqs: FAQSchemaItem[],
  pageUrl?: string
): Record<string, any> {
  if (!faqs || faqs.length === 0) {
    return {}
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }

  // Add page URL if provided
  if (pageUrl) {
    return {
      ...schema,
      '@id': pageUrl,
      url: pageUrl,
    }
  }

  return schema
}

/**
 * Generates FAQ schema from BlogFAQ database objects
 */
export function generateFAQSchemaFromBlogFAQs(
  faqs: BlogFAQ[],
  pageUrl?: string
): Record<string, any> {
  const faqItems: FAQSchemaItem[] = faqs
    .sort((a, b) => a.display_order - b.display_order)
    .map((faq) => ({
      question: faq.question,
      answer: faq.answer,
    }))

  return generateFAQSchema(faqItems, pageUrl)
}

/**
 * Converts FAQ schema to JSON-LD script tag string
 */
export function faqSchemaToScriptTag(schema: Record<string, any>): string {
  if (!schema || Object.keys(schema).length === 0) {
    return ''
  }

  return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`
}

/**
 * Generates complete FAQ schema with additional metadata
 */
export function generateEnhancedFAQSchema(
  faqs: FAQSchemaItem[],
  options?: {
    pageUrl?: string
    headline?: string
    description?: string
    datePublished?: string
    dateModified?: string
    author?: {
      name: string
      url?: string
    }
  }
): Record<string, any> {
  const baseSchema = generateFAQSchema(faqs, options?.pageUrl)

  if (!options) {
    return baseSchema
  }

  const enhancedSchema: Record<string, any> = { ...baseSchema }

  if (options.headline) {
    enhancedSchema.headline = options.headline
  }

  if (options.description) {
    enhancedSchema.description = options.description
  }

  if (options.datePublished) {
    enhancedSchema.datePublished = options.datePublished
  }

  if (options.dateModified) {
    enhancedSchema.dateModified = options.dateModified
  }

  if (options.author) {
    enhancedSchema.author = {
      '@type': 'Person',
      name: options.author.name,
      ...(options.author.url && { url: options.author.url }),
    }
  }

  return enhancedSchema
}
