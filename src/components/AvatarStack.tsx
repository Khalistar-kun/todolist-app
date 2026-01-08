"use client"
import { useEffect, useState, useMemo, useCallback } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import UserAvatar from './Avatar'
import type { UserProfile } from '@/lib/types'

type Props = {
  emails: string[]
  size?: number
  maxVisible?: number
  className?: string
}

export default function AvatarStack({ emails, size = 32, maxVisible = 3, className = '' }: Props) {
  const sb = useMemo(getSupabaseBrowser, [])
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({})

  // Memoize email list to avoid unnecessary re-renders
  const emailsKey = useMemo(() => emails.join(','), [emails])

  const loadProfiles = useCallback(async () => {
    if (emails.length === 0) return

    const { data } = await sb
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .in('email', emails)

    if (data) {
      const profileMap: Record<string, UserProfile> = {}
      data.forEach((profile) => {
        profileMap[profile.email] = profile
      })
      setProfiles(profileMap)
    }
  }, [sb, emails])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles, emailsKey])

  if (emails.length === 0) return null

  const visibleEmails = emails.slice(0, maxVisible)
  const remainingCount = emails.length - maxVisible

  return (
    <div className={`flex items-center ${className}`}>
      <div className="flex -space-x-2">
        {visibleEmails.map((email, idx) => (
          <div
            key={email}
            className="ring-2 ring-white rounded-full"
            style={{ zIndex: visibleEmails.length - idx }}
            title={profiles[email]?.full_name || email}
          >
            <UserAvatar
              email={email}
              src={profiles[email]?.avatar_url}
              size={size}
            />
          </div>
        ))}
      </div>
      {remainingCount > 0 && (
        <div
          className="ml-1 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 font-medium text-xs ring-2 ring-white"
          style={{ width: size, height: size }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  )
}
