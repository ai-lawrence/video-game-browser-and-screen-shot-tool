import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  screen,
  desktopCapturer,
  nativeImage,
  clipboard
} from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync, lstatSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Set up portable data directory
const setupPortablePaths = (): void => {
  let baseDir: string
  if (is.dev) {
    baseDir = app.getAppPath()
  } else if (process.env.PORTABLE_EXECUTABLE_DIR) {
    // This is set by electron-builder's portable launcher on Windows
    baseDir = process.env.PORTABLE_EXECUTABLE_DIR
  } else {
    // Fallback for unpacked builds (win-unpacked folder)
    baseDir = dirname(app.getPath('exe'))
  }

  const dataPath = join(baseDir, 'data')
  const screenshotsPath = join(dataPath, 'screenshots')
  const snipsPath = join(screenshotsPath, 'snips')

  if (!existsSync(dataPath)) mkdirSync(dataPath, { recursive: true })
  if (!existsSync(screenshotsPath)) mkdirSync(screenshotsPath, { recursive: true })
  if (!existsSync(snipsPath)) mkdirSync(snipsPath, { recursive: true })

  app.setPath('userData', dataPath)
  console.log(`Portable mode: Data redirected to ${dataPath}`)
}

setupPortablePaths()

let store: any
const initStore = async (): Promise<void> => {
  const { default: Store } = await import('electron-store')
  store = new Store()
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true
    }
  })

  // Set initial ignore mouse events to allow passthrough by default
  // while still forwarding events to the renderer for hover detection
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // Make it full screen for overlay if needed, or just specific size
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize
    mainWindow.setBounds({ x: 0, y: 0, width, height })
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Hotkey registration logic
  const registerShortcuts = (): void => {
    const screenshotHotkey = store.get('screenshotHotkey', 'Alt+S') as string
    const snipHotkey = store.get('snipHotkey', 'Alt+Shift+S') as string
    const toggleHotkey = store.get('toggleHotkey', 'Alt+V') as string

    globalShortcut.unregisterAll()

    const captureScreen = async (type: 'screenshot' | 'snip'): Promise<void> => {
      // Hide window for clean capture
      const wasVisible = mainWindow.isVisible()
      if (wasVisible) {
        mainWindow.hide()
        // Wait for OS to redraw
        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: screen.getPrimaryDisplay().workAreaSize
      })
      const primarySource = sources[0] // Assuming primary screen for now

      if (primarySource) {
        const dataUrl = primarySource.thumbnail.toDataURL()

        // Auto-save to gallery (Screenshots ONLY)
        if (type === 'screenshot') {
          const screenshotsPath = join(app.getPath('userData'), 'screenshots')
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const filePath = join(screenshotsPath, `screenshot-${timestamp}.png`)
          const imageBuffer = primarySource.thumbnail.toPNG()
          writeFileSync(filePath, imageBuffer)
        }

        // Restore window before sending event
        if (wasVisible) {
          mainWindow.showInactive()
          mainWindow.setAlwaysOnTop(true, 'screen-saver')
        }

        mainWindow.webContents.send(`trigger-${type}`, dataUrl)
      } else if (wasVisible) {
        // Restore if failed
        mainWindow.showInactive()
        mainWindow.setAlwaysOnTop(true, 'screen-saver')
      }
    }

    try {
      if (screenshotHotkey) {
        globalShortcut.register(screenshotHotkey, () => captureScreen('screenshot'))
      }
      if (snipHotkey) {
        globalShortcut.register(snipHotkey, () => captureScreen('snip'))
      }
      if (toggleHotkey) {
        globalShortcut.register(toggleHotkey, () => {
          if (mainWindow.isVisible()) {
            mainWindow.hide()
          } else {
            mainWindow.show()
            mainWindow.setAlwaysOnTop(true, 'screen-saver')
          }
        })
      }
    } catch (error) {
      console.error('Failed to register shortcuts:', error)
    }
  }

  registerShortcuts()

  ipcMain.on('update-hotkeys', () => {
    registerShortcuts()
  })

  ipcMain.handle('get-settings', () => {
    return {
      screenshotHotkey: store.get('screenshotHotkey', 'Alt+S'),
      snipHotkey: store.get('snipHotkey', 'Alt+Shift+S'),
      toggleHotkey: store.get('toggleHotkey', 'Alt+V')
    }
  })

  ipcMain.on('save-settings', (_, settings) => {
    store.set(settings)
    registerShortcuts()
  })

  ipcMain.on('set-ignore-mouse-events', (_, ignore, options) => {
    mainWindow.setIgnoreMouseEvents(ignore, options)
  })

  ipcMain.handle('write-to-clipboard', (_, dataUrl) => {
    const img = nativeImage.createFromDataURL(dataUrl)
    clipboard.writeImage(img)
    return true
  })

  ipcMain.on('quit-app', () => {
    app.quit()
  })

  ipcMain.on('open-screenshot-folder', () => {
    const screenshotsPath = join(app.getPath('userData'), 'screenshots')
    shell.openPath(screenshotsPath)
  })

  ipcMain.on('clear-screenshots', () => {
    const screenshotsPath = join(app.getPath('userData'), 'screenshots')
    if (existsSync(screenshotsPath)) {
      const files = readdirSync(screenshotsPath)
      for (const file of files) {
        const fullPath = join(screenshotsPath, file)
        // Don't delete the snips directory itself, only files in root
        if (!lstatSync(fullPath).isDirectory()) {
          unlinkSync(fullPath)
        }
      }
    }
  })

  ipcMain.on('clear-snips', () => {
    const snipsPath = join(app.getPath('userData'), 'screenshots', 'snips')
    if (existsSync(snipsPath)) {
      const files = readdirSync(snipsPath)
      for (const file of files) {
        unlinkSync(join(snipsPath, file))
      }
    }
  })

  ipcMain.on('save-snip', (_event, dataUrl: string) => {
    const snipsPath = join(app.getPath('userData'), 'screenshots', 'snips')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filePath = join(snipsPath, `snip-${timestamp}.png`)

    // Convert data URL to buffer
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    writeFileSync(filePath, imageBuffer)
  })
}

app.whenReady().then(async () => {
  await initStore()
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
