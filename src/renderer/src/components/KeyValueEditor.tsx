import { v4 as uuidv4 } from 'uuid'
import type { KeyValuePair } from '@shared/ipc'

interface Props {
  pairs: KeyValuePair[]
  onChange: (pairs: KeyValuePair[]) => void
  showEnabled?: boolean
}

export default function KeyValueEditor({ pairs, onChange, showEnabled = true }: Props) {
  const updatePair = (index: number, field: keyof KeyValuePair, value: string | boolean) => {
    const updated = pairs.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    onChange(updated)
  }

  const removePair = (index: number) => {
    const updated = pairs.filter((_, i) => i !== index)
    if (updated.length === 0) {
      updated.push({ id: uuidv4(), key: '', value: '', enabled: true })
    }
    onChange(updated)
  }

  const addPair = () => {
    onChange([...pairs, { id: uuidv4(), key: '', value: '', enabled: true }])
  }

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Tab' && !e.shiftKey && index === pairs.length - 1) {
      const last = pairs[pairs.length - 1]
      if (last.key || last.value) {
        e.preventDefault()
        addPair()
      }
    }
  }

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 text-xs text-gray-500 font-medium uppercase tracking-wider">
        {showEnabled && <div className="w-6" />}
        <div className="flex-1">Key</div>
        <div className="flex-1">Value</div>
        <div className="w-7" />
      </div>

      {pairs.map((pair, index) => (
        <div key={pair.id} className="flex items-center gap-2 group">
          {showEnabled && (
            <input
              type="checkbox"
              checked={pair.enabled}
              onChange={(e) => updatePair(index, 'enabled', e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
            />
          )}
          <input
            type="text"
            placeholder="Key"
            value={pair.key}
            onChange={(e) => updatePair(index, 'key', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Value"
            value={pair.value}
            onChange={(e) => updatePair(index, 'value', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={() => removePair(index)}
            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove"
          >
            &times;
          </button>
        </div>
      ))}

      <button
        onClick={addPair}
        className="text-xs text-gray-500 hover:text-indigo-400 px-1 py-1 transition-colors"
      >
        + Add row
      </button>
    </div>
  )
}
