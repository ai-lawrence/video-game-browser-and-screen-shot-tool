import React, { useState, useEffect } from 'react'
import HotkeyRecorder from './HotkeyRecorder'
import { X } from 'lucide-react'

interface SettingsProps {
  onClose: () => void
}

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  // Local state for settings, initialized with defaults
  const [settings, setSettings] = useState<{
    screenshotHotkey: string
    snipHotkey: string
    toggleHotkey: string
  }>({
    screenshotHotkey: 'Alt+S',
    snipHotkey: 'Alt+Shift+S',
    toggleHotkey: 'Alt+V'
  })
  const [error, setError] = useState<string | null>(null)

  // Load saved settings from Electron store on mount
  useEffect(() => {
    window.api.getSettings().then(setSettings)
  }, [])

  // Updates a specific hotkey setting while checking for duplicates
  const handleHotkeyChange = (
    key: 'screenshotHotkey' | 'snipHotkey' | 'toggleHotkey',
    value: string
  ) => {
    // Conflict check: Ensure the new hotkey isn't already used by another action
    const otherKeys = (['screenshotHotkey', 'snipHotkey', 'toggleHotkey'] as const).filter(
      (k) => k !== key
    )
    const conflict = otherKeys.find((k) => settings[k] === value)

    if (conflict) {
      setError(`Cannot use the same hotkey for multiple actions! (${value})`)
      return
    }

    setError(null)
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    // Persist to disk via Main process
    window.api.saveSettings(newSettings)
  }

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        <div className="settings-content">
          <section>
            <h3>Shortcuts</h3>
            {error && <div className="error-message">{error}</div>}
            <HotkeyRecorder
              label="Screenshot Hotkey"
              value={settings.screenshotHotkey}
              onChange={(val) => handleHotkeyChange('screenshotHotkey', val)}
            />
            <HotkeyRecorder
              label="Snip Hotkey"
              value={settings.snipHotkey}
              onChange={(val) => handleHotkeyChange('snipHotkey', val)}
            />
            <HotkeyRecorder
              label="Toggle Browser Hotkey"
              value={settings.toggleHotkey}
              onChange={(val) => handleHotkeyChange('toggleHotkey', val)}
            />
          </section>
        </div>
      </div>
    </div>
  )
}

export default Settings
