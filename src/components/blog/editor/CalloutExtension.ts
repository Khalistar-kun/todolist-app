import { Node, mergeAttributes } from '@tiptap/core'

export interface CalloutOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (type: 'info' | 'warning' | 'success' | 'error') => ReturnType
    }
  }
}

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',

  group: 'block',

  content: 'block+',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: element => element.getAttribute('data-type'),
        renderHTML: attributes => {
          return {
            'data-type': attributes.type,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes['data-type'] || 'info'

    const colors = {
      info: 'bg-blue-50 border-blue-200 text-blue-900',
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
      success: 'bg-green-50 border-green-200 text-green-900',
      error: 'bg-red-50 border-red-200 text-red-900',
    }

    return [
      'div',
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        {
          'data-callout': '',
          class: `callout callout-${type} rounded-lg border-2 p-4 my-4 ${colors[type as keyof typeof colors]}`,
        }
      ),
      0,
    ]
  },

  addCommands() {
    return {
      setCallout:
        (type: 'info' | 'warning' | 'success' | 'error') =>
        ({ commands }) => {
          return commands.setNode(this.name, { type })
        },
    }
  },
})
