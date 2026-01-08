"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Image from 'next/image'
import toast from 'react-hot-toast'

interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<Profile>({
    id: '',
    full_name: '',
    avatar_url: '',
    bio: '',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadProfile = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)

      // Try to load from API first
      const response = await fetch('/api/profile')
      if (response.ok) {
        const data = await response.json()
        if (data.profile) {
          setProfile({
            id: data.profile.id || user.id,
            full_name: data.profile.full_name || '',
            avatar_url: data.profile.avatar_url || '',
            bio: data.profile.bio || '',
          })
          // Also update localStorage for navbar sync
          localStorage.setItem(`profile-${user.id}`, JSON.stringify({
            full_name: data.profile.full_name,
            avatar_url: data.profile.avatar_url,
          }))
          return
        }
      }

      // Fallback to localStorage
      const savedProfile = localStorage.getItem(`profile-${user.id}`)
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile)
        setProfile({
          id: user.id,
          full_name: parsed.full_name || '',
          avatar_url: parsed.avatar_url || '',
          bio: parsed.bio || '',
        })
      } else {
        // Set defaults from user data
        setProfile({
          id: user.id,
          full_name: user?.full_name || '',
          avatar_url: user?.avatar_url || '',
          bio: '',
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      setProfile({
        id: user.id,
        full_name: user?.full_name || '',
        avatar_url: user?.avatar_url || '',
        bio: '',
      })
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadProfile()
    }
  }, [user, loadProfile])

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    try {
      // Save to API (database)
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          bio: profile.bio,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save profile')
      }

      // Also save to localStorage for navbar sync
      localStorage.setItem(`profile-${user.id}`, JSON.stringify({
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      }))

      // Dispatch custom event so other components (like navbar) can update
      window.dispatchEvent(new CustomEvent('profile-updated'))

      toast.success('Profile updated successfully')
    } catch (error: any) {
      console.error('Error saving profile:', error)
      toast.error(error.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB')
      return
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Convert to base64 and store
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setProfile({ ...profile, avatar_url: base64 })
      toast.success('Image uploaded! Click Save to keep changes.')
    }
    reader.onerror = () => {
      toast.error('Failed to read image file')
    }
    reader.readAsDataURL(file)
  }

  const getInitials = () => {
    if (profile.full_name) {
      return profile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return user?.email?.charAt(0).toUpperCase() || 'U'
  }

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="spinner spinner-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profile</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Manage your personal information and preferences.</p>
        </div>

        {/* Avatar Section */}
        <div className="card mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile Picture</h2>
            <div className="flex items-center space-x-6">
              <div className="relative w-20 h-20">
                {profile.avatar_url ? (
                  profile.avatar_url.startsWith('data:') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <Image
                      src={profile.avatar_url}
                      alt="Profile"
                      width={80}
                      height={80}
                      className="rounded-full object-cover"
                      unoptimized
                    />
                  )
                ) : (
                  <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-white text-2xl font-medium">{getInitials()}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-sm btn-secondary"
                  >
                    Upload Image
                  </button>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    PNG, JPG up to 2MB
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Or enter URL
                  </label>
                  <input
                    type="url"
                    value={profile.avatar_url?.startsWith('data:') ? '' : (profile.avatar_url || '')}
                    onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Information Section */}
        <div className="card mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profile.full_name || ''}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="Enter your full name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Email cannot be changed
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bio
                </label>
                <textarea
                  value={profile.bio || ''}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  placeholder="Tell us a little about yourself..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Account Stats Section */}
        <div className="card mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {user?.email || 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">User ID</p>
                <p className="text-sm font-mono text-gray-900 dark:text-white truncate">
                  {user?.id || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-md btn-primary"
          >
            {saving ? (
              <>
                <div className="spinner spinner-sm mr-2"></div>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
