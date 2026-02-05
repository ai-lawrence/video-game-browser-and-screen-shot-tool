import React, { useState, useEffect, useCallback } from 'react'

interface HotkeyRecorderProps {
  label: string
  value: string
  onChange: (newValue: string) => void
}

const HotkeyRecorder: React.FC<HotkeyRecorderProps> = ({ label, value, onChange }) => {
  const [isRecording, setIsRecording] = useState(false)
  const [currentValue, setCurrentValue] = useState(value)

  useEffect(() => {
    setCurrentValue(value)
  }, [value])

  // Capture keystrokes and format them as an Electron Accelerator string
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isRecording) return
      e.preventDefault()
      e.stopPropagation()

      const modifiers: string[] = []
      if (e.ctrlKey) modifiers.push('CommandOrControl') // Support generic Ctrl/Cmd
      if (e.altKey) modifiers.push('Alt')
      if (e.shiftKey) modifiers.push('Shift')
      // Handle Meta key (Windows/Command) unless handled by Ctrl logic above
      if (e.metaKey && !modifiers.includes('CommandOrControl')) modifiers.push('CommandOrControl')

      const key = e.key.toUpperCase()

      // Filter out modifier keys if they are the only keys pressed
      if (['CONTROL', 'ALT', 'SHIFT', 'META'].includes(key)) return

      // Construct the final string, e.g., "Alt+Shift+S"
      const accelerator = [...modifiers, key].join('+')
      setCurrentValue(accelerator)
      onChange(accelerator)
      setIsRecording(false)
    },
    [isRecording, onChange]
  )

  return (
    <div className="hotkey-recorder">
      <label>{label}</label>
      <div
        className={`hotkey-input ${isRecording ? 'recording' : ''}`}
        onClick={() => setIsRecording(true)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {isRecording ? 'Press keys...' : currentValue || 'None'}
      </div>
      {isRecording && (
        <button
          className="cancel-btn"
          onClick={(e) => {
            e.stopPropagation()
            setIsRecording(false)
          }}
        >
          Cancel
        </button>
      )}
    </div>
  )
}

export default HotkeyRecorder
