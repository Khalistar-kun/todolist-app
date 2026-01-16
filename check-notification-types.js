import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function checkNotificationTypes() {
  const { data } = await supabase
    .from('notifications')
    .select('type')
    .limit(100)

  const uniqueTypes = [...new Set(data?.map(n => n.type) || [])]

  console.log('\n📧 Notification types in public.notifications:')
  console.log(uniqueTypes.join(', '))

  console.log('\n✅ TODOAAPP enum values (from create-todoaapp-schema.sql):')
  console.log("task_assigned, task_updated, task_completed, comment_added, mention, project_invite, organization_invite")

  console.log('\n❌ Types that need mapping:')
  const todoaappTypes = ['task_assigned', 'task_updated', 'task_completed', 'comment_added', 'mention', 'project_invite', 'organization_invite']
  const needMapping = uniqueTypes.filter(t => !todoaappTypes.includes(t))
  console.log(needMapping.length > 0 ? needMapping.join(', ') : 'None')
}

checkNotificationTypes().then(() => process.exit(0))
