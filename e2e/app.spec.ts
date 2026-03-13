import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { resolve } from 'path'

/**
 * Feature E2E tests for the Electron overlay app.
 *
 * Tests cover:
 *   - Window & renderer basics
 *   - Sidebar branding and layout
 *   - AI engine switching (ChatGPT / Gemini / Perplexity)
 *   - Settings panel open/close
 *   - IPC round-trip (get-settings)
 *   - Recording & region toggle buttons
 *
 * Prerequisites: `npm run build:unpack` (dist/win-unpacked must exist)
 */

const EXE = resolve(__dirname, '../dist/win-unpacked/video-game-overlay.exe')

let electronApp: ElectronApplication
let window: Page

// ── Setup & Teardown ─────────────────────────────────────────────────────

test.beforeAll(async () => {
  electronApp = await electron.launch({ executablePath: EXE })
  window = await electronApp.firstWindow()
  await window.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await electronApp.close()
})

// ── Window Basics ────────────────────────────────────────────────────────

test.describe('Window Basics', () => {
  test('renderer mounts the React root', async () => {
    const root = await window.$('#root')
    expect(root).not.toBeNull()
  })

  test('window is visible', async () => {
    const bw = await electronApp.browserWindow(window)
    const visible = await bw.evaluate((w) => w.isVisible())
    expect(visible).toBe(true)
  })

  test('window is always-on-top', async () => {
    const bw = await electronApp.browserWindow(window)
    const onTop = await bw.evaluate((w) => w.isAlwaysOnTop())
    expect(onTop).toBe(true)
  })

  test('window is frameless (no native title bar)', async () => {
    // A frameless Electron window has frame: false — we verify via no menu bar
    const bw = await electronApp.browserWindow(window)
    const menuBarVisible = await bw.evaluate((w) => w.isMenuBarVisible())
    expect(menuBarVisible).toBe(false)
  })
})

// ── Sidebar ──────────────────────────────────────────────────────────────

test.describe('Sidebar', () => {
  test('sidebar is rendered', async () => {
    const sidebar = await window.$('.sidebar')
    expect(sidebar).not.toBeNull()
  })

  test('branding shows "AI Overlay+"', async () => {
    const brandText = await window.textContent('.sidebar-brand')
    expect(brandText).toContain('AI Overlay+')
  })

  test('has three AI engine buttons', async () => {
    const engines = await window.$$('.sidebar-top .sidebar-item')
    // First 3 sidebar-items are ChatGPT, Gemini, Perplexity
    expect(engines.length).toBeGreaterThanOrEqual(3)
  })

  test('ChatGPT is the default active engine', async () => {
    // The ChatGPT button should have the "active" class on launch
    const chatgptBtn = (await window.$$('.sidebar-top .sidebar-item'))[0]
    const classes = await chatgptBtn.getAttribute('class')
    expect(classes).toContain('active')
  })
})

// ── AI Engine Switching ──────────────────────────────────────────────────

test.describe('AI Engine Switching', () => {
  test('clicking Gemini activates it and deactivates ChatGPT', async () => {
    // Click the Gemini button (2nd sidebar-item)
    const items = await window.$$('.sidebar-top .sidebar-item')
    await items[1].click()

    // Wait for React re-render
    await window.waitForTimeout(300)

    // Gemini should now be active
    const geminiClasses = await items[1].getAttribute('class')
    expect(geminiClasses).toContain('active')

    // ChatGPT should no longer be active
    const chatgptClasses = await items[0].getAttribute('class')
    expect(chatgptClasses).not.toContain('active')
  })

  test('clicking Perplexity activates it', async () => {
    const items = await window.$$('.sidebar-top .sidebar-item')
    await items[2].click()
    await window.waitForTimeout(300)

    const perplexityClasses = await items[2].getAttribute('class')
    expect(perplexityClasses).toContain('active')
  })

  test('switching back to ChatGPT works', async () => {
    const items = await window.$$('.sidebar-top .sidebar-item')
    await items[0].click()
    await window.waitForTimeout(300)

    const chatgptClasses = await items[0].getAttribute('class')
    expect(chatgptClasses).toContain('active')
  })
})

// ── Settings Panel ───────────────────────────────────────────────────────

test.describe('Settings Panel', () => {
  test('Settings button exists in sidebar', async () => {
    const settingsBtn = await window.$('.sidebar-bottom .sidebar-item')
    expect(settingsBtn).not.toBeNull()
    const label = await settingsBtn!.textContent()
    expect(label).toContain('Settings')
  })

  test('clicking Settings opens the settings overlay', async () => {
    const settingsBtn = await window.$('.sidebar-bottom .sidebar-item')
    await settingsBtn!.click()
    await window.waitForTimeout(400)

    const overlay = await window.$('.settings-overlay')
    expect(overlay).not.toBeNull()
  })

  test('settings panel contains Shortcuts, Audio, and Recording sections', async () => {
    const headings = await window.$$('.settings-panel h3')
    const texts = await Promise.all(headings.map((h) => h.textContent()))
    expect(texts).toContain('Shortcuts')
    expect(texts).toContain('Audio')
    expect(texts).toContain('Recording')
  })

  test('closing settings removes the overlay', async () => {
    const closeBtn = await window.$('.settings-panel .close-btn')
    await closeBtn!.click()
    await window.waitForTimeout(400)

    const overlay = await window.$('.settings-overlay')
    expect(overlay).toBeNull()
  })
})

// ── IPC Round-Trip ───────────────────────────────────────────────────────

test.describe('IPC Round-Trip', () => {
  test('get-settings returns expected default keys', async () => {
    // Call get-settings IPC handler via the renderer's preload api bridge
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settingsViaRenderer = await window.evaluate(() => (window as any).api.getSettings())

    expect(settingsViaRenderer).toHaveProperty('screenshotHotkey')
    expect(settingsViaRenderer).toHaveProperty('toggleHotkey')
    expect(settingsViaRenderer).toHaveProperty('bufferingEnabled')
    expect(settingsViaRenderer).toHaveProperty('recordingResolution')
  })
})

// ── Recording Controls ───────────────────────────────────────────────────

test.describe('Recording Controls', () => {
  test('Record button exists and shows "Record" label', async () => {
    const recBtn = await window.$('.recorder-btn')
    expect(recBtn).not.toBeNull()
    const text = await recBtn!.textContent()
    expect(text).toContain('Record')
  })

  test('Region button exists and shows "Region" label', async () => {
    const regionBtn = await window.$('.region-toggle-btn')
    expect(regionBtn).not.toBeNull()
    const text = await regionBtn!.textContent()
    expect(text).toContain('Region')
  })

  test('Region button toggles active state on click', async () => {
    const regionBtn = await window.$('.region-toggle-btn')

    // Get initial state
    const initialClasses = await regionBtn!.getAttribute('class')
    const wasActive = initialClasses!.includes('active')

    // Click to toggle
    await regionBtn!.click()
    await window.waitForTimeout(300)

    const newClasses = await regionBtn!.getAttribute('class')
    const isActive = newClasses!.includes('active')

    // Should have flipped
    expect(isActive).toBe(!wasActive)

    // Click again to restore original state
    await regionBtn!.click()
    await window.waitForTimeout(300)
  })
})

// ── Webviews ─────────────────────────────────────────────────────────────

test.describe('Webviews', () => {
  test('three webview elements are present in the DOM', async () => {
    const webviews = await window.$$('webview')
    expect(webviews.length).toBe(3)
  })

  test('webviews point to the correct AI services', async () => {
    const webviews = await window.$$('webview')
    const srcs = await Promise.all(webviews.map((wv) => wv.getAttribute('src')))
    const joined = srcs.join(' ')
    // Webviews may redirect on load (e.g. chatgpt.com → chatgpt.com/auth/login)
    expect(joined).toContain('chatgpt.com')
    expect(joined).toContain('gemini.google.com')
    expect(joined).toContain('perplexity.ai')
  })

  test('webviews use separate session partitions', async () => {
    const webviews = await window.$$('webview')
    const partitions = await Promise.all(webviews.map((wv) => wv.getAttribute('partition')))
    expect(partitions).toContain('persist:chatgpt')
    expect(partitions).toContain('persist:gemini')
    expect(partitions).toContain('persist:perplexity')
  })
})

// ── Plugin Browser ───────────────────────────────────────────────────────

test.describe('Plugin Browser', () => {
  test('sidebar plugin button is rendered', async () => {
    const pluginBtn = await window.$('.sidebar-plugin-btn')
    expect(pluginBtn).not.toBeNull()
  })

  test('sidebar plugin button shows "No Plugin" when nothing is active', async () => {
    const label = await window.textContent('.sidebar-plugin-label')
    expect(label).toContain('No Plugin')
  })

  test('clicking plugin button opens the Plugin Browser overlay', async () => {
    const pluginBtn = await window.$('.sidebar-plugin-btn')
    await pluginBtn!.click()
    await window.waitForTimeout(600)

    const overlay = await window.$('.plugin-browser-overlay')
    expect(overlay).not.toBeNull()
  })

  test('Plugin Browser shows the "Installed" tab by default', async () => {
    // The active tab button should contain "Installed"
    const activeTab = await window.$('.pb-tab.active')
    expect(activeTab).not.toBeNull()
    const text = await activeTab!.textContent()
    expect(text).toContain('Installed')
  })

  test('Plugin Browser header reads "Game Plugins"', async () => {
    const heading = await window.textContent('.plugin-browser-header h2')
    expect(heading).toContain('Game Plugins')
  })

  test('switching to Browse tab works', async () => {
    // Click the Browse tab
    const tabs = await window.$$('.pb-tab')
    await tabs[1].click()
    await window.waitForTimeout(400)

    const activeTab = await window.$('.pb-tab.active')
    const text = await activeTab!.textContent()
    expect(text).toContain('Browse')

    // Switch back to Installed
    await tabs[0].click()
    await window.waitForTimeout(300)
  })

  test('close button dismisses the Plugin Browser', async () => {
    const closeBtn = await window.$('.pb-close-btn')
    await closeBtn!.click()
    await window.waitForTimeout(400)

    const overlay = await window.$('.plugin-browser-overlay')
    expect(overlay).toBeNull()
  })
})

