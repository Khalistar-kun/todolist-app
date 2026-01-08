'use client'

import { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Link as LinkIcon,
  Table,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Undo,
  Redo,
} from 'lucide-react'
import { useState } from 'react'
import { ImageUploadButton } from './ImageUploadButton'
import { InternalLinkButton } from './InternalLinkButton'

interface EditorToolbarProps {
  editor: Editor | null
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  if (!editor) {
    return null
  }

  const addLink = () => {
    if (linkUrl) {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: linkUrl })
        .run()

      setLinkUrl('')
      setShowLinkInput(false)
    }
  }

  const removeLink = () => {
    editor.chain().focus().unsetLink().run()
  }

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  const insertImage = (url: string, alt: string) => {
    editor.chain().focus().setImage({ src: url, alt }).run()
  }

  const ToolbarButton = ({
    onClick,
    active,
    disabled,
    children,
    title,
  }: {
    onClick: () => void
    active?: boolean
    disabled?: boolean
    children: React.ReactNode
    title: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded transition-colors ${
        active
          ? 'bg-brand-500 text-white'
          : 'hover:bg-gray-100 text-gray-700'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )

  const Divider = () => <div className="w-px h-6 bg-gray-300 mx-1" />

  return (
    <div className="border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
      <div className="flex flex-wrap items-center gap-1 p-2">
        {/* History */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo size={18} />
        </ToolbarButton>

        <Divider />

        {/* Headings */}
        <div className="relative group">
          <button
            type="button"
            className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            Headings ▾
          </button>
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block min-w-[160px] z-20">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 ${
                editor.isActive('heading', { level: 1 }) ? 'bg-brand-50 text-brand-600' : ''
              }`}
            >
              <Heading1 size={18} />
              <span className="text-2xl font-bold">Heading 1</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 ${
                editor.isActive('heading', { level: 2 }) ? 'bg-brand-50 text-brand-600' : ''
              }`}
            >
              <Heading2 size={18} />
              <span className="text-xl font-bold">Heading 2</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={`w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 ${
                editor.isActive('heading', { level: 3 }) ? 'bg-brand-50 text-brand-600' : ''
              }`}
            >
              <Heading3 size={18} />
              <span className="text-lg font-bold">Heading 3</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
              className={`w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 ${
                editor.isActive('heading', { level: 4 }) ? 'bg-brand-50 text-brand-600' : ''
              }`}
            >
              <Heading4 size={18} />
              <span className="text-base font-bold">Heading 4</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
              className={`w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 ${
                editor.isActive('heading', { level: 5 }) ? 'bg-brand-50 text-brand-600' : ''
              }`}
            >
              <Heading5 size={18} />
              <span className="text-sm font-bold">Heading 5</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
              className={`w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 ${
                editor.isActive('heading', { level: 6 }) ? 'bg-brand-50 text-brand-600' : ''
              }`}
            >
              <Heading6 size={18} />
              <span className="text-xs font-bold">Heading 6</span>
            </button>
          </div>
        </div>

        <Divider />

        {/* Text Formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <Bold size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <Italic size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="Code"
        >
          <Code size={18} />
        </ToolbarButton>

        <Divider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered size={18} />
        </ToolbarButton>

        <Divider />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          title="Align Left"
        >
          <AlignLeft size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          title="Align Center"
        >
          <AlignCenter size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          title="Align Right"
        >
          <AlignRight size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          active={editor.isActive({ textAlign: 'justify' })}
          title="Justify"
        >
          <AlignJustify size={18} />
        </ToolbarButton>

        <Divider />

        {/* Links */}
        <div className="relative">
          {showLinkInput ? (
            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded px-2 py-1">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-48 text-sm border-none focus:outline-none focus:ring-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addLink()
                  }
                  if (e.key === 'Escape') {
                    setShowLinkInput(false)
                    setLinkUrl('')
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={addLink}
                className="px-2 py-1 bg-brand-500 text-white text-sm rounded hover:bg-brand-600"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLinkInput(false)
                  setLinkUrl('')
                }}
                className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
          ) : (
            <ToolbarButton
              onClick={() => {
                if (editor.isActive('link')) {
                  removeLink()
                } else {
                  setShowLinkInput(true)
                }
              }}
              active={editor.isActive('link')}
              title={editor.isActive('link') ? 'Remove Link' : 'Add External Link'}
            >
              <LinkIcon size={18} />
            </ToolbarButton>
          )}
        </div>

        {/* Internal Link */}
        <InternalLinkButton editor={editor} />

        {/* Image */}
        <ImageUploadButton onImageInsert={insertImage} />

        {/* Table */}
        <ToolbarButton onClick={insertTable} title="Insert Table">
          <Table size={18} />
        </ToolbarButton>

        <Divider />

        {/* Callouts */}
        <div className="relative group">
          <button
            type="button"
            className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            Callout ▾
          </button>
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block min-w-[160px] z-20">
            <button
              type="button"
              onClick={() => editor.chain().focus().setCallout('info').run()}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-blue-600"
            >
              <Info size={18} />
              Info
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setCallout('warning').run()}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-yellow-600"
            >
              <AlertTriangle size={18} />
              Warning
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setCallout('success').run()}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-green-600"
            >
              <CheckCircle size={18} />
              Success
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setCallout('error').run()}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-red-600"
            >
              <XCircle size={18} />
              Error
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
