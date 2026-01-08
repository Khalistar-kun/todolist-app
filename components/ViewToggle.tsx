"use client"
type Props = { mode: 'list'|'kanban'; onChange: (m: 'list'|'kanban')=>void }
export default function ViewToggle({ mode, onChange }: Props){
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1">
      <button
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
          mode==='list'
            ? 'bg-white text-gray-900 shadow-soft'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        onClick={()=>onChange('list')}
      >
        List
      </button>
      <button
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
          mode==='kanban'
            ? 'bg-white text-gray-900 shadow-soft'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        onClick={()=>onChange('kanban')}
      >
        Kanban
      </button>
    </div>
  )
}

