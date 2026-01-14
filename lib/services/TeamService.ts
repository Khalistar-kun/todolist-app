export interface Team {
  id: string
  name: string
  description: string | null
  color: string
  image_url: string | null
  organization_id: string
  created_by: string | null
  created_at: string
  updated_at: string
  user_role?: string
  joined_at?: string
  members_count?: number
  projects_count?: number
  organization?: {
    id: string
    name: string
  }
}

export interface TeamMember {
  id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
  user: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

export interface TeamWithDetails extends Team {
  members: TeamMember[]
  projects: {
    id: string
    name: string
    description: string | null
    color: string
    image_url: string | null
    status: string
    created_at: string
  }[]
}

export class TeamService {
  /**
   * Get all teams for the current user
   */
  static async getUserTeams(organizationId?: string): Promise<Team[]> {
    const params = new URLSearchParams()
    if (organizationId) {
      params.set('organization_id', organizationId)
    }

    const response = await fetch(`/api/teams?${params.toString()}`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch teams')
    }

    const data = await response.json()
    return data.teams
  }

  /**
   * Get a single team with full details
   */
  static async getTeam(teamId: string): Promise<TeamWithDetails> {
    const response = await fetch(`/api/teams/${teamId}`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch team')
    }

    const data = await response.json()
    return data.team
  }

  /**
   * Create a new team
   */
  static async createTeam(data: {
    name: string
    description?: string
    color?: string
    organization_id: string
    image_url?: string
  }): Promise<Team> {
    const response = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create team')
    }

    const result = await response.json()
    return result.team
  }

  /**
   * Update a team
   */
  static async updateTeam(
    teamId: string,
    data: {
      name?: string
      description?: string
      color?: string
      image_url?: string
    }
  ): Promise<Team> {
    const response = await fetch(`/api/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update team')
    }

    const result = await response.json()
    return result.team
  }

  /**
   * Delete a team
   */
  static async deleteTeam(teamId: string): Promise<void> {
    const response = await fetch(`/api/teams/${teamId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete team')
    }
  }

  /**
   * Add a member to a team
   */
  static async addMember(
    teamId: string,
    userId: string,
    role: 'owner' | 'admin' | 'member' = 'member'
  ): Promise<TeamMember> {
    const response = await fetch(`/api/teams/${teamId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to add member')
    }

    const result = await response.json()
    return result.member
  }

  /**
   * Remove a member from a team
   */
  static async removeMember(teamId: string, userId: string): Promise<void> {
    const response = await fetch(`/api/teams/${teamId}/members?user_id=${userId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to remove member')
    }
  }

  /**
   * Update a member's role
   */
  static async updateMemberRole(
    teamId: string,
    userId: string,
    role: 'owner' | 'admin' | 'member'
  ): Promise<TeamMember> {
    const response = await fetch(`/api/teams/${teamId}/members`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update member role')
    }

    const result = await response.json()
    return result.member
  }
}
