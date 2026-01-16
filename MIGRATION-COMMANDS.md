# TODOAAPP Schema Migration - Command Reference

Quick reference for running the migration.

## Prerequisites

- [ ] Supabase project is accessible
- [ ] Have access to Supabase SQL Editor
- [ ] Node.js installed (for code update script)
- [ ] Git committed recent changes (for easy rollback)

## Step 1: Choose Your Migration Path

### Path A: Fresh Start (Development) ⚡
**Use when:** Starting fresh, no important data to keep

```bash
# Time: ~2 minutes
# Data loss: Yes (all current data will be lost)
```

### Path B: Full Migration (Production) 🔄
**Use when:** Need to preserve existing data

```bash
# Time: ~5-10 minutes
# Data loss: No (all data migrated)
```

---

## Path A: Fresh Start Commands

### In Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql):

#### Step 1: Create Schema
```sql
-- Copy and paste contents of: create-todoaapp-schema.sql
-- Or upload the file
```

#### Step 2: Enable RLS
```sql
-- Copy and paste contents of: create-todoaapp-rls.sql
-- Or upload the file
```

### In Your Terminal:

#### Step 3: Update Backend Code
```bash
# Navigate to project directory
cd d:\todolist\todolist

# Run the update script
node update-schema-references.js

# You should see:
# ✅ Updated: app/api/tasks/route.ts
# ✅ Updated: app/api/projects/route.ts
# ... etc
```

#### Step 4: Verify Changes
```bash
# Check git diff to see what changed
git diff

# Look for changes like:
# - .from('tasks')
# + .from('TODOAAPP.tasks')
```

#### Step 5: Test
```bash
# Start development server
npm run dev

# Visit http://localhost:3000
# Create new organization, project, and tasks
```

---

## Path B: Full Migration Commands

### In Supabase SQL Editor:

#### Step 1: Create Schema
```sql
-- Copy and paste contents of: create-todoaapp-schema.sql
-- Expected output: ✅ TODOAAPP schema created successfully!
```

#### Step 2: Migrate Data
```sql
-- Copy and paste contents of: migrate-data-to-todoaapp.sql
-- Expected output:
-- ✅ DATA MIGRATION COMPLETED SUCCESSFULLY!
-- Profiles: 5 → 5 migrated
-- Organizations: 2 → 2 migrated
-- Projects: 3 → 3 migrated
-- Tasks: 50 → 50 migrated
```

#### Step 3: Enable RLS
```sql
-- Copy and paste contents of: create-todoaapp-rls.sql
-- Expected output: ✅ RLS policies created successfully!
```

### In Your Terminal:

#### Step 4: Update Backend Code
```bash
cd d:\todolist\todolist
node update-schema-references.js
```

#### Step 5: Verify Changes
```bash
git diff
# Review all the schema prefix additions
```

#### Step 6: Test Thoroughly
```bash
npm run dev

# Test these features:
# ✓ Login/authentication
# ✓ View existing organizations
# ✓ View existing projects
# ✓ View existing tasks
# ✓ Create new task
# ✓ Update task
# ✓ Delete task
# ✓ Comments
# ✓ Attachments
# ✓ Time tracking
```

---

## Verification Queries

Run these in Supabase SQL Editor to verify migration:

```sql
-- Check row counts in TODOAAPP schema
SELECT
  (SELECT COUNT(*) FROM TODOAAPP.profiles) as profiles,
  (SELECT COUNT(*) FROM TODOAAPP.organizations) as organizations,
  (SELECT COUNT(*) FROM TODOAAPP.projects) as projects,
  (SELECT COUNT(*) FROM TODOAAPP.tasks) as tasks,
  (SELECT COUNT(*) FROM TODOAAPP.comments) as comments;

-- Check RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'TODOAAPP'
ORDER BY tablename;

-- All should show rls_enabled = true
```

---

## Rollback Commands

If something goes wrong:

### Step 1: Revert Code Changes
```bash
# If you haven't committed yet
git checkout .

# If you committed
git reset --hard HEAD~1
```

### Step 2: Drop TODOAAPP Schema (Optional)
```sql
-- In Supabase SQL Editor
DROP SCHEMA TODOAAPP CASCADE;
```

Your `public` schema tables are still intact!

---

## Troubleshooting

### Issue: "Function uuid_generate_v4() does not exist"
**Solution:** The script has been fixed. Re-download `create-todoaapp-schema.sql`

### Issue: "Infinite recursion detected"
**Solution:** Make sure you run `create-todoaapp-rls.sql` (not the old RLS script)

### Issue: "Table already exists"
**Solution:** The scripts use `CREATE TABLE IF NOT EXISTS`, so this is safe to ignore

### Issue: Backend still shows errors after migration
**Solution:**
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
npm install

# Restart dev server
npm run dev
```

### Issue: "Cannot find module" error when running update script
**Solution:**
```bash
# Make sure you have type: "module" in package.json
# OR rename the file to .mjs
mv update-schema-references.js update-schema-references.mjs
node update-schema-references.mjs
```

---

## Post-Migration Cleanup (Optional)

After everything works perfectly for a few days:

```sql
-- ⚠️ ONLY run this after thorough testing!
-- This will permanently delete the old tables

DROP TABLE IF EXISTS public.attention_items CASCADE;
DROP TABLE IF EXISTS public.mentions CASCADE;
DROP TABLE IF EXISTS public.slack_integrations CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.time_entries CASCADE;
DROP TABLE IF EXISTS public.attachments CASCADE;
DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.subtasks CASCADE;
DROP TABLE IF EXISTS public.task_assignments CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.project_members CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.organization_members CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
```

---

## Quick Command Summary

```bash
# Development (Fresh Start)
1. Run create-todoaapp-schema.sql in Supabase
2. Run create-todoaapp-rls.sql in Supabase
3. node update-schema-references.js
4. npm run dev

# Production (Migrate Data)
1. Run create-todoaapp-schema.sql in Supabase
2. Run migrate-data-to-todoaapp.sql in Supabase
3. Run create-todoaapp-rls.sql in Supabase
4. node update-schema-references.js
5. npm run dev
6. Test everything thoroughly
```

---

## Files Reference

| File | Purpose | When to Run |
|------|---------|-------------|
| `create-todoaapp-schema.sql` | Creates tables | First |
| `migrate-data-to-todoaapp.sql` | Copies data | Second (if migrating) |
| `create-todoaapp-rls.sql` | Security policies | Last (SQL) |
| `update-schema-references.js` | Updates code | After SQL scripts |

---

## Need Help?

1. Read `MIGRATION-TO-TODOAAPP-SCHEMA.md` for detailed explanation
2. Check `TODOAAPP-MIGRATION-SUMMARY.md` for overview
3. Review the SQL scripts for comments explaining each section
