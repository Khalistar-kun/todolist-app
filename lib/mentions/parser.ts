/**
 * Mention Parser Utility
 * Handles @mention detection, parsing, and rendering
 */

// Regex to match @mentions (username can contain letters, numbers, dots, underscores, hyphens)
const MENTION_REGEX = /@([a-zA-Z0-9_.-]+)/g

export interface ParsedMention {
  username: string
  startIndex: number
  endIndex: number
  raw: string
}

export interface MentionMatch {
  userId: string
  username: string
}

/**
 * Extract all @mentions from text
 */
export function extractMentions(text: string): ParsedMention[] {
  const mentions: ParsedMention[] = []
  let match: RegExpExecArray | null

  // Reset regex state
  MENTION_REGEX.lastIndex = 0

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    mentions.push({
      username: match[1].toLowerCase(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      raw: match[0],
    })
  }

  return mentions
}

/**
 * Get unique usernames from text
 */
export function getUniqueMentions(text: string): string[] {
  const mentions = extractMentions(text)
  return [...new Set(mentions.map((m) => m.username))]
}

/**
 * Check if text contains any mentions
 */
export function hasMentions(text: string): boolean {
  MENTION_REGEX.lastIndex = 0
  return MENTION_REGEX.test(text)
}

/**
 * Get the current mention being typed (for autocomplete)
 * Returns null if cursor is not in a mention context
 */
export function getCurrentMention(
  text: string,
  cursorPosition: number
): { query: string; startIndex: number } | null {
  // Look backwards from cursor to find @
  let start = cursorPosition - 1
  while (start >= 0) {
    const char = text[start]

    // Found the @ symbol
    if (char === '@') {
      const query = text.slice(start + 1, cursorPosition)
      // Validate that the query only contains valid mention characters
      if (/^[a-zA-Z0-9_.-]*$/.test(query)) {
        return { query, startIndex: start }
      }
      return null
    }

    // Hit a space or invalid character - not in a mention
    if (!/[a-zA-Z0-9_.-]/.test(char)) {
      return null
    }

    start--
  }

  return null
}

/**
 * Replace a mention in text with a resolved mention
 * Used when user selects from autocomplete
 */
export function replaceMention(
  text: string,
  startIndex: number,
  cursorPosition: number,
  replacement: string
): { text: string; newCursorPosition: number } {
  const before = text.slice(0, startIndex)
  const after = text.slice(cursorPosition)
  const newText = `${before}@${replacement} ${after}`

  return {
    text: newText,
    newCursorPosition: startIndex + replacement.length + 2, // +2 for @ and space
  }
}

/**
 * Render text with highlighted mentions
 * Returns array of segments for React rendering
 */
export interface TextSegment {
  type: 'text' | 'mention'
  content: string
  username?: string
}

export function parseTextWithMentions(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  const mentions = extractMentions(text)

  if (mentions.length === 0) {
    return [{ type: 'text', content: text }]
  }

  let lastIndex = 0

  for (const mention of mentions) {
    // Add text before mention
    if (mention.startIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, mention.startIndex),
      })
    }

    // Add mention
    segments.push({
      type: 'mention',
      content: mention.raw,
      username: mention.username,
    })

    lastIndex = mention.endIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    })
  }

  return segments
}

/**
 * Convert mention username to display format
 */
export function formatMentionDisplay(username: string): string {
  return `@${username}`
}

/**
 * Validate a username for mention
 */
export function isValidMentionUsername(username: string): boolean {
  return /^[a-zA-Z0-9_.-]+$/.test(username) && username.length >= 1 && username.length <= 50
}
