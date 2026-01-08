import { supabase } from '@/lib/supabase'
import type { Organization } from '@/lib/supabase'

export interface CreateOrganizationData {
  name: string
  slug: string
  description?: string
}

export class OrganizationService {
  // Get user's organizations
  static async getUserOrganizations(): Promise<Organization[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // First get the membership records
    const { data: memberships, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)

    if (membershipError) {
      console.error('Error fetching memberships:', membershipError)
      throw membershipError
    }

    if (!memberships || memberships.length === 0) {
      return []
    }

    // Then fetch the organizations
    const orgIds = memberships.map(m => m.organization_id)
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .in('id', orgIds)

    if (orgError) {
      console.error('Error fetching organizations:', orgError)
      throw orgError
    }

    return organizations || []
  }

  // Get or create a default personal organization for the user
  static async getOrCreatePersonalOrganization(): Promise<Organization> {
    console.log('[OrgService] getOrCreatePersonalOrganization called')

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('[OrgService] Auth user:', user?.id, 'Error:', authError)

    if (!user) throw new Error('User not authenticated')

    // First, check if user already has any organization
    try {
      console.log('[OrgService] Checking for existing organizations...')
      const organizations = await this.getUserOrganizations()
      console.log('[OrgService] Found organizations:', organizations.length)
      if (organizations.length > 0) {
        return organizations[0]
      }
    } catch (error) {
      console.error('[OrgService] Error getting user organizations, will try to create:', error)
    }

    // Create a personal organization for the user
    const userEmail = user.email || 'user'
    const username = userEmail.split('@')[0]
    const slug = `${username}-personal-${Date.now()}`

    console.log('[OrgService] Creating new organization for:', username)

    const { data: org, error } = await supabase
      .from('organizations')
      .insert({
        name: `${username}'s Workspace`,
        slug: slug,
        description: 'Personal workspace',
        created_by: user.id,
      })
      .select()
      .single()

    console.log('[OrgService] Insert result - org:', org?.id, 'error:', error)

    if (error) {
      console.error('[OrgService] Error creating organization:', error)
      throw error
    }

    // Add user as owner of the organization
    console.log('[OrgService] Adding user as owner...')
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: 'owner',
      })

    if (memberError) {
      console.error('[OrgService] Error adding user as owner:', memberError)
      // Don't throw here, the org was created successfully
    }

    console.log('[OrgService] Organization created successfully:', org.id)
    return org
  }

  // Create a new organization
  static async createOrganization(data: CreateOrganizationData): Promise<Organization> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data: org, error } = await supabase
      .from('organizations')
      .insert({
        ...data,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    // Add creator as owner
    await supabase
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: 'owner',
      })

    return org
  }

  // Get an organization by ID
  static async getOrganization(orgId: string): Promise<Organization | null> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    return data
  }
}
