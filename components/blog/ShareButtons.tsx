'use client'

import { useState } from 'react'
import { Share2, Twitter, Facebook, Linkedin, Link2, Check } from 'lucide-react'
import { generateShareUrls } from '@/lib/blog/seo'

interface ShareButtonsProps {
  url: string
  title: string
  className?: string
}

export function ShareButtons({ url, title, className = '' }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)
  const shareUrls = generateShareUrls(url, title)

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrls.copy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm font-medium text-gray-700 mr-2">Share:</span>

      {/* Twitter */}
      <a
        href={shareUrls.twitter}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 text-gray-600 hover:bg-[#1DA1F2] hover:text-white transition-colors"
        aria-label="Share on Twitter"
      >
        <Twitter className="w-5 h-5" />
      </a>

      {/* Facebook */}
      <a
        href={shareUrls.facebook}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 text-gray-600 hover:bg-[#1877F2] hover:text-white transition-colors"
        aria-label="Share on Facebook"
      >
        <Facebook className="w-5 h-5" />
      </a>

      {/* LinkedIn */}
      <a
        href={shareUrls.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 text-gray-600 hover:bg-[#0A66C2] hover:text-white transition-colors"
        aria-label="Share on LinkedIn"
      >
        <Linkedin className="w-5 h-5" />
      </a>

      {/* Copy Link */}
      <button
        onClick={handleCopyLink}
        className={`inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
          copied
            ? 'bg-green-500 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-brand-500 hover:text-white'
        }`}
        aria-label="Copy link"
      >
        {copied ? <Check className="w-5 h-5" /> : <Link2 className="w-5 h-5" />}
      </button>

      {/* Web Share API (mobile) */}
      {typeof navigator !== 'undefined' && navigator.share && (
        <button
          onClick={() => {
            navigator.share({
              title,
              url,
            }).catch(() => {
              // User cancelled or error
            })
          }}
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 text-gray-600 hover:bg-brand-500 hover:text-white transition-colors lg:hidden"
          aria-label="Share"
        >
          <Share2 className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
