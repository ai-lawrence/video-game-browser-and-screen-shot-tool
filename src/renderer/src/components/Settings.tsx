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
    clipHotkey: string
    bufferingEnabled: boolean
    bufferLength: number
    systemAudioEnabled: boolean
    micEnabled: boolean
    selectedMicDeviceId: string
    recordingResolution: string
    customAspectRatio: boolean
    aspectRatioPreset: string
    audioRecordingMode: string
  }>({
    screenshotHotkey: 'Alt+S',
    snipHotkey: 'Alt+Shift+S',
    toggleHotkey: 'Alt+V',
    clipHotkey: 'Alt+C',
    bufferingEnabled: false,
    bufferLength: 30,
    systemAudioEnabled: false,
    micEnabled: false,
    selectedMicDeviceId: '',
    recordingResolution: '1080p',
    customAspectRatio: false,
    aspectRatioPreset: '16:9',
    audioRecordingMode: 'system'
  })
  const [error, setError] = useState<string | null>(null)
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([])

  /** Enumerate available audio input (microphone) devices */
  const enumerateMicDevices = async (): Promise<void> => {
    try {
      // Request temporary mic access to get device labels (browsers hide labels without permission)
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      tempStream.getTracks().forEach((t) => t.stop())

      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter((d) => d.kind === 'audioinput')
      setMicDevices(audioInputs)
    } catch {
      // If permission denied, still try to list devices (labels may be empty)
      const devices = await navigator.mediaDevices.enumerateDevices()
      setMicDevices(devices.filter((d) => d.kind === 'audioinput'))
    }
  }

  // Load saved settings from Electron store on mount
  useEffect(() => {
    window.api.getSettings().then(setSettings)
  }, [])

  // Enumerate microphone devices on mount
  useEffect(() => {
    enumerateMicDevices()
  }, [])

  // All hotkey keys for comprehensive conflict detection
  const hotkeyKeys = ['screenshotHotkey', 'snipHotkey', 'toggleHotkey', 'clipHotkey'] as const

  // Updates a specific hotkey setting while checking for duplicates
  const handleHotkeyChange = (key: (typeof hotkeyKeys)[number], value: string): void => {
    // Conflict check: Ensure the new hotkey isn't already used by another action
    const otherKeys = hotkeyKeys.filter((k) => k !== key)
    const conflict = otherKeys.find((k) => settings[k] === value)

    if (conflict) {
      setError(`Cannot use the same hotkey for multiple actions! (${value})`)
      return
    }

    setError(null)
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    window.api.saveSettings(newSettings)
  }

  /** Update a non-hotkey setting (recording, audio, or video) */
  const handleSettingChange = (
    key:
      | 'bufferingEnabled'
      | 'bufferLength'
      | 'systemAudioEnabled'
      | 'micEnabled'
      | 'selectedMicDeviceId'
      | 'recordingResolution'
      | 'customAspectRatio'
      | 'aspectRatioPreset'
      | 'audioRecordingMode',
    value: boolean | number | string
  ): void => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
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

          <div className="settings-divider" />

          <section>
            <h3>Audio</h3>

            <div className="settings-row">
              <label>System Audio</label>
              <button
                className={`settings-toggle ${settings.systemAudioEnabled ? 'active' : ''}`}
                onClick={() =>
                  handleSettingChange('systemAudioEnabled', !settings.systemAudioEnabled)
                }
                title={
                  settings.systemAudioEnabled
                    ? 'Disable desktop audio capture'
                    : 'Enable desktop audio capture'
                }
              >
                <div className="toggle-knob" />
              </button>
            </div>

            <div className="settings-row">
              <label>Microphone</label>
              <button
                className={`settings-toggle ${settings.micEnabled ? 'active' : ''}`}
                onClick={() => handleSettingChange('micEnabled', !settings.micEnabled)}
                title={settings.micEnabled ? 'Disable microphone' : 'Enable microphone'}
              >
                <div className="toggle-knob" />
              </button>
            </div>

            <div className="settings-row">
              <label>Mic Device</label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <select
                  className="settings-select"
                  value={settings.selectedMicDeviceId}
                  onChange={(e) => handleSettingChange('selectedMicDeviceId', e.target.value)}
                  disabled={!settings.micEnabled}
                >
                  <option value="">Default</option>
                  {micDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone ${d.deviceId.slice(0, 8)}...`}
                    </option>
                  ))}
                </select>
                <button
                  className="buffer-option"
                  onClick={enumerateMicDevices}
                  title="Refresh device list"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                >
                  ↻
                </button>
              </div>
            </div>

            <div className="settings-row">
              <label>Audio Recording Mode</label>
              <select
                className="settings-select"
                value={settings.audioRecordingMode}
                onChange={(e) => handleSettingChange('audioRecordingMode', e.target.value)}
              >
                <option value="system">System Audio</option>
                <option value="system+mic">System + Mic</option>
                <option value="mic">Mic Only</option>
              </select>
            </div>
          </section>

          <div className="settings-divider" />

          <section>
            <h3>Recording</h3>

            <div className="settings-row">
              <label>Resolution</label>
              <select
                className="settings-select"
                value={settings.recordingResolution}
                onChange={(e) => handleSettingChange('recordingResolution', e.target.value)}
              >
                <option value="720p">720p (HD)</option>
                <option value="1080p">1080p (Full HD)</option>
                <option value="1440p">1440p (2K)</option>
              </select>
            </div>

            <div className="settings-row">
              <label>Lock Aspect Ratio</label>
              <button
                className={`settings-toggle ${settings.customAspectRatio ? 'active' : ''}`}
                onClick={() =>
                  handleSettingChange('customAspectRatio', !settings.customAspectRatio)
                }
                title={
                  settings.customAspectRatio
                    ? 'Switch to free-form region resizing'
                    : 'Lock capture region to a preset aspect ratio'
                }
              >
                <div className="toggle-knob" />
              </button>
            </div>

            {settings.customAspectRatio && (
              <div className="settings-row">
                <label>Aspect Ratio</label>
                <select
                  className="settings-select"
                  value={settings.aspectRatioPreset}
                  onChange={(e) => handleSettingChange('aspectRatioPreset', e.target.value)}
                >
                  <option value="16:9">16:9 — YouTube</option>
                  <option value="9:16">9:16 — TikTok / Reels</option>
                  <option value="1:1">1:1 — Instagram</option>
                  <option value="4:5">4:5 — Instagram Portrait</option>
                  <option value="4:3">4:3 — Classic</option>
                </select>
              </div>
            )}

            <div className="settings-row">
              <label>Background Buffering</label>
              <button
                className={`settings-toggle ${settings.bufferingEnabled ? 'active' : ''}`}
                onClick={() =>
                  handleSettingChange('bufferingEnabled', !settings.bufferingEnabled)
                }
                title={settings.bufferingEnabled ? 'Disable buffer' : 'Enable buffer'}
              >
                <div className="toggle-knob" />
              </button>
            </div>

            <div className="settings-row">
              <label>Buffer Length</label>
              <div className="buffer-options">
                {[
                  { value: 30, label: '30s' },
                  { value: 60, label: '1 min' },
                  { value: 120, label: '2 min' }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    className={`buffer-option ${settings.bufferLength === opt.value ? 'active' : ''}`}
                    onClick={() => handleSettingChange('bufferLength', opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <HotkeyRecorder
              label="Save Clip Hotkey"
              value={settings.clipHotkey}
              onChange={(val) => handleHotkeyChange('clipHotkey', val)}
            />
          </section>
        </div>
      </div>
    </div>
  )
}

export default Settings
