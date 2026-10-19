import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { Bold, Heading2, Italic, Link2, List, ListChecks, ListOrdered, Redo2, Undo2 } from 'lucide-react'

// Rich text box (headings, bold, lists, checklists, links). The value is HTML; the server cleans it before
// saving, so this editor is a convenience and never the safeguard. RichTextView shows saved HTML read-only.
// This file is copied between orm-whatsapp and executive-webapp.

function extensions(placeholder?: string) {
  return [
    StarterKit.configure({ heading: { levels: [2, 3] } }),
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ]
}

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
}

export function RichTextEditor({ value, onChange, placeholder, disabled }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: extensions(placeholder),
    content: value,
    editable: !disabled,
    // An empty editor is "<p></p>"; report that as an empty string.
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
    editorProps: { attributes: { class: 'rich-text min-h-[120px] px-3 py-2 outline-none' } },
  })

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  if (!editor) return null

  function setLink() {
    if (!editor) return
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link address (leave empty to remove)', previous ?? 'https://')
    if (url === null) return
    if (url.trim() === '') editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  const tools = [
    { label: 'Heading', icon: Heading2, active: editor.isActive('heading', { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Bold', icon: Bold, active: editor.isActive('bold'), run: () => editor.chain().focus().toggleBold().run() },
    { label: 'Italic', icon: Italic, active: editor.isActive('italic'), run: () => editor.chain().focus().toggleItalic().run() },
    { label: 'Bullet list', icon: List, active: editor.isActive('bulletList'), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: 'Numbered list', icon: ListOrdered, active: editor.isActive('orderedList'), run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: 'Checklist', icon: ListChecks, active: editor.isActive('taskList'), run: () => editor.chain().focus().toggleTaskList().run() },
    { label: 'Link', icon: Link2, active: editor.isActive('link'), run: setLink },
    { label: 'Undo', icon: Undo2, active: false, run: () => editor.chain().focus().undo().run() },
    { label: 'Redo', icon: Redo2, active: false, run: () => editor.chain().focus().redo().run() },
  ]

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] focus-within:border-[var(--accent)]">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--border)] px-1.5 py-1">
        {tools.map(({ label, icon: Icon, active, run }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={run}
            className={[
              'flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-hover)] disabled:opacity-40',
              active ? 'bg-[var(--accent-bg)] text-[var(--accent)]' : '',
            ].join(' ')}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

/** Saved rich text, read-only (checklist boxes included). */
export function RichTextView({ html }: { html: string }) {
  const editor = useEditor({
    extensions: extensions(),
    content: html,
    editable: false,
    editorProps: { attributes: { class: 'rich-text' } },
  })

  useEffect(() => {
    if (editor && editor.getHTML() !== html) editor.commands.setContent(html, false)
  }, [editor, html])

  if (!editor) return null
  return <EditorContent editor={editor} />
}
