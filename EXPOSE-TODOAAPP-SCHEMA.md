# Exposing TODOAAPP Schema in Supabase

## Critical Configuration Required

After running the migration scripts, you MUST expose the TODOAAPP schema in Supabase so that the API can access it.

## Steps to Expose TODOAAPP Schema

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Scroll down to **Exposed schemas**
4. Add `TODOAAPP` to the list of exposed schemas
5. Click **Save**

The default exposed schemas are usually: `public, storage, graphql_public`

After adding TODOAAPP, it should be: `public, storage, graphql_public, TODOAAPP`

### Option 2: SQL Command

Run this SQL command in Supabase SQL Editor:

```sql
-- Expose TODOAAPP schema to PostgREST
NOTIFY pgrst, 'reload schema';

-- Or manually add to postgrest.conf if you have access
-- db-schemas = "public, TODOAAPP"
```

## Verification

After exposing the schema, test the API health endpoint:

```bash
curl http://localhost:3002/api/health
```

You should see a response like:

```json
{
  "status": "ok",
  "message": "All TODOAAPP schema tables accessible",
  "checks": {
    "TODOAAPP.profiles": { "status": "ok" },
    "TODOAAPP.organizations": { "status": "ok" },
    "TODOAAPP.projects": { "status": "ok" },
    "TODOAAPP.tasks": { "status": "ok" },
    "TODOAAPP.notifications": { "status": "ok" }
  },
  "timestamp": "2026-01-16T..."
}
```

## Why This Is Needed

Supabase uses PostgREST to expose PostgreSQL tables as REST APIs. By default, PostgREST only exposes the `public` schema. When we created the TODOAAPP schema, we need to explicitly tell PostgREST to expose it.

Without this configuration:
- `.from('table')` will look in `public` schema (old data)
- `.from('TODOAAPP.table')` will fail with "schema not exposed" error
- The Supabase client cannot access TODOAAPP tables

## Alternative: Use Service Role Direct Queries

If you cannot expose the schema for some reason, you can use direct SQL queries:

```typescript
const { data, error } = await supabase.rpc('custom_function_name', {
  // parameters
})
```

But this is less convenient than the standard `.from()` API.
