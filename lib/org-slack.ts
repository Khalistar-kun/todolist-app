/**
 * Organization Slack Integration Library
 * Handles sending notifications to Slack for organization events
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type OrgSlackConfig = {
  access_token: string
  channel_id: string
  channel_name?: string | null
  notify_on_announcement: boolean
  notify_on_meeting: boolean
  notify_on_member_join: boolean
  notify_on_member_leave: boolean
}

export type SlackMessageResponse = {
  ok: boolean
  error?: string
  ts?: string
}

/**
 * Send a Slack message using chat.postMessage API
 */
async function sendSlackMessage(
  accessToken: string,
  channelId: string,
  text: string,
  blocks?: any[]
): Promise<SlackMessageResponse> {
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        text,
        blocks: blocks || undefined,
      }),
    })

    const result = await response.json()

    if (!result.ok) {
      console.error('Slack API error:', result.error)
      return { ok: false, error: result.error }
    }

    return { ok: true, ts: result.ts }
  } catch (error) {
    console.error('Failed to send Slack message:', error)
    return { ok: false, error: String(error) }
  }
}

/**
 * Fetch Slack configuration for an organization
 */
export async function getOrgSlackConfig(
  supabase: SupabaseClient,
  organizationId: string
): Promise<OrgSlackConfig | null> {
  try {
    const { data, error } = await supabase
      .from('org_slack_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .single()

    if (error || !data || !data.access_token || !data.channel_id) {
      return null
    }

    return {
      access_token: data.access_token,
      channel_id: data.channel_id,
      channel_name: data.channel_name,
      notify_on_announcement: data.notify_on_announcement,
      notify_on_meeting: data.notify_on_meeting,
      notify_on_member_join: data.notify_on_member_join,
      notify_on_member_leave: data.notify_on_member_leave,
    }
  } catch (error) {
    console.error('Failed to fetch org Slack config:', error)
    return null
  }
}

/**
 * Notify about new announcement
 */
export async function notifyOrgAnnouncement(
  config: OrgSlackConfig,
  orgName: string,
  title: string,
  content: string,
  posterName: string
): Promise<SlackMessageResponse> {
  if (!config.notify_on_announcement) {
    return { ok: true }
  }

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📢 New Announcement in ${orgName}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${title}*\n\n${content}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Posted by ${posterName}`,
        },
      ],
    },
  ]

  return sendSlackMessage(
    config.access_token,
    config.channel_id,
    `📢 New announcement in ${orgName}: ${title}`,
    blocks
  )
}

/**
 * Notify about new meeting scheduled
 */
export async function notifyOrgMeeting(
  config: OrgSlackConfig,
  orgName: string,
  title: string,
  description: string | null,
  scheduledAt: string,
  durationMinutes: number,
  meetingLink: string | null,
  schedulerName: string
): Promise<SlackMessageResponse> {
  if (!config.notify_on_meeting) {
    return { ok: true }
  }

  const meetingDate = new Date(scheduledAt)
  const formattedDate = meetingDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📅 New Meeting Scheduled`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${title}*${description ? `\n\n${description}` : ''}`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*When:*\n${formattedDate}`,
        },
        {
          type: 'mrkdwn',
          text: `*Duration:*\n${durationMinutes} minutes`,
        },
      ],
    },
  ]

  if (meetingLink) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Meeting Link:* <${meetingLink}|Join Meeting>`,
      },
    })
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Scheduled by ${schedulerName} for ${orgName}`,
      },
    ],
  })

  return sendSlackMessage(
    config.access_token,
    config.channel_id,
    `📅 New meeting scheduled in ${orgName}: ${title} on ${formattedDate}`,
    blocks
  )
}

/**
 * Notify about new member joining
 */
export async function notifyOrgMemberJoined(
  config: OrgSlackConfig,
  orgName: string,
  memberName: string,
  memberEmail: string,
  role: string,
  inviterName: string
): Promise<SlackMessageResponse> {
  if (!config.notify_on_member_join) {
    return { ok: true }
  }

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `👋 New Member Joined ${orgName}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${memberName}* has joined the organization as *${role}*`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Added by ${inviterName}`,
        },
      ],
    },
  ]

  return sendSlackMessage(
    config.access_token,
    config.channel_id,
    `👋 ${memberName} has joined ${orgName} as ${role}`,
    blocks
  )
}

/**
 * Notify about member leaving
 */
export async function notifyOrgMemberLeft(
  config: OrgSlackConfig,
  orgName: string,
  memberName: string,
  removedBy: string | null
): Promise<SlackMessageResponse> {
  if (!config.notify_on_member_leave) {
    return { ok: true }
  }

  const message = removedBy
    ? `*${memberName}* was removed from the organization by ${removedBy}`
    : `*${memberName}* has left the organization`

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `👤 Member Left ${orgName}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: message,
      },
    },
  ]

  return sendSlackMessage(
    config.access_token,
    config.channel_id,
    removedBy ? `👤 ${memberName} was removed from ${orgName}` : `👤 ${memberName} has left ${orgName}`,
    blocks
  )
}
