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

// Set up portable data directory to ensure data is saved locally alongside the executable
// This is critical for the "portable" aspect of the application.
const setupPortablePaths = (): void => {
  let baseDir: string
  // If running in development mode, use the app's root path
  if (is.dev) {
    baseDir = app.getAppPath()
  } else if (process.env.PORTABLE_EXECUTABLE_DIR) {
    // This environment variable is set by electron-builder's portable launcher on Windows
    // It points to the directory where the portable .exe is located
    baseDir = process.env.PORTABLE_EXECUTABLE_DIR
  } else {
    // Fallback for unpacked builds (win-unpacked folder), use the executable's directory
    baseDir = dirname(app.getPath('exe'))
  }

  // dataPath is where all user data (screenshots, settings, cache) will be stored
  const dataPath = join(baseDir, 'data')
  const screenshotsPath = join(dataPath, 'screenshots')
  const snipsPath = join(screenshotsPath, 'snips')

  // Create directories if they don't exist
  if (!existsSync(dataPath)) mkdirSync(dataPath, { recursive: true })
  if (!existsSync(screenshotsPath)) mkdirSync(screenshotsPath, { recursive: true })
  if (!existsSync(snipsPath)) mkdirSync(snipsPath, { recursive: true })

  // Redirect Electron's default 'userData' path to our portable 'data' folder
  app.setPath('userData', dataPath)
  console.log(`Portable mode: Data redirected to ${dataPath}`)
}

setupPortablePaths()

let store: any
// Initialize electron-store simply to manage user preferences (hotkeys)
const initStore = async (): Promise<void> => {
  const { default: Store } = await import('electron-store')
  store = new Store()
}

/**
 * Creates the main application window.
 * This window is configured to be:
 * - Transparent & Frameless: To serve as an overlay.
 * - Always On Top: To stay above full-screen games.
 * - Click-through (initially): Via setIgnoreMouseEvents.
 */
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
    skipTaskbar: true, // Don't show in taskbar to be less intrusive
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true // Required for embedding external AI sites (ChatGPT, etc.)
    }
  })

  // Set initial ignore mouse events to allow passthrough by default
  // 'forward: true' ensures the renderer still receives mouseover events to trigger interactivity
  mainWindow.setAlwaysOnTop(true, 'screen-saver') // High priority always-on-top
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // Set window bounds to match the primary display's work area for full coverage if needed
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize
    mainWindow.setBounds({ x: 0, y: 0, width, height })
  })

  // Handle new window creation request from webviews (e.g., clicking links in chat)
  // We deny the new window and instead open the URL in the system's default browser
  mainWindow.webContents.setWindowOpenHandler((details): { action: 'deny' } => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Logic to register global shortcuts based on user settings
  const registerShortcuts = (): void => {
    // Retrieve hotkeys from store or use defaults
    const screenshotHotkey = store.get('screenshotHotkey', 'Alt+S') as string
    const snipHotkey = store.get('snipHotkey', 'Alt+Shift+S') as string
    const toggleHotkey = store.get('toggleHotkey', 'Alt+V') as string

    // Unregister existing shortcuts to avoid conflicts/duplicates
    globalShortcut.unregisterAll()

    // Helper function to handle screen capture logic
    const captureScreen = async (type: 'screenshot' | 'snip'): Promise<void> => {
      // 1. Hide the overlay window to ensure a "clean" capture of the underlying game/screen
      const wasVisible = mainWindow.isVisible()
      if (wasVisible) {
        mainWindow.hide()
        // Wait briefly for the OS to repaint the screen without the overlay
        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      // 2. Capture the screen content using desktopCapturer
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: screen.getPrimaryDisplay().workAreaSize
      })
      const primarySource = sources[0] // Assuming primary display

      if (primarySource) {
        const dataUrl = primarySource.thumbnail.toDataURL()

        // 3a. For full Screenshots: Auto-save immediately to the gallery
        if (type === 'screenshot') {
          const screenshotsPath = join(app.getPath('userData'), 'screenshots')
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const filePath = join(screenshotsPath, `screenshot-${timestamp}.png`)
          const imageBuffer = primarySource.thumbnail.toPNG()
          writeFileSync(filePath, imageBuffer)
        }

        // 4. Restore the overlay visibility
        if (wasVisible) {
          mainWindow.showInactive() // Show without stealing focus
          mainWindow.setAlwaysOnTop(true, 'screen-saver')
        }

        // 5. Send the image data to the renderer to be displayed/processed (e.g. sent to AI)
        mainWindow.webContents.send(`trigger-${type}`, dataUrl)
      } else if (wasVisible) {
        // Validation/Error fallback: restore window if capture failed
        mainWindow.showInactive()
        mainWindow.setAlwaysOnTop(true, 'screen-saver')
      }
    }

    try {
      // Register the actual hotkeys using the electron globalShortcut API
      if (screenshotHotkey) {
        globalShortcut.register(screenshotHotkey, (): void => {
          captureScreen('screenshot')
        })
      }
      if (snipHotkey) {
        globalShortcut.register(snipHotkey, (): void => {
          captureScreen('snip')
        })
      }
      if (toggleHotkey) {
        globalShortcut.register(toggleHotkey, (): void => {
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

  /* IPC HANDLERS used by the Renderer process */

  // Re-register hotkeys when settings change in the React app
  ipcMain.on('update-hotkeys', (): void => {
    registerShortcuts()
  })

  // Get current settings (hotkeys) from store
  ipcMain.handle('get-settings', () => {
    return {
      screenshotHotkey: store.get('screenshotHotkey', 'Alt+S'),
      snipHotkey: store.get('snipHotkey', 'Alt+Shift+S'),
      toggleHotkey: store.get('toggleHotkey', 'Alt+V')
    }
  })

  // Save updated settings to store
  ipcMain.on('save-settings', (_, settings): void => {
    store.set(settings)
    registerShortcuts()
  })

  // Control mouse event passthrough (called when hovering over UI vs empty space)
  ipcMain.on('set-ignore-mouse-events', (_, ignore, options): void => {
    mainWindow.setIgnoreMouseEvents(ignore, options)
  })

  // Write image data to system clipboard
  ipcMain.handle('write-to-clipboard', (_, dataUrl) => {
    const img = nativeImage.createFromDataURL(dataUrl)
    clipboard.writeImage(img)
    return true
  })

  // Quit the application
  ipcMain.on('quit-app', (): void => {
    app.quit()
  })

  // Open the screenshots folder in system file explorer
  ipcMain.on('open-screenshot-folder', (): void => {
    const screenshotsPath = join(app.getPath('userData'), 'screenshots')
    shell.openPath(screenshotsPath)
  })

  // Delete all full screenshots
  ipcMain.on('clear-screenshots', (): void => {
    const screenshotsPath = join(app.getPath('userData'), 'screenshots')
    if (existsSync(screenshotsPath)) {
      const files = readdirSync(screenshotsPath)
      for (const file of files) {
        const fullPath = join(screenshotsPath, file)
        // Don't delete the snips directory (which is a subdirectory here), only files
        if (!lstatSync(fullPath).isDirectory()) {
          unlinkSync(fullPath)
        }
      }
    }
  })

  // Delete all snips
  ipcMain.on('clear-snips', (): void => {
    const snipsPath = join(app.getPath('userData'), 'screenshots', 'snips')
    if (existsSync(snipsPath)) {
      const files = readdirSync(snipsPath)
      for (const file of files) {
        unlinkSync(join(snipsPath, file))
      }
    }
  })

  // Save a cropped snip to the snips folder
  ipcMain.on('save-snip', (_event, dataUrl: string): void => {
    const snipsPath = join(app.getPath('userData'), 'screenshots', 'snips')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filePath = join(snipsPath, `snip-${timestamp}.png`)

    // Convert data URL to buffer for file writing
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

  ipcMain.on('ping', (): void => console.log('pong'))

  createWindow()

  app.on('activate', function (): void {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', (): void => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
