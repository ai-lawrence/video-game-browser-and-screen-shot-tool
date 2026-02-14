import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
// Custom APIs for renderer
// These functions act as a bridge between the renderer (React) and the main process (Electron)
const api = {
  // Notify main process to re-read hotkey settings
  updateHotkeys: () => ipcRenderer.send('update-hotkeys'),

  // Tell main process to ignore mouse events (allow click-through)
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) =>
    ipcRenderer.send('set-ignore-mouse-events', ignore, options),

  // Listen for the "take screenshot" command from the main process
  onTriggerScreenshot: (callback: (imageData: string) => void) =>
    ipcRenderer.on('trigger-screenshot', (_, data) => callback(data)),

  // Listen for "take snip" command (rectangular selection)
  onTriggerSnip: (callback: (imageData: string) => void) =>
    ipcRenderer.on('trigger-snip', (_, data) => callback(data)),

  // Listen for "toggle visibility" command
  onTriggerToggleVisibility: (callback: () => void) =>
    ipcRenderer.on('trigger-toggle-visibility', () => callback()),

  // Settings management
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: {
    screenshotHotkey?: string
    snipHotkey?: string
    toggleHotkey?: string
    clipHotkey?: string
    bufferingEnabled?: boolean
    bufferLength?: number
    systemAudioEnabled?: boolean
    micEnabled?: boolean
    selectedMicDeviceId?: string
    recordingResolution?: string
    customAspectRatio?: boolean
    aspectRatioPreset?: string
    regionBoxEnabled?: boolean
    regionBounds?: { x: number; y: number; w: number; h: number } | null
  }) => ipcRenderer.send('save-settings', settings),

  // Utility
  writeToClipboard: (dataUrl: string) => ipcRenderer.invoke('write-to-clipboard', dataUrl),
  openScreenshotFolder: () => ipcRenderer.send('open-screenshot-folder'),
  clearScreenshots: () => ipcRenderer.send('clear-screenshots'),
  clearSnips: () => ipcRenderer.send('clear-snips'),
  saveSnip: (dataUrl: string) => ipcRenderer.send('save-snip', dataUrl),
  quitApp: () => ipcRenderer.send('quit-app'),

  // Saved Prompts API
  getSavedPrompts: () => ipcRenderer.invoke('get-saved-prompts'),
  saveSavedPrompt: (prompt: unknown) => ipcRenderer.invoke('save-saved-prompt', prompt),
  deleteSavedPrompt: (id: string) => ipcRenderer.invoke('delete-saved-prompt', id),
  getAutoSendSettings: () => ipcRenderer.invoke('get-autosend-settings'),
  setAutoSendSettings: (autoSend: boolean) => ipcRenderer.invoke('set-autosend-settings', autoSend),

  // Screen Recorder API
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  saveRecording: (buffer: Uint8Array, filename: string) =>
    ipcRenderer.invoke('save-recording', buffer, filename),
  openRecordingsFolder: () => ipcRenderer.send('open-recordings-folder'),
  onTriggerSaveClip: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('trigger-save-clip', handler)
    return () => ipcRenderer.removeListener('trigger-save-clip', handler)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
