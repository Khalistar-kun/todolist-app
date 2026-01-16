import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function checkRoles() {
  console.log('\n🔍 Checking roles in tables...\n')

  // Check organization_members roles
  const { data: orgRoles } = await supabase
    .from('organization_members')
    .select('role')
    .limit(100)

  const uniqueOrgRoles = [...new Set(orgRoles?.map(r => r.role) || [])]
  console.log('Organization member roles:', uniqueOrgRoles.join(', '))

  // Check project_members roles
  const { data: projRoles } = await supabase
    .from('project_members')
    .select('role')
    .limit(100)

  const uniqueProjRoles = [...new Set(projRoles?.map(r => r.role) || [])]
  console.log('Project member roles:', uniqueProjRoles.join(', '))

  // Check team_members roles
  const { data: teamRoles } = await supabase
    .from('team_members')
    .select('role')
    .limit(100)

  const uniqueTeamRoles = [...new Set(teamRoles?.map(r => r.role) || [])]
  console.log('Team member roles:', uniqueTeamRoles.join(', '))
}

checkRoles().then(() => process.exit(0))
