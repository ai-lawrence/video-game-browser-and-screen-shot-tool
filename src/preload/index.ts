import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  updateHotkeys: () => ipcRenderer.send('update-hotkeys'),
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) =>
    ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  onTriggerScreenshot: (callback: (imageData: string) => void) =>
    ipcRenderer.on('trigger-screenshot', (_, data) => callback(data)),
  onTriggerSnip: (callback: (imageData: string) => void) =>
    ipcRenderer.on('trigger-snip', (_, data) => callback(data)),
  onTriggerToggleVisibility: (callback: () => void) =>
    ipcRenderer.on('trigger-toggle-visibility', () => callback()),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.send('save-settings', settings),
  writeToClipboard: (dataUrl: string) => ipcRenderer.invoke('write-to-clipboard', dataUrl),
  openScreenshotFolder: () => ipcRenderer.send('open-screenshot-folder'),
  clearScreenshots: () => ipcRenderer.send('clear-screenshots'),
  clearSnips: () => ipcRenderer.send('clear-snips'),
  saveSnip: (dataUrl: string) => ipcRenderer.send('save-snip', dataUrl),
  quitApp: () => ipcRenderer.send('quit-app')
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
