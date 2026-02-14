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
import {
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
  readFileSync,
  lstatSync,
  renameSync
} from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Resolve the path to the bundled FFmpeg binary.
 * `ffmpeg-static` exports the absolute path to a platform-specific FFmpeg executable.
 * In production (asar), the binary is unpacked; we swap `.asar` for `.asar.unpacked`.
 */
let cachedFfmpegPath: string | null = null
async function getFfmpegPath(): Promise<string> {
  if (cachedFfmpegPath) return cachedFfmpegPath
  const mod = await import('ffmpeg-static')
  let ffmpegPath: string = (mod.default ?? mod) as string
  if (ffmpegPath.includes('app.asar')) {
    ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked')
  }
  cachedFfmpegPath = ffmpegPath
  return ffmpegPath
}
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
  const recordingsPath = join(dataPath, 'recordings')
  const audioRecordingsPath = join(dataPath, 'recordings', 'audio')

  // Create directories if they don't exist
  if (!existsSync(dataPath)) mkdirSync(dataPath, { recursive: true })
  if (!existsSync(screenshotsPath)) mkdirSync(screenshotsPath, { recursive: true })
  if (!existsSync(snipsPath)) mkdirSync(snipsPath, { recursive: true })
  if (!existsSync(recordingsPath)) mkdirSync(recordingsPath, { recursive: true })
  if (!existsSync(audioRecordingsPath)) mkdirSync(audioRecordingsPath, { recursive: true })

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

let trimmerWindow: BrowserWindow | null = null

/**
 * Creates the audio trimmer window.
 * A separate, non-transparent window for browsing and trimming MP3 audio files.
 */
function createTrimmerWindow(): void {
  if (trimmerWindow && !trimmerWindow.isDestroyed()) {
    trimmerWindow.focus()
    return
  }

  trimmerWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    frame: false,
    transparent: false,
    backgroundColor: '#18181b',
    autoHideMenuBar: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Load the trimmer page
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    trimmerWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/trimmer.html`)
  } else {
    trimmerWindow.loadFile(join(__dirname, '../renderer/trimmer.html'))
  }

  trimmerWindow.on('closed', () => {
    trimmerWindow = null
  })
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
    const clipHotkey = store.get('clipHotkey', 'Alt+C') as string

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
      // Register "Save Clip" hotkey — triggers instant replay clip save in renderer
      if (clipHotkey) {
        globalShortcut.register(clipHotkey, (): void => {
          mainWindow.webContents.send('trigger-save-clip')
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

  // Get current settings (hotkeys + recording) from store
  ipcMain.handle('get-settings', () => {
    return {
      screenshotHotkey: store.get('screenshotHotkey', 'Alt+S'),
      snipHotkey: store.get('snipHotkey', 'Alt+Shift+S'),
      toggleHotkey: store.get('toggleHotkey', 'Alt+V'),
      clipHotkey: store.get('clipHotkey', 'Alt+C'),
      bufferingEnabled: store.get('bufferingEnabled', false),
      bufferLength: store.get('bufferLength', 30),
      systemAudioEnabled: store.get('systemAudioEnabled', false),
      micEnabled: store.get('micEnabled', false),
      selectedMicDeviceId: store.get('selectedMicDeviceId', ''),
      recordingResolution: store.get('recordingResolution', '1080p'),
      customAspectRatio: store.get('customAspectRatio', false),
      aspectRatioPreset: store.get('aspectRatioPreset', '16:9'),
      regionBoxEnabled: store.get('regionBoxEnabled', false),
      regionBounds: store.get('regionBounds', null),
      audioRecordingMode: store.get('audioRecordingMode', 'system')
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

  // Open the recordings folder in system file explorer
  ipcMain.on('open-recordings-folder', (): void => {
    const recordingsPath = join(app.getPath('userData'), 'recordings')
    shell.openPath(recordingsPath)
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

  interface SavedPrompt {
    id: string
    title: string
    icon?: string
    text: string
    createdAt: number
    updatedAt: number
  }

  /* SAVED PROMPTS IPC HANDLERS */

  // Get all saved prompts
  ipcMain.handle('get-saved-prompts', () => {
    return store.get('savedPrompts', []) as SavedPrompt[]
  })

  // Add or update a saved prompt
  ipcMain.handle('save-saved-prompt', (_, prompt: SavedPrompt) => {
    const prompts = store.get('savedPrompts', []) as SavedPrompt[]
    const index = prompts.findIndex((p) => p.id === prompt.id)
    if (index !== -1) {
      prompts[index] = { ...prompt, updatedAt: Date.now() }
    } else {
      prompts.push({ ...prompt, createdAt: Date.now(), updatedAt: Date.now() })
    }
    // Sort by updatedAt desc
    prompts.sort((a, b) => b.updatedAt - a.updatedAt)
    store.set('savedPrompts', prompts)
    return true
  })

  // Delete a saved prompt
  ipcMain.handle('delete-saved-prompt', (_, id: string) => {
    const prompts = store.get('savedPrompts', []) as SavedPrompt[]
    const newPrompts = prompts.filter((p) => p.id !== id)
    store.set('savedPrompts', newPrompts)
    return true
  })

  // Get auto-send setting
  ipcMain.handle('get-autosend-settings', () => {
    return store.get('savedPromptsAutoSend', false)
  })

  // Set auto-send setting
  ipcMain.handle('set-autosend-settings', (_, autoSend) => {
    store.set('savedPromptsAutoSend', autoSend)
    return true
  })

  /* SCREEN RECORDER IPC HANDLERS */

  // Return available desktop capturer sources for the source picker
  ipcMain.handle('get-desktop-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 160, height: 90 },
      fetchWindowIcons: false
    })
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnailDataUrl: s.thumbnail.toDataURL()
    }))
  })

  // Save a recording buffer to the recordings folder, then post-process with
  // FFmpeg to move the moov atom to the front for instant seekability.
  ipcMain.handle(
    'save-recording',
    async (_, buffer: Uint8Array, filename?: string): Promise<string> => {
      if (!buffer || buffer.length === 0) {
        throw new Error('Received empty or null recording buffer')
      }
      const recordingsPath = join(app.getPath('userData'), 'recordings')
      if (!existsSync(recordingsPath)) mkdirSync(recordingsPath, { recursive: true })
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const finalName = filename || `recording-${timestamp}.mp4`
      const filePath = join(recordingsPath, finalName)
      writeFileSync(filePath, Buffer.from(buffer))

      // Post-process: re-mux with faststart to relocate the moov atom.
      // This is a copy-only operation (no re-encoding) and finishes in <1 second.
      const tempPath = filePath + '.tmp.mp4'
      try {
        const ffmpegPath = await getFfmpegPath()
        await execFileAsync(ffmpegPath, [
          '-i',
          filePath,
          '-movflags',
          'faststart',
          '-c',
          'copy',
          '-y',
          tempPath
        ])
        // Replace the original with the optimized file
        unlinkSync(filePath)
        renameSync(tempPath, filePath)
        console.log(`FFmpeg faststart: ${finalName} optimized for seeking`)
      } catch (err) {
        console.error('FFmpeg faststart failed, keeping raw file:', err)
        // Clean up temp file if it was created
        if (existsSync(tempPath)) unlinkSync(tempPath)
      }

      return filePath
    }
  )

  /* AUDIO RECORDING IPC HANDLERS */

  // Save an audio recording: receives WebM audio buffer, converts to MP3 via FFmpeg
  ipcMain.handle(
    'save-audio-recording',
    async (_, buffer: Uint8Array, filename?: string): Promise<string> => {
      if (!buffer || buffer.length === 0) {
        throw new Error('Received empty or null audio buffer')
      }
      const audioPath = join(app.getPath('userData'), 'recordings', 'audio')
      if (!existsSync(audioPath)) mkdirSync(audioPath, { recursive: true })

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const tempName = `audio-temp-${timestamp}.webm`
      const tempPath = join(audioPath, tempName)
      const finalName = filename || `audio-${timestamp}.mp3`
      const finalPath = join(audioPath, finalName)

      writeFileSync(tempPath, Buffer.from(buffer))

      try {
        const ffmpegPath = await getFfmpegPath()
        await execFileAsync(ffmpegPath, [
          '-i', tempPath,
          '-vn',
          '-ab', '192k',
          '-ar', '44100',
          '-y',
          finalPath
        ])
        // Clean up temp WebM file
        if (existsSync(tempPath)) unlinkSync(tempPath)
        console.log(`Audio saved: ${finalName}`)
      } catch (err) {
        console.error('FFmpeg audio conversion failed:', err)
        // Clean up on failure
        if (existsSync(tempPath)) unlinkSync(tempPath)
        throw new Error(`Audio conversion failed: ${err}`)
      }

      return finalPath
    }
  )

  // List all MP3 files in the audio recordings directory
  ipcMain.handle('list-audio-files', () => {
    const audioPath = join(app.getPath('userData'), 'recordings', 'audio')
    if (!existsSync(audioPath)) return []

    const files = readdirSync(audioPath)
      .filter((f) => f.toLowerCase().endsWith('.mp3'))
      .map((f) => {
        const fullPath = join(audioPath, f)
        const stats = lstatSync(fullPath)
        return {
          name: f,
          path: fullPath,
          sizeBytes: stats.size,
          createdAt: stats.birthtimeMs
        }
      })
      .sort((a, b) => b.createdAt - a.createdAt)

    return files
  })

  // Delete a specific audio file (validates it's in the audio directory)
  ipcMain.handle('delete-audio-file', (_, filePath: string) => {
    const audioPath = join(app.getPath('userData'), 'recordings', 'audio')
    // Security: ensure the file is inside the audio directory
    if (!filePath.startsWith(audioPath)) {
      throw new Error('Cannot delete files outside the audio directory')
    }
    if (existsSync(filePath)) {
      unlinkSync(filePath)
      return true
    }
    return false
  })

  // Trim an audio file using FFmpeg copy mode (no re-encoding)
  ipcMain.handle(
    'trim-audio',
    async (_, filePath: string, startSec: number, endSec: number): Promise<string> => {
      const audioPath = join(app.getPath('userData'), 'recordings', 'audio')
      if (!filePath.startsWith(audioPath)) {
        throw new Error('Cannot trim files outside the audio directory')
      }
      if (!existsSync(filePath)) {
        throw new Error('Source file not found')
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const baseName = filePath.replace(/\.mp3$/i, '')
      const trimmedPath = `${baseName}_trimmed_${timestamp}.mp3`

      try {
        const ffmpegPath = await getFfmpegPath()
        await execFileAsync(ffmpegPath, [
          '-i', filePath,
          '-ss', String(startSec),
          '-to', String(endSec),
          '-c', 'copy',
          '-y',
          trimmedPath
        ])
        console.log(`Audio trimmed: ${trimmedPath}`)
      } catch (err) {
        console.error('FFmpeg trim failed:', err)
        if (existsSync(trimmedPath)) unlinkSync(trimmedPath)
        throw new Error(`Trim failed: ${err}`)
      }

      return trimmedPath
    }
  )

  // Get audio duration in seconds using FFmpeg
  ipcMain.handle('get-audio-duration', async (_, filePath: string): Promise<number> => {
    try {
      const ffmpegPath = await getFfmpegPath()
      // Use ffprobe-style approach via ffmpeg: read stderr for duration
      const { stderr } = await execFileAsync(ffmpegPath, [
        '-i', filePath,
        '-f', 'null',
        '-'
      ])
      // Parse duration from FFmpeg output: "Duration: HH:MM:SS.ms"
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/)
      if (match) {
        const hours = parseFloat(match[1])
        const minutes = parseFloat(match[2])
        const seconds = parseFloat(match[3])
        return hours * 3600 + minutes * 60 + seconds
      }
      return 0
    } catch (err: unknown) {
      // FFmpeg writes duration info to stderr even on "error" exit codes
      const errObj = err as { stderr?: string }
      if (errObj.stderr) {
        const match = errObj.stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/)
        if (match) {
          const hours = parseFloat(match[1])
          const minutes = parseFloat(match[2])
          const seconds = parseFloat(match[3])
          return hours * 3600 + minutes * 60 + seconds
        }
      }
      return 0
    }
  })

  // Open the audio recordings folder in system file explorer
  ipcMain.on('open-audio-folder', (): void => {
    const audioPath = join(app.getPath('userData'), 'recordings', 'audio')
    if (!existsSync(audioPath)) mkdirSync(audioPath, { recursive: true })
    shell.openPath(audioPath)
  })

  // Read an audio file as a buffer (for blob URL playback in the trimmer)
  ipcMain.handle('read-audio-file', (_, filePath: string): Uint8Array | null => {
    const audioPath = join(app.getPath('userData'), 'recordings', 'audio')
    if (!filePath.startsWith(audioPath)) return null
    if (!existsSync(filePath)) return null
    return new Uint8Array(readFileSync(filePath))
  })

  // Open the trimmer window
  ipcMain.on('open-trimmer-window', (): void => {
    createTrimmerWindow()
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
