"use client"
import Avatar from 'boring-avatars'
import Image from 'next/image'
import type { Profile } from '@/lib/supabase'

type Props = {
  user?: Pick<Profile, 'id' | 'email' | 'full_name' | 'avatar_url'> | null
  email?: string
  src?: string | null
  alt?: string
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showName?: boolean
}

const COLORS = ['#FF9F66', '#FFB380', '#FFC799', '#FFDBB3', '#FFEFCC']

const sizeMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64
}

export default function AvatarComponent({
  user,
  email: propEmail,
  src: propSrc,
  alt: propAlt,
  size = 'md',
  className = '',
  showName = false
}: Props) {
  const email = user?.email || propEmail || ''
  const avatarUrl = user?.avatar_url || propSrc
  const displayName = user?.full_name || propAlt || email
  const sizeValue = typeof size === 'number' ? size : sizeMap[size] || 40

  // If user has uploaded an avatar, use it
  if (avatarUrl && avatarUrl.startsWith('http')) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Image
          src={avatarUrl}
          alt={displayName}
          width={sizeValue}
          height={sizeValue}
          className="rounded-full object-cover flex-shrink-0"
          unoptimized
        />
        {showName && (
          <span className="text-sm font-medium text-gray-900 truncate">
            {displayName}
          </span>
        )}
      </div>
    )
  }

  // If user has a base64 avatar (data: URL)
  if (avatarUrl && avatarUrl.startsWith('data:')) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={displayName}
          className="rounded-full object-cover flex-shrink-0"
          style={{ width: sizeValue, height: sizeValue }}
        />
        {showName && (
          <span className="text-sm font-medium text-gray-900 truncate">
            {displayName}
          </span>
        )}
      </div>
    )
  }

  // If user selected a predefined avatar
  if (avatarUrl && avatarUrl.startsWith('predefined:')) {
    const [, variant, seed] = avatarUrl.split(':')
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div
          className={`rounded-full overflow-hidden flex-shrink-0`}
          style={{ width: sizeValue, height: sizeValue }}
        >
          <Avatar
            size={sizeValue}
            name={`${email}-${seed}`}
            variant={variant as any}
            colors={COLORS}
          />
        </div>
        {showName && (
          <span className="text-sm font-medium text-gray-900 truncate">
            {displayName}
          </span>
        )}
      </div>
    )
  }

  // Default: use boring-avatars with email as seed
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`rounded-full overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center`}
        style={{ width: sizeValue, height: sizeValue }}
      >
        <Avatar
          size={sizeValue}
          name={user?.full_name || email}
          variant="beam"
          colors={COLORS}
        />
      </div>
      {showName && (
        <span className="text-sm font-medium text-gray-900 truncate">
          {displayName}
        </span>
      )}
    </div>
  )
}

// Export with a more intuitive name
export { AvatarComponent as Avatar }