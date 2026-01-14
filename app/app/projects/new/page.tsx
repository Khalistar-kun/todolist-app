"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/app/providers/AuthProvider'
import { TeamService, Team } from '@/lib/services/TeamService'
import toast from 'react-hot-toast'

const DEFAULT_WORKFLOW_STAGES = [
  { id: 'todo', name: 'To Do', color: '#6B7280' },
  { id: 'in_progress', name: 'In Progress', color: '#3B82F6' },
  { id: 'review', name: 'Review', color: '#F59E0B' },
  { id: 'done', name: 'Done', color: '#10B981' },
]

const PROJECT_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Teal', value: '#14B8A6' },
]

function NewProjectForm() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedTeamId = searchParams.get('team_id')

  const [loading, setLoading] = useState(false)
  const [teams, setTeams] = useState<Team[]>([])
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    team_id: preselectedTeamId || '',
  })

  useEffect(() => {
    async function fetchTeams() {
      try {
        const userTeams = await TeamService.getUserTeams()
        setTeams(userTeams)
        // If preselected team_id is valid, keep it; otherwise clear
        if (preselectedTeamId && userTeams.some(t => t.id === preselectedTeamId)) {
          setFormData(prev => ({ ...prev, team_id: preselectedTeamId }))
        }
      } catch (error) {
        console.error('Error fetching teams:', error)
      } finally {
        setLoadingTeams(false)
      }
    }
    fetchTeams()
  }, [preselectedTeamId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Project name is required')
      return
    }

    if (!user) {
      toast.error('Please sign in to create a project')
      return
    }

    setLoading(true)

    try {
      // Use the API route which handles organization creation with admin privileges
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          color: formData.color,
          team_id: formData.team_id || null,
          organization_id: user.id, // Will be handled by API
          workflow_stages: DEFAULT_WORKFLOW_STAGES,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project')
      }

      toast.success('Project created successfully!')
      router.push(`/app/projects/${data.project.id}`)
    } catch (error: any) {
      console.error('Error creating project:', error)
      toast.error(error.message || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  // Group teams by organization
  const teamsByOrg = teams.reduce((acc, team) => {
    const orgId = team.organization_id
    if (!acc[orgId]) {
      acc[orgId] = {
        orgName: (team as any).organization?.name || 'Organization',
        teams: [],
      }
    }
    acc[orgId].teams.push(team)
    return acc
  }, {} as Record<string, { orgName: string; teams: Team[] }>)

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create New Project</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Set up a new project to start organizing your tasks.</p>
        </div>

        {/* Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Project Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Project Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input mt-1"
                placeholder="Enter project name"
              />
            </div>

            {/* Team Selection */}
            {!loadingTeams && teams.length > 0 && (
              <div>
                <label htmlFor="team" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Team <span className="text-gray-400">(optional)</span>
                </label>
                <select
                  id="team"
                  value={formData.team_id}
                  onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                  className="input mt-1"
                >
                  <option value="">No team (personal project)</option>
                  {Object.entries(teamsByOrg).map(([orgId, { orgName, teams: orgTeams }]) => (
                    <optgroup key={orgId} label={orgName}>
                      {orgTeams.map(team => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Assign this project to a team for better organization
                </p>
              </div>
            )}

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input mt-1"
                placeholder="Describe your project (optional)"
              />
            </div>

            {/* Color Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Project Color
              </label>
              <div className="grid grid-cols-4 gap-3">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    className={`relative flex items-center justify-center p-4 border-2 rounded-lg transition-colors ${
                      formData.color === color.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 shadow-sm"
                      style={{ backgroundColor: color.value }}
                    />
                    {formData.color === color.value && (
                      <div className="absolute top-1 right-1">
                        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Workflow Stages Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Default Workflow Stages
              </label>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_WORKFLOW_STAGES.map((stage) => (
                    <div
                      key={stage.id}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                      style={{ backgroundColor: stage.color }}
                    >
                      {stage.name}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  You can customize workflow stages after creating the project
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => router.back()}
                className="btn btn-md btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-md btn-primary"
              >
                {loading ? (
                  <>
                    <div className="spinner spinner-sm mr-2"></div>
                    Creating...
                  </>
                ) : (
                  'Create Project'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={
      <div className="px-4 py-6 sm:px-0">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="h-9 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
            <div className="h-5 w-64 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="card p-6">
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    }>
      <NewProjectForm />
    </Suspense>
  )
}
