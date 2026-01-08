'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, List } from 'lucide-react'
import type { TOCItem } from '@/lib/blog/generateTOC'

interface TableOfContentsProps {
  items: TOCItem[]
  className?: string
}

export function TableOfContents({ items, className = '' }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Intersection Observer to track which heading is in view
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      {
        rootMargin: '-100px 0px -80% 0px',
      }
    )

    // Observe all headings
    items.forEach((item) => {
      const element = document.getElementById(item.id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => {
      observer.disconnect()
    }
  }, [items])

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const offset = 100
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })

      // Close mobile TOC after clicking
      setIsOpen(false)
    }
  }

  if (items.length === 0) {
    return null
  }

  return (
    <>
      {/* Mobile Toggle */}
      <div className="lg:hidden mb-6">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <List className="w-4 h-4 text-brand-500" />
            Table of Contents
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {isOpen && (
          <nav className="mt-2 p-4 bg-white border border-gray-200 rounded-lg">
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  style={{ paddingLeft: `${(item.level - 2) * 0.75}rem` }}
                >
                  <button
                    onClick={() => scrollToHeading(item.id)}
                    className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeId === item.id
                        ? 'bg-brand-50 text-brand-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {item.text}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      {/* Desktop Sticky TOC */}
      <nav
        className={`hidden lg:block sticky top-24 bg-white border border-gray-200 rounded-card p-5 ${className}`}
      >
        <div className="flex items-center gap-2 mb-4">
          <List className="w-4 h-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-gray-900">Table of Contents</h3>
        </div>

        <ul className="space-y-2">
          {items.map((item) => {
            const indent = item.level - 2
            return (
              <li
                key={item.id}
                style={{ paddingLeft: `${indent * 0.75}rem` }}
              >
                <button
                  onClick={() => scrollToHeading(item.id)}
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    activeId === item.id
                      ? 'bg-brand-50 text-brand-700 font-medium border-l-2 border-brand-500 -ml-px'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {item.text}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
