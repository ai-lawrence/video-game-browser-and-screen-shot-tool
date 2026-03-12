/**
 * Auto-Updater Module
 *
 * Checks the GitHub Releases API for a newer portable exe, downloads it,
 * and performs a bat-script self-replacement (the running exe can't overwrite
 * itself, so a small script handles the swap after the process exits).
 */
import { app, BrowserWindow } from 'electron'
import { get as httpsGet, RequestOptions } from 'https'
import { createWriteStream, writeFileSync, existsSync, unlinkSync } from 'fs'
import { join, dirname, basename } from 'path'
import { spawn } from 'child_process'

// ── Constants ────────────────────────────────────────────────────────
const GITHUB_OWNER = 'ai-lawrence'
const GITHUB_REPO = 'video-game-browser-and-screen-shot-tool'
const ASSET_PATTERN = /video-game-overlay-.*-portable\.exe$/i

// ── Types ────────────────────────────────────────────────────────────
export interface UpdateInfo {
  updateAvailable: boolean
  latestVersion: string
  downloadUrl: string
  releaseNotes: string
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Compares two semver strings (e.g. "1.3.1" vs "1.4.0").
 * Returns true if `remote` is strictly newer than `local`.
 */
function isNewerVersion(local: string, remote: string): boolean {
  const parse = (v: string): number[] =>
    v
      .replace(/^v/i, '')
      .split('.')
      .map(Number)
  const [lMaj, lMin, lPat] = parse(local)
  const [rMaj, rMin, rPat] = parse(remote)
  if (rMaj !== lMaj) return rMaj > lMaj
  if (rMin !== lMin) return rMin > lMin
  return rPat > lPat
}

/**
 * Performs an HTTPS GET and follows up to 5 redirects (GitHub uses 302s).
 * Resolves with the final response.
 */
function httpsGetFollowRedirects(
  url: string,
  headers: Record<string, string>,
  maxRedirects = 5
): Promise<import('http').IncomingMessage> {
  return new Promise((resolve, reject) => {
    const opts: RequestOptions = {
      headers: { 'User-Agent': `${GITHUB_REPO}-updater`, ...headers }
    }
    const request = httpsGet(url, opts, (res) => {
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        if (maxRedirects <= 0) return reject(new Error('Too many redirects'))
        return resolve(httpsGetFollowRedirects(res.headers.location, headers, maxRedirects - 1))
      }
      resolve(res)
    })
    request.on('error', reject)
  })
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Check the GitHub Releases API for a newer version.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const currentVersion = app.getVersion()
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`

  return new Promise((resolve) => {
    const opts: RequestOptions = {
      headers: {
        'User-Agent': `${GITHUB_REPO}-updater`,
        Accept: 'application/vnd.github.v3+json'
      }
    }

    httpsGet(apiUrl, opts, (res) => {
      let body = ''
      res.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })
      res.on('end', () => {
        try {
          const release = JSON.parse(body)
          const tag: string = release.tag_name || ''
          const remoteVersion = tag.replace(/^v/i, '')

          if (!isNewerVersion(currentVersion, remoteVersion)) {
            resolve(null)
            return
          }

          // Find the portable exe asset
          const assets: Array<{ name: string; browser_download_url: string }> =
            release.assets || []
          const exeAsset = assets.find((a) => ASSET_PATTERN.test(a.name))
          if (!exeAsset) {
            console.warn('Update available but no matching portable exe asset found')
            resolve(null)
            return
          }

          resolve({
            updateAvailable: true,
            latestVersion: remoteVersion,
            downloadUrl: exeAsset.browser_download_url,
            releaseNotes: release.body || ''
          })
        } catch (err) {
          console.error('Failed to parse update response:', err)
          resolve(null)
        }
      })
    }).on('error', (err) => {
      console.error('Update check failed:', err)
      resolve(null)
    })
  })
}

/**
 * Get the directory where the portable exe lives.
 */
function getPortableDir(): string {
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return process.env.PORTABLE_EXECUTABLE_DIR
  }
  return dirname(app.getPath('exe'))
}

/**
 * Download the new exe and apply the update via a bat-script swap.
 * Sends progress events to the given BrowserWindow.
 */
export async function downloadAndApplyUpdate(
  downloadUrl: string,
  mainWindow: BrowserWindow
): Promise<void> {
  const portableDir = getPortableDir()
  const currentExe = app.getPath('exe')
  const currentExeName = basename(currentExe)
  const updateExePath = join(portableDir, 'video-game-overlay-update.exe')

  // Clean previous partial download
  if (existsSync(updateExePath)) {
    unlinkSync(updateExePath)
  }

  // Download the new exe, following redirects (GitHub serves from CDN)
  const res = await httpsGetFollowRedirects(downloadUrl, {
    Accept: 'application/octet-stream'
  })

  if (!res.statusCode || res.statusCode >= 400) {
    throw new Error(`Download failed with status ${res.statusCode}`)
  }

  const totalBytes = parseInt(res.headers['content-length'] || '0', 10)
  let downloadedBytes = 0

  const fileStream = createWriteStream(updateExePath)

  await new Promise<void>((resolve, reject) => {
    res.on('data', (chunk: Buffer) => {
      downloadedBytes += chunk.length
      if (totalBytes > 0) {
        const percent = Math.round((downloadedBytes / totalBytes) * 100)
        mainWindow.webContents.send('update-download-progress', percent)
      }
    })
    res.pipe(fileStream)
    fileStream.on('finish', () => {
      fileStream.close()
      resolve()
    })
    fileStream.on('error', reject)
    res.on('error', reject)
  })

  // Write the swap batch script
  // The script waits for the old process to exit, replaces the exe, and launches the new one.
  const batPath = join(portableDir, '_update.bat')
  const batContent = `@echo off
echo Applying update...
:: Wait for the old process to fully exit
timeout /t 2 /nobreak >nul
:: Delete the old exe
del /f /q "${currentExe}"
:: Rename the downloaded file to the original name
move /y "${updateExePath}" "${join(portableDir, currentExeName)}"
:: Launch the updated application
start "" "${join(portableDir, currentExeName)}"
:: Clean up this script
del /f /q "%~f0"
`

  writeFileSync(batPath, batContent, 'utf-8')

  // Launch the batch script detached and quit the app
  spawn('cmd.exe', ['/c', batPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  }).unref()

  app.quit()
}
