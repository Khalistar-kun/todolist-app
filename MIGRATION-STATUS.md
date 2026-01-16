# Migration Status - TODOAAPP Schema

## Current Status: Ready for Schema Exposure

All migration scripts have been prepared and tested. The API health check confirms that the next step is to expose the TODOAAPP schema in Supabase.

## What's Been Completed

### 1. Migration Scripts ✅
- [create-todoaapp-schema.sql](create-todoaapp-schema.sql) - Creates 19 tables in TODOAAPP schema
- [migrate-data-to-todoaapp.sql](migrate-data-to-todoaapp.sql) - Migrates all data with smart mappings
- [create-todoaapp-rls.sql](create-todoaapp-rls.sql) - Row Level Security policies (idempotent)

### 2. All Migration Errors Fixed ✅
1. ✅ Organizations: `avatar_url` → `logo_url`/`image_url`
2. ✅ Project Members: `member` role → `editor`
3. ✅ Activity Logs: Conditional migration for schema variations
4. ✅ Notifications: Type mapping (`task_moved` → `task_updated`)
5. ✅ Slack Integrations: Filter NULL `webhook_url` values

### 3. Health Check API ✅
- [app/api/health/route.ts](app/api/health/route.ts) - Updated to check TODOAAPP schema
- Currently returns warning status with instructions

## Current Health Check Result

```bash
curl http://localhost:3002/api/health
```

Response:
```json
{
  "status": "warning",
  "message": "TODOAAPP schema needs to be exposed in Supabase",
  "instructions": [
    "1. Go to Supabase Dashboard → Settings → API",
    "2. Scroll to \"Exposed schemas\"",
    "3. Add \"TODOAAPP\" to the list",
    "4. Click Save",
    "5. See EXPOSE-TODOAAPP-SCHEMA.md for details"
  ],
  "checks": {
    "TODOAAPP.profiles": { "status": "error", "error": "The schema must be one of the following: public, graphql_public" },
    "TODOAAPP.organizations": { "status": "error", ... },
    "TODOAAPP.projects": { "status": "error", ... },
    "TODOAAPP.tasks": { "status": "error", ... },
    "TODOAAPP.notifications": { "status": "error", ... }
  }
}
```

## Next Steps

### Step 1: Run Migration Scripts in Supabase

In Supabase SQL Editor, run in this order:

1. **Create Schema** (if not already done)
   ```
   create-todoaapp-schema.sql
   ```

2. **Migrate Data** (if you have existing data)
   ```
   migrate-data-to-todoaapp.sql
   ```
   - This script is idempotent (safe to run multiple times)
   - Skips Slack integrations with NULL webhook_url
   - Maps all enum values correctly

3. **Enable RLS**
   ```
   create-todoaapp-rls.sql
   ```
   - This script is idempotent (safe to run multiple times)
   - Drops existing policies before recreating

### Step 2: Expose TODOAAPP Schema

**Critical:** You MUST expose the TODOAAPP schema in Supabase settings:

1. Go to Supabase Dashboard
2. Navigate to **Settings** → **API**
3. Find **Exposed schemas** section
4. Add `TODOAAPP` to the list (currently: `public, graphql_public`)
5. Final should be: `public, graphql_public, TODOAAPP`
6. Click **Save**

See [EXPOSE-TODOAAPP-SCHEMA.md](EXPOSE-TODOAAPP-SCHEMA.md) for detailed instructions.

### Step 3: Update Backend Code

After exposing the schema, run:

```bash
node update-schema-references.js
```

This will update all API routes to use `TODOAAPP.table_name` instead of `table_name`.

### Step 4: Verify Health

After exposing the schema, test the health endpoint:

```bash
curl http://localhost:3002/api/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "All TODOAAPP schema tables accessible",
  "checks": {
    "TODOAAPP.profiles": { "status": "ok", "rowCount": 5 },
    "TODOAAPP.organizations": { "status": "ok", "rowCount": 2 },
    "TODOAAPP.projects": { "status": "ok", "rowCount": 3 },
    "TODOAAPP.tasks": { "status": "ok", "rowCount": 45 },
    "TODOAAPP.notifications": { "status": "ok", "rowCount": 12 }
  },
  "timestamp": "2026-01-16T..."
}
```

### Step 5: Test Application

1. Start dev server: `npm run dev`
2. Login to the application
3. Verify:
   - [ ] Can see organizations
   - [ ] Can see projects
   - [ ] Can see tasks
   - [ ] Can create new task
   - [ ] Can update task
   - [ ] Comments work
   - [ ] Notifications work

## Files Reference

| File | Purpose | Status |
|------|---------|--------|
| [create-todoaapp-schema.sql](create-todoaapp-schema.sql) | Creates TODOAAPP schema | ✅ Ready |
| [migrate-data-to-todoaapp.sql](migrate-data-to-todoaapp.sql) | Migrates data from public | ✅ Ready |
| [create-todoaapp-rls.sql](create-todoaapp-rls.sql) | Enables Row Level Security | ✅ Ready |
| [update-schema-references.js](update-schema-references.js) | Updates backend code | ✅ Ready |
| [EXPOSE-TODOAAPP-SCHEMA.md](EXPOSE-TODOAAPP-SCHEMA.md) | Schema exposure guide | ✅ Created |
| [app/api/health/route.ts](app/api/health/route.ts) | Health check endpoint | ✅ Updated |

## Rollback Plan

If needed, you can easily rollback:

1. Revert backend code:
   ```bash
   git checkout .
   ```

2. (Optional) Drop TODOAAPP schema:
   ```sql
   DROP SCHEMA TODOAAPP CASCADE;
   ```

3. Your `public` schema data is untouched!

## Summary

All migration scripts are ready and tested. The API is configured for TODOAAPP schema. The only remaining step is to **expose the TODOAAPP schema** in Supabase Dashboard settings, then update the backend code references.
