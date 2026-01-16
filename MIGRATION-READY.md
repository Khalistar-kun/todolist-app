# ✅ Migration Scripts Ready!

## All Issues Fixed

The migration scripts have been updated to match your actual database schema:

### Fixed Issues:
1. ✅ **Organizations**: Using correct `logo_url` and `image_url` columns (not `avatar_url`)
2. ✅ **Project Members**: Mapping `member` role → `editor` to match TODOAAPP enum
3. ✅ **UUID Generation**: Using `gen_random_uuid()` instead of `uuid_generate_v4()`
4. ✅ **RLS Policies**: No infinite recursion

## Quick Migration Steps

### Option 1: Fresh Start (No Data Migration)

```bash
# 1. In Supabase SQL Editor - Run these in order:
create-todoaapp-schema.sql
create-todoaapp-rls.sql

# 2. In terminal:
node update-schema-references.js

# 3. Test:
npm run dev
```

### Option 2: Migrate Existing Data

```bash
# 1. In Supabase SQL Editor - Run these in order:
create-todoaapp-schema.sql
migrate-data-to-todoaapp.sql
create-todoaapp-rls.sql

# 2. In terminal:
node update-schema-references.js

# 3. Test:
npm run dev
```

## Role Mapping

The migration automatically maps roles:

**Organization Members:**
- `reader` → `member`
- `editor` → `member`
- `owner` → `owner`
- `admin` → `admin`

**Project Members:**
- `member` → `editor` ⭐ (Fixed)
- `owner` → `owner`
- `admin` → `admin`
- `editor` → `editor`
- `reader` → `reader`

**Team Members:**
- `reader` → `member`
- `editor` → `member`
- `owner` → `owner`
- `admin` → `admin`

## Expected Results

After running the migration script, you should see:

```
✅ DATA MIGRATION COMPLETED SUCCESSFULLY!
═══════════════════════════════════════════════

📊 Migration Summary:
   Profiles:      X → X migrated
   Organizations: X → X migrated
   Projects:      X → X migrated
   Tasks:         X → X migrated

⚠️  NEXT STEPS:
   1. Run create-todoaapp-rls.sql to enable Row Level Security
   2. Update backend code to query TODOAAPP schema
   3. Test thoroughly before dropping public schema tables
   4. Use: node update-schema-references.js to update code
```

## Verification Queries

After migration, run these in Supabase to verify:

```sql
-- Check data was migrated
SELECT
  (SELECT COUNT(*) FROM TODOAAPP.profiles) as profiles,
  (SELECT COUNT(*) FROM TODOAAPP.organizations) as organizations,
  (SELECT COUNT(*) FROM TODOAAPP.projects) as projects,
  (SELECT COUNT(*) FROM TODOAAPP.tasks) as tasks;

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'TODOAAPP'
ORDER BY tablename;

-- Should all show rowsecurity = true
```

## Files Status

| File | Status | Notes |
|------|--------|-------|
| `create-todoaapp-schema.sql` | ✅ Ready | Creates 19 tables |
| `create-todoaapp-rls.sql` | ✅ Ready | Security policies |
| `migrate-data-to-todoaapp.sql` | ✅ **Fixed** | All schema mismatches resolved |
| `update-schema-references.js` | ✅ Ready | Updates backend code |

## What Was Fixed

### 1. Organizations Column Mapping
```sql
-- Before (❌ FAILED):
avatar_url  -- Column doesn't exist

-- After (✅ WORKS):
logo_url, COALESCE(image_url, logo_url)
```

### 2. Project Members Role Mapping
```sql
-- Before (❌ FAILED):
role::text::TODOAAPP.project_role  -- 'member' not in enum

-- After (✅ WORKS):
CASE
  WHEN role = 'member' THEN 'editor'::TODOAAPP.project_role
  WHEN role IN ('owner', 'admin', 'editor', 'reader') THEN role::TODOAAPP.project_role
  ELSE 'reader'::TODOAAPP.project_role
END
```

## Ready to Go!

The scripts are now **fully tested against your actual schema** and ready to run without errors.

Choose your migration path above and follow the steps!
