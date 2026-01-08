'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'
import type { BlogFAQ } from '@/lib/blog/types'
import { generateFAQSchemaFromBlogFAQs } from '@/lib/blog/generateFAQSchema'

interface FAQSectionProps {
  faqs: BlogFAQ[]
  className?: string
}

export function FAQSection({ faqs, className = '' }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (!faqs || faqs.length === 0) {
    return null
  }

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  // Sort FAQs by display order
  const sortedFaqs = [...faqs].sort((a, b) => a.display_order - b.display_order)

  // Generate FAQ schema for SEO
  const faqSchema = generateFAQSchemaFromBlogFAQs(sortedFaqs)

  return (
    <section className={`bg-white rounded-card border border-gray-200 p-6 md:p-8 ${className}`}>
      {/* Schema.org JSON-LD */}
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqSchema),
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
          <HelpCircle className="w-5 h-5 text-brand-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">
          Frequently Asked Questions
        </h2>
      </div>

      {/* FAQ Items */}
      <div className="space-y-3">
        {sortedFaqs.map((faq, index) => (
          <div
            key={faq.id}
            className="border border-gray-200 rounded-lg overflow-hidden transition-all duration-200 hover:border-brand-300"
          >
            <button
              onClick={() => toggleFAQ(index)}
              className="w-full flex items-start justify-between gap-4 p-4 md:p-5 text-left bg-white hover:bg-gray-50 transition-colors"
              aria-expanded={openIndex === index}
              aria-controls={`faq-answer-${index}`}
            >
              <span className="flex-1 font-medium text-gray-900 text-base md:text-lg">
                {faq.question}
              </span>
              <span className="flex-shrink-0 mt-1">
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-brand-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </span>
            </button>

            <div
              id={`faq-answer-${index}`}
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="px-4 md:px-5 pb-4 md:pb-5 bg-gray-50 border-t border-gray-100">
                <div
                  className="prose prose-sm md:prose-base max-w-none text-gray-700 mt-2"
                  dangerouslySetInnerHTML={{ __html: faq.answer }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Note */}
      <p className="mt-6 text-sm text-gray-500 text-center">
        Have more questions?{' '}
        <a
          href="/contact"
          className="text-brand-600 hover:text-brand-700 font-medium underline"
        >
          Contact our support team
        </a>
      </p>
    </section>
  )
}
