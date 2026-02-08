import React, { useState, useEffect } from 'react'
import { Plus, Settings2 } from 'lucide-react'
import { SavedPrompt } from '../../providers/types'
import PromptChip from './PromptChip'
import AddPromptModal from './AddPromptModal'
import './savedPrompts.css'

interface SavedPromptsPanelProps {
  onInject: (prompt: SavedPrompt, autoSend: boolean) => void
  disabled?: boolean
}

const SavedPromptsPanel: React.FC<SavedPromptsPanelProps> = ({ onInject, disabled }) => {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([])
  const [autoSend, setAutoSend] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Load initial data
  useEffect(() => {
    loadPrompts()
    loadSettings()
  }, [])

  const loadPrompts = async () => {
    try {
      const data = await window.api.getSavedPrompts()
      setPrompts(data)
    } catch (err) {
      console.error('Failed to load prompts:', err)
    }
  }

  const loadSettings = async () => {
    try {
      const setting = await window.api.getAutoSendSettings()
      setAutoSend(setting)
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  }

  const handleSavePrompt = async (title: string, text: string, icon: string) => {
    const newPrompt: SavedPrompt = {
      id: crypto.randomUUID(),
      title,
      text,
      icon: icon || '💬',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    await window.api.saveSavedPrompt(newPrompt)
    loadPrompts()
  }

  const handleDeletePrompt = async (id: string) => {
    await window.api.deleteSavedPrompt(id)
    loadPrompts()
  }

  const toggleAutoSend = async () => {
    const newVal = !autoSend
    setAutoSend(newVal)
    await window.api.setAutoSendSettings(newVal)
  }

  return (
    <div className={`saved-prompts-panel ${disabled ? 'disabled' : ''}`}>
      <div className="panel-header">
        <span className="panel-title">Saved Prompts</span>
        <div className="panel-controls">
          <button
            className={`icon-btn toggle-autosend ${autoSend ? 'active' : ''}`}
            onClick={toggleAutoSend}
            title={`Auto-send: ${autoSend ? 'ON' : 'OFF'}`}
          >
            <Settings2 size={16} />
          </button>
          <button
            className="icon-btn add-btn"
            onClick={() => setIsModalOpen(true)}
            title="Add Prompt"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="prompts-list">
        {prompts.length === 0 ? (
          <div className="empty-state">No saved prompts</div>
        ) : (
          prompts.map((p) => (
            <PromptChip
              key={p.id}
              prompt={p}
              onClick={(prompt) => !disabled && onInject(prompt, autoSend)}
              onDelete={handleDeletePrompt}
              autoSend={autoSend}
            />
          ))
        )}
      </div>

      <AddPromptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePrompt}
      />
    </div>
  )
}

export default SavedPromptsPanel
