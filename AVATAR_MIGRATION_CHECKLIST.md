# Avatar System - Migration Checklist

Use this checklist when deploying the avatar system to ensure nothing is missed.

## Pre-Deployment

### 1. Dependencies ✅
```bash
npm install
```
- [ ] `boring-avatars@2.0.4` installed
- [ ] `react-image-crop@11.0.10` installed
- [ ] No npm errors

### 2. Files Present
- [ ] `/src/components/Avatar.tsx` exists
- [ ] `/src/components/AvatarStack.tsx` exists
- [ ] `/src/components/AvatarPicker.tsx` exists
- [ ] `/sql/add_avatar_system.sql` exists

### 3. Code Review
- [ ] Settings page imports correct components
- [ ] TaskList.tsx imports AvatarStack
- [ ] TaskEditorModal.tsx imports AvatarStack
- [ ] No TypeScript errors
- [ ] No ESLint warnings

---

## Database Migration

### 1. Backup Current Database
```bash
# Create a backup before migration
# Use Supabase dashboard: Database → Backups
```
- [ ] Database backup created
- [ ] Backup verified

### 2. Run SQL Migration

**Copy this SQL and run in Supabase SQL Editor:**

```sql
-- Step 1: Add avatar_url column
alter table public.profiles
add column if not exists avatar_url text;

-- Step 2: Create storage bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Step 3: Create storage policies
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

**Verification:**
- [ ] SQL executed without errors
- [ ] `avatar_url` column added to `profiles` table
- [ ] `avatars` bucket created in Storage
- [ ] All 4 policies created successfully

### 3. Verify Database Changes

**Check in Supabase Dashboard:**

1. **Table Editor → profiles**
   - [ ] `avatar_url` column visible
   - [ ] Column type is `text`
   - [ ] Column is nullable

2. **Storage → Buckets**
   - [ ] `avatars` bucket exists
   - [ ] Bucket is marked as "Public"
   - [ ] Bucket is empty (ready for uploads)

3. **Storage → Policies**
   - [ ] 4 policies visible for `storage.objects`
   - [ ] Policy names match migration script
   - [ ] All policies are enabled

---

## Testing (Local)

### 1. Build & Run
```bash
npm run dev
```
- [ ] Application starts without errors
- [ ] No console errors on load
- [ ] No TypeScript errors

### 2. Test Settings Page
- [ ] Navigate to `/app/[projectId]/settings`
- [ ] "Profile" tab visible in sidebar
- [ ] Click "Profile" tab opens profile section
- [ ] Current avatar displays (default or existing)
- [ ] "Change Avatar" button visible

### 3. Test Avatar Picker
- [ ] Click "Change Avatar" opens modal
- [ ] "Predefined Avatars" tab shows avatars
- [ ] All 6 styles (marble, beam, pixel, sunset, ring, bauhaus) visible
- [ ] 12 variants per style displayed
- [ ] Click on avatar selects it
- [ ] Modal closes after selection

### 4. Test Upload
- [ ] Click "Upload Image" tab
- [ ] File input area visible
- [ ] Click "Choose File" opens file picker
- [ ] Select image under 2MB
- [ ] Upload completes successfully
- [ ] Avatar updates in profile section
- [ ] Check Supabase Storage for uploaded file

### 5. Test Task List Integration
- [ ] Navigate to project task list
- [ ] Create a task with assignees
- [ ] Add emails: `user1@test.com, user2@test.com`
- [ ] Save task
- [ ] Task list shows stacked avatars
- [ ] Avatars display correctly

### 6. Test Task Editor Integration
- [ ] Click on a task to edit
- [ ] Type email in assignees field
- [ ] Avatar preview appears below input
- [ ] Add multiple emails (comma-separated)
- [ ] Multiple avatars stack correctly
- [ ] Save and verify

### 7. Test Error Handling
- [ ] Try uploading file > 2MB (should fail)
- [ ] Try uploading non-image file (should fail)
- [ ] Test with slow/no internet (graceful fallback)
- [ ] Test with missing profile data (shows default avatar)

---

## Testing (Production)

### 1. Pre-Production
- [ ] Run production build: `npm run build`
- [ ] No build errors
- [ ] Build size acceptable
- [ ] Check for warnings

### 2. Deploy
```bash
# Deploy to your platform (Vercel, Netlify, etc.)
npm run build
# Deploy dist/build folder
```
- [ ] Deployment successful
- [ ] No deployment errors
- [ ] Environment variables set correctly

### 3. Smoke Tests
- [ ] Open production URL
- [ ] Login works
- [ ] Navigate to settings
- [ ] Profile tab loads
- [ ] Avatar picker opens
- [ ] Can select predefined avatar
- [ ] Can upload custom image
- [ ] Changes persist after page reload

### 4. Cross-Browser Testing
- [ ] Chrome/Edge (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Chrome (mobile)
- [ ] Safari (mobile)

### 5. Performance Check
- [ ] Avatar images load quickly
- [ ] No layout shift on load
- [ ] Smooth modal animations
- [ ] No unnecessary re-renders

---

## Security Verification

### 1. Storage Policies
- [ ] Public can read avatars
- [ ] Users can only upload to own folder
- [ ] Users cannot modify others' avatars
- [ ] Users cannot delete others' avatars

### 2. Test Security
**As User A:**
- [ ] Upload avatar
- [ ] Note storage path

**As User B:**
- [ ] Try to access User A's avatar URL (should work - public read)
- [ ] Try to delete User A's avatar (should fail)
- [ ] Try to upload to User A's folder (should fail)

### 3. File Validation
- [ ] Max file size enforced (2MB)
- [ ] Only images accepted (PNG, JPG, GIF)
- [ ] No executable files allowed

---

## Rollback Plan

If issues arise, follow this rollback procedure:

### 1. Quick Rollback (Code Only)
```bash
# Revert to previous deployment
git revert <commit-hash>
git push
# Redeploy
```

### 2. Database Rollback (If Needed)
```sql
-- Remove policies
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Users can update their own avatar" on storage.objects;
drop policy if exists "Users can delete their own avatar" on storage.objects;

-- Delete bucket (WARNING: deletes all uploaded avatars)
delete from storage.buckets where id = 'avatars';

-- Remove column (WARNING: loses all avatar_url data)
alter table public.profiles drop column if exists avatar_url;
```

### 3. Restore Backup
- [ ] Restore database from backup (if needed)
- [ ] Verify data integrity
- [ ] Test application

---

## Post-Deployment

### 1. Monitor
- [ ] Check error logs for 24 hours
- [ ] Monitor Supabase storage usage
- [ ] Check application performance metrics
- [ ] Monitor user feedback

### 2. User Communication
- [ ] Announce new feature (if applicable)
- [ ] Provide instructions for avatar setup
- [ ] Gather user feedback

### 3. Documentation
- [ ] Update internal docs
- [ ] Update user guides (if applicable)
- [ ] Record any issues encountered
- [ ] Note any customizations made

---

## Success Metrics

After 1 week, check:
- [ ] % of users who set custom avatars
- [ ] Number of avatar uploads
- [ ] Storage space used
- [ ] Any error reports
- [ ] User feedback/satisfaction

---

## Common Issues & Solutions

### Issue: "avatar_url column does not exist"
**Solution:** Run the database migration SQL

### Issue: "avatars bucket not found"
**Solution:** Create bucket manually in Supabase Storage dashboard

### Issue: "Permission denied" when uploading
**Solution:** Verify storage policies are active and correct

### Issue: Avatars not displaying
**Solution:** Check Supabase URL in environment variables

### Issue: Upload fails silently
**Solution:** Check browser console, verify file size/type

### Issue: Predefined avatars not showing
**Solution:** Verify `boring-avatars` package is installed

---

## Completion Checklist

All must be checked before considering migration complete:

- [ ] Dependencies installed
- [ ] Database migration executed
- [ ] Database changes verified
- [ ] Local testing completed (all tests pass)
- [ ] Production deployment successful
- [ ] Production testing completed
- [ ] Security verification passed
- [ ] Rollback plan documented
- [ ] Monitoring in place
- [ ] Team notified

---

**Date Completed**: _________________

**Completed By**: _________________

**Notes**:
_________________________________________________
_________________________________________________
_________________________________________________
