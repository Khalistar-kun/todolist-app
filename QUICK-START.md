# Quick Start: TODOAAPP Schema Migration

## ⚡ Fastest Path (Recommended for Development)

### Step 1: Run SQL Scripts in Supabase

Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql

**Script 1: Create Schema**
```sql
-- Copy entire contents of: create-todoaapp-schema.sql
-- Paste and run
-- Expected: ✅ TODOAAPP schema created successfully!
```

**Script 2: Migrate Data** (Optional - only if you want to keep existing data)
```sql
-- Copy entire contents of: migrate-data-to-todoaapp.sql
-- Paste and run
-- Expected: ✅ DATA MIGRATION COMPLETED SUCCESSFULLY!
```

**Script 3: Enable Security**
```sql
-- Copy entire contents of: create-todoaapp-rls.sql
-- Paste and run
-- Expected: ✅ RLS policies created successfully!
```

### Step 2: Update Backend Code

```bash
# In your project root
node update-schema-references.js
```

**Expected output:**
```
🔍 Updating schema references from public to TODOAAPP...

📁 Scanning: d:\todolist\todolist\app\api
   ✅ Updated: app\api\tasks\route.ts
   ✅ Updated: app\api\projects\route.ts
   ✅ Updated: app\api\organizations\route.ts
   ...

✨ Complete! Updated 15 file(s)
```

### Step 3: Test

```bash
npm run dev
```

Visit http://localhost:3000 and test:
- ✓ Login
- ✓ Create organization
- ✓ Create project
- ✓ Create task

## ✅ Done!

Your application is now using the TODOAAPP schema with:
- ✅ Fixed RLS policies (no infinite recursion)
- ✅ Proper UUID generation
- ✅ All 19 tables properly structured

## 🔙 Rollback (if needed)

```bash
# Revert code changes
git checkout .

# Drop new schema (your old data is still in public schema)
# Run in Supabase SQL Editor:
DROP SCHEMA TODOAAPP CASCADE;
```

## 📝 Notes

- **Data preserved**: If you ran the migration script, all your data is copied to TODOAAPP
- **Old tables intact**: Your public schema tables are untouched
- **Safe to test**: Can easily rollback if anything goes wrong
- **No downtime**: Run during development/off-hours

## ❓ Troubleshooting

### "Column does not exist" error
The migration script has been fixed to match your actual schema. Re-download and run again.

### "Infinite recursion" error
Make sure you're using the NEW `create-todoaapp-rls.sql` file, not the old one.

### Backend still errors after migration
```bash
# Clear Next.js cache
rm -rf .next

# Restart
npm run dev
```

---

**Ready?** Just follow Step 1 → Step 2 → Step 3 above!
