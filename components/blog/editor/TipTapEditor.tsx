'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import { Callout } from './CalloutExtension'
import { EditorToolbar } from './EditorToolbar'

interface TipTapEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export function TipTapEditor({ content, onChange, placeholder = 'Start writing your post...' }: TipTapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto my-4',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-brand-500 underline hover:text-brand-600',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full my-4 border border-gray-300',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border border-gray-300',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 bg-gray-50 px-4 py-2 text-left font-semibold',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 px-4 py-2',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-yellow-200',
        },
      }),
      Callout,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none focus:outline-none min-h-[500px] px-6 py-4',
      },
    },
  })

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />

      <style jsx global>{`
        .ProseMirror {
          outline: none;
        }

        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #999;
          pointer-events: none;
          height: 0;
        }

        .ProseMirror h1 {
          font-size: 2.25em;
          font-weight: 700;
          line-height: 1.2;
          margin-top: 0.67em;
          margin-bottom: 0.67em;
          color: #1a1a1a;
        }

        .ProseMirror h2 {
          font-size: 1.875em;
          font-weight: 700;
          line-height: 1.3;
          margin-top: 0.75em;
          margin-bottom: 0.5em;
          color: #1a1a1a;
        }

        .ProseMirror h3 {
          font-size: 1.5em;
          font-weight: 600;
          line-height: 1.4;
          margin-top: 0.75em;
          margin-bottom: 0.5em;
          color: #1a1a1a;
        }

        .ProseMirror h4 {
          font-size: 1.25em;
          font-weight: 600;
          line-height: 1.4;
          margin-top: 0.75em;
          margin-bottom: 0.5em;
          color: #1a1a1a;
        }

        .ProseMirror h5 {
          font-size: 1.125em;
          font-weight: 600;
          line-height: 1.5;
          margin-top: 0.75em;
          margin-bottom: 0.5em;
          color: #1a1a1a;
        }

        .ProseMirror h6 {
          font-size: 1em;
          font-weight: 600;
          line-height: 1.5;
          margin-top: 0.75em;
          margin-bottom: 0.5em;
          color: #1a1a1a;
        }

        .ProseMirror p {
          margin-top: 0.75em;
          margin-bottom: 0.75em;
          line-height: 1.75;
        }

        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5em;
          margin-top: 0.75em;
          margin-bottom: 0.75em;
        }

        .ProseMirror ul {
          list-style-type: disc;
        }

        .ProseMirror ol {
          list-style-type: decimal;
        }

        .ProseMirror li {
          margin-top: 0.25em;
          margin-bottom: 0.25em;
        }

        .ProseMirror code {
          background-color: #f3f4f6;
          border-radius: 0.25rem;
          padding: 0.125rem 0.375rem;
          font-family: 'Courier New', monospace;
          font-size: 0.875em;
          color: #d97706;
        }

        .ProseMirror pre {
          background-color: #1f2937;
          color: #f9fafb;
          border-radius: 0.5rem;
          padding: 1rem;
          overflow-x: auto;
          margin-top: 1em;
          margin-bottom: 1em;
        }

        .ProseMirror pre code {
          background-color: transparent;
          padding: 0;
          color: inherit;
          font-size: 0.875em;
        }

        .ProseMirror blockquote {
          border-left: 4px solid #FF9F66;
          padding-left: 1rem;
          margin-left: 0;
          margin-top: 1em;
          margin-bottom: 1em;
          color: #4b5563;
          font-style: italic;
        }

        .ProseMirror hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin-top: 2em;
          margin-bottom: 2em;
        }

        .ProseMirror a {
          color: #FF9F66;
          text-decoration: underline;
          cursor: pointer;
        }

        .ProseMirror a:hover {
          color: #ff8a47;
        }

        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin-top: 1em;
          margin-bottom: 1em;
        }

        .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
          margin-top: 1em;
          margin-bottom: 1em;
        }

        .ProseMirror th,
        .ProseMirror td {
          border: 1px solid #d1d5db;
          padding: 0.75rem;
          text-align: left;
        }

        .ProseMirror th {
          background-color: #f9fafb;
          font-weight: 600;
        }

        .ProseMirror .selectedCell {
          background-color: #e0f2fe;
        }

        /* Callout styles */
        .ProseMirror .callout {
          border-radius: 0.5rem;
          border-width: 2px;
          padding: 1rem;
          margin-top: 1em;
          margin-bottom: 1em;
        }

        .ProseMirror .callout-info {
          background-color: #eff6ff;
          border-color: #bfdbfe;
          color: #1e40af;
        }

        .ProseMirror .callout-warning {
          background-color: #fef3c7;
          border-color: #fde68a;
          color: #92400e;
        }

        .ProseMirror .callout-success {
          background-color: #ecfdf5;
          border-color: #a7f3d0;
          color: #065f46;
        }

        .ProseMirror .callout-error {
          background-color: #fee2e2;
          border-color: #fecaca;
          color: #991b1b;
        }

        /* Mobile responsiveness */
        @media (max-width: 640px) {
          .ProseMirror {
            padding: 1rem;
          }

          .ProseMirror h1 {
            font-size: 1.875em;
          }

          .ProseMirror h2 {
            font-size: 1.5em;
          }

          .ProseMirror h3 {
            font-size: 1.25em;
          }

          .ProseMirror table {
            font-size: 0.875em;
          }

          .ProseMirror th,
          .ProseMirror td {
            padding: 0.5rem;
          }
        }
      `}</style>
    </div>
  )
}
