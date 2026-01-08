"use client"
import { useState, useRef, useMemo } from 'react'
import Avatar from 'boring-avatars'
import Image from 'next/image'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { Upload, X } from 'lucide-react'

type Props = {
  currentAvatarUrl?: string | null
  userEmail: string
  onAvatarChange: (avatarUrl: string) => void
  onClose: () => void
}

const AVATAR_VARIANTS = ['marble', 'beam', 'pixel', 'sunset', 'ring', 'bauhaus'] as const
const AVATAR_SEEDS = [
  'default',
  'variant1',
  'variant2',
  'variant3',
  'variant4',
  'variant5',
  'variant6',
  'variant7',
  'variant8',
  'variant9',
  'variant10',
  'variant11'
]

const COLORS = ['#FF9F66', '#FFB380', '#FFC799', '#FFDBB3', '#FFEFCC']

export default function AvatarPicker({ currentAvatarUrl, userEmail, onAvatarChange, onClose }: Props) {
  const sb = useMemo(getSupabaseBrowser, [])
  const [selectedType, setSelectedType] = useState<'predefined' | 'upload'>('predefined')
  const [uploading, setUploading] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB')
      return
    }

    setUploading(true)

    try {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      // Upload to Supabase Storage
      const { data, error } = await sb.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (error) throw error

      // Get public URL
      const { data: { publicUrl } } = sb.storage
        .from('avatars')
        .getPublicUrl(fileName)

      // Update profile
      await sb
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      onAvatarChange(publicUrl)
      onClose()
    } catch (error) {
      console.error('Error uploading avatar:', error)
      alert('Failed to upload avatar. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSelectPredefined(variant: string, seed: string) {
    const avatarId = `predefined:${variant}:${seed}`
    setSelectedAvatar(avatarId)

    try {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Store the predefined avatar ID in the database
      await sb
        .from('profiles')
        .update({ avatar_url: avatarId })
        .eq('id', user.id)

      onAvatarChange(avatarId)
      onClose()
    } catch (error) {
      console.error('Error selecting avatar:', error)
      alert('Failed to select avatar. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm grid place-items-center p-4 z-50">
      <div className="w-full max-w-4xl bg-white rounded-2xl p-6 shadow-soft-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-xl text-gray-900">Choose Your Avatar</h3>
          <button
            onClick={onClose}
            className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-sm shadow-soft p-2 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setSelectedType('predefined')}
            className={`px-4 py-2 font-medium text-sm transition-all ${
              selectedType === 'predefined'
                ? 'border-b-2 border-brand-500 text-brand-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Predefined Avatars
          </button>
          <button
            onClick={() => setSelectedType('upload')}
            className={`px-4 py-2 font-medium text-sm transition-all ${
              selectedType === 'upload'
                ? 'border-b-2 border-brand-500 text-brand-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Upload Image
          </button>
        </div>

        {/* Predefined avatars */}
        {selectedType === 'predefined' && (
          <div className="space-y-6">
            {AVATAR_VARIANTS.map((variant) => (
              <div key={variant}>
                <h4 className="font-medium text-gray-900 mb-3 capitalize">{variant} Style</h4>
                <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3">
                  {AVATAR_SEEDS.map((seed) => {
                    const avatarId = `predefined:${variant}:${seed}`
                    const isSelected = selectedAvatar === avatarId || currentAvatarUrl === avatarId

                    return (
                      <button
                        key={seed}
                        onClick={() => handleSelectPredefined(variant, seed)}
                        className={`rounded-full transition-all hover:scale-110 ${
                          isSelected ? 'ring-4 ring-brand-500 ring-offset-2' : 'hover:ring-2 hover:ring-gray-300'
                        }`}
                      >
                        <Avatar
                          size={64}
                          name={`${userEmail}-${seed}`}
                          variant={variant}
                          colors={COLORS}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload section */}
        {selectedType === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-brand-500 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="font-medium text-gray-900 mb-2">Upload your avatar</h4>
              <p className="text-sm text-gray-600 mb-4">
                PNG, JPG or GIF. Max file size 2MB. Recommended: square image, at least 256x256px
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Choose File'}
              </button>
            </div>

            {currentAvatarUrl && currentAvatarUrl.startsWith('http') && (
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <Image
                  src={currentAvatarUrl}
                  alt="Current avatar"
                  width={64}
                  height={64}
                  className="rounded-full object-cover"
                  unoptimized
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Current Avatar</div>
                  <div className="text-sm text-gray-600">Your uploaded image</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
