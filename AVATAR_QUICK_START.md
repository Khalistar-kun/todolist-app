# Avatar System - Quick Start Guide

## 🚀 Setup (3 steps)

### 1. Install Dependencies
```bash
npm install boring-avatars react-image-crop
```

### 2. Run Database Migration
Copy and run this SQL in Supabase SQL Editor:
```sql
-- Add avatar_url to profiles
alter table public.profiles add column if not exists avatar_url text;

-- Create storage bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' and
    auth.role() = 'authenticated' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars' and
    auth.role() = 'authenticated' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars' and
    auth.role() = 'authenticated' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

### 3. Test It
1. Run `npm run dev`
2. Navigate to `/app/[projectId]/settings`
3. Click "Profile" tab
4. Click "Change Avatar"
5. Select or upload an avatar

## 📦 Components

### Display Single Avatar
```tsx
import UserAvatar from '@/components/Avatar'

<UserAvatar email="user@example.com" avatarUrl={profile.avatar_url} size={40} />
```

### Display Multiple Avatars (Stacked)
```tsx
import AvatarStack from '@/components/AvatarStack'

<AvatarStack emails={['user1@example.com', 'user2@example.com']} size={32} maxVisible={3} />
```

### Avatar Picker Modal
```tsx
import AvatarPicker from '@/components/AvatarPicker'

const [showPicker, setShowPicker] = useState(false)

<AvatarPicker
  currentAvatarUrl={avatarUrl}
  userEmail={user.email}
  onAvatarChange={(url) => setAvatarUrl(url)}
  onClose={() => setShowPicker(false)}
/>
```

## ✅ Already Integrated

- ✅ Settings page → Profile tab
- ✅ Task list → Shows assignee avatars
- ✅ Task editor → Live avatar preview

## 🎨 Features

- **72 Predefined Avatars**: 6 styles × 12 variants
- **Custom Uploads**: PNG, JPG, GIF (max 2MB)
- **Auto-Generated**: Falls back to email-based avatar
- **Stacking**: Shows up to 3, then "+N"
- **Responsive**: Works on all screen sizes

## 🔧 Customization

Change colors in `/components/Avatar.tsx`:
```tsx
const COLORS = ['#FF9F66', '#FFB380', '#FFC799', '#FFDBB3', '#FFEFCC']
```

## 📁 Files Created

```
/sql/add_avatar_system.sql          # Database migration
/src/components/Avatar.tsx          # Display avatar
/src/components/AvatarStack.tsx     # Stacked avatars
/src/components/AvatarPicker.tsx    # Avatar selector
/AVATAR_SYSTEM.md                   # Full documentation
/AVATAR_QUICK_START.md              # This file
```

## 🐛 Troubleshooting

**Avatars not showing?**
- Check `avatar_url` column exists in profiles table
- Verify avatars bucket exists in Supabase Storage
- Check browser console for errors

**Upload not working?**
- File must be under 2MB
- Only PNG, JPG, GIF supported
- Check Supabase storage policies

## 📚 More Info

See `AVATAR_SYSTEM.md` for complete documentation.
