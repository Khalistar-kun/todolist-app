**Overview**
- Simple Next.js + Supabase to-do app with clients, list/Kanban views, assignments, due dates, reminders, and optional LLM-powered markdown import.

**Setup**
- Copy `.env.example` to `.env.local` and fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from your Supabase project.
- Optionally set `OPENAI_API_KEY` for smarter markdown parsing.
- Install deps: `npm install` inside `todolist`, then `npm run dev`.

**Database**
- In Supabase SQL editor, run `sql/schema.sql` to create tables and policies.

**Features**
- Clients sidebar, tasks per client, inline complete, due dates.
- Toggle between List and Kanban.
- Assign tasks to teammates by email.
- Paste weekly markdown to auto-create tasks grouped by clients.
- Local browser reminders for due tasks (when the tab is open).

**Notes**
- For scheduled notifications when the browser is closed, deploy a Supabase Edge Function + cron. This repo includes local notifications only.

