/**
 * Table of Contents Generator
 * Parses HTML content and extracts headings to create a hierarchical TOC
 */

export interface TOCItem {
  id: string
  text: string
  level: number
}

/**
 * Generates a unique ID from heading text
 */
function generateHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Parses HTML content and extracts h2, h3, h4 headings
 * Adds IDs to headings for anchor links
 * Returns array of TOC items
 */
export function generateTOC(htmlContent: string): {
  toc: TOCItem[]
  updatedHtml: string
} {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlContent, 'text/html')

  const headings = doc.querySelectorAll('h2, h3, h4')
  const toc: TOCItem[] = []
  const usedIds = new Set<string>()

  headings.forEach((heading) => {
    const text = heading.textContent?.trim() || ''
    if (!text) return

    const level = parseInt(heading.tagName.substring(1))

    // Generate unique ID
    let id = generateHeadingId(text)
    let counter = 1
    while (usedIds.has(id)) {
      id = `${generateHeadingId(text)}-${counter}`
      counter++
    }
    usedIds.add(id)

    // Add ID to heading if it doesn't have one
    if (!heading.id) {
      heading.id = id
    }

    toc.push({
      id: heading.id,
      text,
      level,
    })
  })

  // Serialize back to HTML
  const updatedHtml = doc.body.innerHTML

  return {
    toc,
    updatedHtml,
  }
}

/**
 * Server-side version using jsdom (for Node.js environment)
 */
export function generateTOCServer(htmlContent: string): {
  toc: TOCItem[]
  updatedHtml: string
} {
  // For server-side, we'll use a simple regex-based approach
  const headingRegex = /<(h[2-4])>(.*?)<\/\1>/gi
  const toc: TOCItem[] = []
  const usedIds = new Set<string>()

  let updatedHtml = htmlContent
  const matches = [...htmlContent.matchAll(headingRegex)]

  matches.forEach((match) => {
    const [fullMatch, tag, text] = match
    const level = parseInt(tag.substring(1))
    const cleanText = text.replace(/<[^>]*>/g, '').trim()

    if (!cleanText) return

    // Generate unique ID
    let id = generateHeadingId(cleanText)
    let counter = 1
    while (usedIds.has(id)) {
      id = `${generateHeadingId(cleanText)}-${counter}`
      counter++
    }
    usedIds.add(id)

    // Check if heading already has an ID
    const hasId = fullMatch.includes('id=')

    if (!hasId) {
      // Add ID to the heading
      const newHeading = `<${tag} id="${id}">${text}</${tag}>`
      updatedHtml = updatedHtml.replace(fullMatch, newHeading)
    }

    toc.push({
      id,
      text: cleanText,
      level,
    })
  })

  return {
    toc,
    updatedHtml,
  }
}

/**
 * Builds a nested/hierarchical TOC structure
 * Useful for rendering nested lists
 */
export interface NestedTOCItem extends TOCItem {
  children?: NestedTOCItem[]
}

export function buildNestedTOC(items: TOCItem[]): NestedTOCItem[] {
  const root: NestedTOCItem[] = []
  const stack: NestedTOCItem[] = []

  items.forEach((item) => {
    const tocItem: NestedTOCItem = { ...item, children: [] }

    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop()
    }

    if (stack.length === 0) {
      root.push(tocItem)
    } else {
      const parent = stack[stack.length - 1]
      if (!parent.children) {
        parent.children = []
      }
      parent.children.push(tocItem)
    }

    stack.push(tocItem)
  })

  return root
}
