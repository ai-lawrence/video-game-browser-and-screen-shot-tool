import React from 'react'
import { SavedPrompt } from '../../providers/types'
import { X, Play } from 'lucide-react'

interface PromptChipProps {
  prompt: SavedPrompt
  onClick: (prompt: SavedPrompt) => void
  onDelete: (id: string) => void
  autoSend: boolean
}

const PromptChip: React.FC<PromptChipProps> = ({ prompt, onClick, onDelete, autoSend }) => {
  return (
    <div className="prompt-chip" title={prompt.text}>
      <button className="chip-main" onClick={() => onClick(prompt)}>
        <span className="chip-icon">{prompt.icon || '💬'}</span>
        <span className="chip-label">{prompt.title}</span>
        {autoSend && <Play size={10} className="autosend-indicator" />}
      </button>
      <button
        className="chip-delete"
        onClick={(e) => {
          e.stopPropagation()
          if (confirm('Delete this prompt?')) {
            onDelete(prompt.id)
          }
        }}
      >
        <X size={12} />
      </button>
    </div>
  )
}

export default PromptChip
