# Avatar System - TodoApp

## Overview

The TodoApp now has a complete avatar system that allows users to personalize their profiles with either predefined avatars or custom uploaded images. Avatars are displayed throughout the app to make task assignment more visual and engaging.

## Features

### 1. Avatar Library
- **72 Predefined Avatars**: 6 different styles (marble, beam, pixel, sunset, ring, bauhaus) with 12 variants each
- **Powered by boring-avatars**: Beautiful, unique avatars generated from user emails
- **Custom Color Palette**: Brand-consistent colors (#FF9F66, #FFB380, #FFC799, #FFDBB3, #FFEFCC)

### 2. Custom Avatar Upload
- Upload your own profile picture
- Supported formats: PNG, JPG, GIF
- Maximum file size: 2MB
- Recommended: Square images, at least 256x256px
- Stored securely in Supabase Storage

### 3. Avatar Display
- **Profile Settings**: Large avatar display (80px) with change button
- **Task Lists**: Stacked avatars showing assignees (24px)
- **Task Editor**: Live preview of assignees as you type (32px)
- **Stacking**: Shows up to 3 avatars, then "+N" for additional assignees

## Components

### Avatar.tsx
Main avatar component that displays user avatars.

```tsx
import UserAvatar from '@/components/Avatar'

<UserAvatar
  email="user@example.com"
  avatarUrl={profile.avatar_url}
  size={32}
  className="ring-2 ring-gray-200"
/>
```

**Props:**
- `email` (string, required): User's email (used as seed for predefined avatars)
- `avatarUrl` (string | null, optional): Avatar URL or predefined avatar ID
- `size` (number, optional): Avatar size in pixels (default: 32)
- `className` (string, optional): Additional CSS classes

**Avatar Types:**
- **Uploaded Image**: URL starting with `http`
- **Predefined Avatar**: Format `predefined:variant:seed`
- **Default**: Generated from email using boring-avatars

### AvatarStack.tsx
Shows multiple avatars stacked together with overflow indicator.

```tsx
import AvatarStack from '@/components/AvatarStack'

<AvatarStack
  emails={['user1@example.com', 'user2@example.com']}
  size={32}
  maxVisible={3}
/>
```

**Props:**
- `emails` (string[], required): Array of user emails
- `size` (number, optional): Avatar size in pixels (default: 32)
- `maxVisible` (number, optional): Maximum avatars to display (default: 3)
- `className` (string, optional): Additional CSS classes

**Features:**
- Automatically fetches profile data from database
- Shows up to `maxVisible` avatars
- Displays "+N" badge for remaining avatars
- Tooltips show full names on hover

### AvatarPicker.tsx
Modal component for selecting or uploading avatars.

```tsx
import AvatarPicker from '@/components/AvatarPicker'

<AvatarPicker
  currentAvatarUrl={avatarUrl}
  userEmail={user.email}
  onAvatarChange={(url) => setAvatarUrl(url)}
  onClose={() => setShowPicker(false)}
/>
```

**Props:**
- `currentAvatarUrl` (string | null, optional): Current avatar URL
- `userEmail` (string, required): User's email
- `onAvatarChange` (function, required): Callback when avatar is selected
- `onClose` (function, required): Callback to close the modal

**Features:**
- Two tabs: Predefined Avatars and Upload Image
- 72 predefined avatars in 6 styles
- Image upload with validation
- Real-time preview
- Automatically updates profile in database

## Database Schema

### profiles Table
```sql
alter table public.profiles
add column if not exists avatar_url text;
```

The `avatar_url` field can contain:
1. **HTTP URL**: Full URL to uploaded image in Supabase Storage
2. **Predefined ID**: Format `predefined:variant:seed` (e.g., `predefined:beam:variant1`)
3. **NULL**: Falls back to default generated avatar

### Storage Bucket
```sql
-- Create avatars bucket (public)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);
```

**Security Policies:**
- Public read access for all avatars
- Users can only upload/update/delete their own avatars
- File path structure: `{user_id}/{timestamp}.{ext}`

## Setup Instructions

### 1. Install Dependencies
```bash
npm install boring-avatars react-image-crop
```

### 2. Run Database Migration
Run the SQL migration file in your Supabase SQL Editor:
```bash
/Users/adityaaman/Desktop/test_Todolist/todolist/sql/add_avatar_system.sql
```

This will:
- Add `avatar_url` column to profiles table
- Create `avatars` storage bucket
- Set up storage policies

### 3. Configure Supabase Storage (if needed)
1. Go to Supabase Dashboard → Storage
2. Verify the `avatars` bucket exists
3. Confirm it's set to public
4. Check storage policies are active

### 4. Test the System
1. Navigate to any project settings page
2. Click on the "Profile" tab
3. Click "Change Avatar"
4. Select a predefined avatar or upload an image
5. Save and verify the avatar appears

## Usage in Your App

### Displaying User Avatars
```tsx
import UserAvatar from '@/components/Avatar'

// In your component
const { data: profile } = await supabase
  .from('profiles')
  .select('email, avatar_url')
  .eq('id', userId)
  .single()

return (
  <UserAvatar
    email={profile.email}
    avatarUrl={profile.avatar_url}
    size={40}
  />
)
```

### Showing Task Assignees
```tsx
import AvatarStack from '@/components/AvatarStack'

// Task with assignees
const task = {
  assignees: ['user1@example.com', 'user2@example.com', 'user3@example.com']
}

return (
  <AvatarStack
    emails={task.assignees}
    size={28}
    maxVisible={3}
  />
)
```

### Profile Settings
```tsx
import { useState } from 'react'
import UserAvatar from '@/components/Avatar'
import AvatarPicker from '@/components/AvatarPicker'

function ProfileSettings() {
  const [showPicker, setShowPicker] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url)

  return (
    <>
      <UserAvatar email={user.email} avatarUrl={avatarUrl} size={80} />
      <button onClick={() => setShowPicker(true)}>Change Avatar</button>

      {showPicker && (
        <AvatarPicker
          currentAvatarUrl={avatarUrl}
          userEmail={user.email}
          onAvatarChange={setAvatarUrl}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
```

## Integration Points

### ✅ Completed Integrations
1. **Settings Page** (`/app/[projectId]/settings`)
   - New "Profile" tab with avatar management
   - Full name editing
   - Email display (read-only)

2. **TaskList Component** (`/components/TaskList.tsx`)
   - Shows stacked avatars for assignees
   - Replaces emoji + text with visual avatars
   - Responsive avatar sizing

3. **TaskEditorModal Component** (`/components/TaskEditorModal.tsx`)
   - Live preview of assigned users
   - Updates as you type emails
   - Shows up to 5 avatars

## Customization

### Changing Colors
Edit the color palette in `/components/Avatar.tsx`:
```tsx
const COLORS = ['#FF9F66', '#FFB380', '#FFC799', '#FFDBB3', '#FFEFCC']
```

### Changing Avatar Styles
Available variants:
- `marble` - Organic, flowing shapes
- `beam` - Geometric rays
- `pixel` - 8-bit pixel art style
- `sunset` - Gradient circles
- `ring` - Concentric rings
- `bauhaus` - Abstract geometric

### Upload Limits
Modify in `/components/AvatarPicker.tsx`:
```tsx
// Current: 2MB max
if (file.size > 2 * 1024 * 1024) {
  alert('File size must be less than 2MB')
  return
}
```

## Troubleshooting

### Avatars Not Showing
1. **Check database**: Verify `avatar_url` column exists in profiles table
2. **Check storage**: Confirm avatars bucket exists and is public
3. **Check policies**: Verify storage policies are active
4. **Check console**: Look for any error messages

### Upload Not Working
1. **File size**: Ensure image is under 2MB
2. **File format**: Only PNG, JPG, GIF supported
3. **Permissions**: Check Supabase storage policies
4. **Network**: Verify Supabase connection

### Predefined Avatars Not Displaying
1. **Package**: Ensure `boring-avatars` is installed
2. **Format**: Verify avatar_url format is `predefined:variant:seed`
3. **Variant**: Check variant name is one of the 6 supported types

### Performance Issues
1. **Avatar Stack**: Component fetches profiles only once per email list
2. **Caching**: Consider implementing client-side caching if needed
3. **Batch Requests**: AvatarStack uses `in()` query for efficient bulk fetching

## Future Enhancements

Potential improvements:
- [ ] Avatar crop/resize tool before upload
- [ ] Animated avatar transitions
- [ ] Avatar templates/themes
- [ ] Gravatar integration
- [ ] Team avatar generation
- [ ] Avatar history/versioning
- [ ] Social profile imports (GitHub, Google, etc.)

## File Structure

```
/Users/adityaaman/Desktop/test_Todolist/todolist/
├── sql/
│   └── add_avatar_system.sql          # Database migration
├── src/
│   └── components/
│       ├── Avatar.tsx                  # Main avatar display component
│       ├── AvatarStack.tsx            # Stacked avatars component
│       └── AvatarPicker.tsx           # Avatar selection modal
├── src/app/app/[projectId]/settings/
│   └── page.tsx                       # Settings page with Profile tab
└── AVATAR_SYSTEM.md                   # This documentation
```

## Support

For issues or questions about the avatar system:
1. Check the console for error messages
2. Verify Supabase configuration
3. Review component props and usage
4. Check database schema and policies
