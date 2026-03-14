import React, { useState, useRef, useEffect } from 'react'
import { ChevronUp, Zap } from 'lucide-react'
import { usePlugin } from '../../contexts/PluginContext'
import './pluginPromptSelector.css'

interface PluginPromptSelectorProps {
  onSelect: (text: string) => void
  disabled?: boolean
}

const PluginPromptSelector: React.FC<PluginPromptSelectorProps> = ({ onSelect, disabled }) => {
  const { activePrompts, activePlugin } = usePlugin()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!activePrompts.length) return null

  return (
    <div className="plugin-prompt-selector" ref={containerRef}>
      <button
        className={`pps-trigger ${open ? 'open' : ''}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        title={`${activePlugin?.name ?? 'Plugin'} prompts`}
      >
        <Zap size={13} />
        <span className="pps-trigger-label">
          {activePlugin?.icon ?? '🔌'} Prompts
        </span>
        <ChevronUp size={12} className={`pps-chevron ${open ? 'flipped' : ''}`} />
      </button>

      {open && (
        <div className="pps-dropdown">
          <div className="pps-dropdown-title">
            {activePlugin?.name ?? 'Plugin'} Prompts
          </div>
          {activePrompts.map((p) => (
            <button
              key={p.id}
              className="pps-item"
              onClick={() => {
                onSelect(p.text)
                setOpen(false)
              }}
            >
              <span className="pps-item-icon">{p.icon ?? '💬'}</span>
              <span className="pps-item-title">{p.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default PluginPromptSelector
