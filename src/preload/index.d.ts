import { ElectronAPI } from '@electron-toolkit/preload'

interface CustomAPI {
  updateHotkeys: () => void
  /** Controls if the window ignores mouse events (click-through) */
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void
  onTriggerScreenshot: (callback: (imageData: string) => void) => void
  onTriggerSnip: (callback: (imageData: string) => void) => void
  onTriggerToggleVisibility: (callback: () => void) => void
  getSettings: () => Promise<{ screenshotHotkey: string; snipHotkey: string; toggleHotkey: string }>
  saveSettings: (settings: {
    screenshotHotkey?: string
    snipHotkey?: string
    toggleHotkey?: string
  }) => void
  writeToClipboard: (dataUrl: string) => Promise<void>
  openScreenshotFolder: () => void
  clearScreenshots: () => void
  clearSnips: () => void
  saveSnip: (dataUrl: string) => void
  saveSnip: (dataUrl: string) => void
  quitApp: () => void

  // Saved Prompts API
  getSavedPrompts: () => Promise<SavedPrompt[]>
  saveSavedPrompt: (prompt: SavedPrompt) => Promise<boolean>
  deleteSavedPrompt: (id: string) => Promise<boolean>
  getAutoSendSettings: () => Promise<boolean>
  setAutoSendSettings: (autoSend: boolean) => Promise<boolean>
}

export interface SavedPrompt {
  id: string
  title: string
  icon?: string
  text: string
  createdAt: number
  updatedAt: number
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
