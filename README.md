# Video Game Browser & Screenshot Tool (Electron Overlay AI Companion)

[![Download Latest Release](https://img.shields.io/github/v/release/ai-lawrence/video-game-browser-and-screen-shot-tool?label=Download&style=for-the-badge&logo=github)](https://github.com/ai-lawrence/video-game-browser-and-screen-shot-tool/releases/latest)

A specialized desktop application designed to provide a persistent, non-intrusive AI interface and utility layer for Windows 11 gamers. This overlay sits on top of your full-screen borderless games, giving you instant access to AI assistance (ChatGPT, Gemini, Perplexity) and advanced interaction tools without alt-tabbing.

## 🚀 Key Features

- **Always-On-Top Overlay**: A transparent, click-through layer that stays visible over your game.
- **Multi-AI Support**: Seamlessly switch between **ChatGPT**, **Gemini**, and **Perplexity AI** via the sidebar. Includes session persistence so you stay logged in.
- **Smart Snipping Tool**: Capture regions of your screen instantly.
  - **Clean Capture**: The overlay automatically hides itself during screenshots to ensure a clean image.
  - **Send to AI**: Automatically pastes captured snips into the active AI chat for immediate analysis.
  - **Auto-Close**: The snipping interface automatically closes after saving/sending.
- **Saved Prompts**: Store and organize your frequently used AI prompts.
  - **One-Click Injection**: Send prompts to the active AI with a single click.
  - **Auto-Send**: Optionally send the prompt immediately upon injection.
  - **Emoji Icons**: Customize your prompts with a rich library of native emojis for easy recognition.
- **Gallery Management**: Built-in gallery to view, manage, and delete screenshots and snips.
- **Customizable Hotkeys**: Rebindable global hotkeys for toggling visibility, taking screenshots, and saving clips.
- **Portable Design**: All configuration and data are stored locally in a `data` folder next to the executable, making it fully portable.

### 🎬 Screen Recording & Instant Replay *(New in v1.2.0)*

- **Instant Replay Buffer**: Continuously records in the background (configurable: 30s, 1 min, or 2 min) using auto-rotating sessions. Press the **Save Clip** hotkey (default: `Alt+C`) at any time to save the last buffer cycle as an MP4.
- **Manual Recording**: Start/stop a manual recording session (up to 60 seconds) via the sidebar record button.
- **Recorder Status Overlay**: A live HUD shows recording status, elapsed time, buffer fill, and active audio sources.

### 🎧 Audio Recording *(New in v1.2.0)*

- **System Audio**: Capture desktop/game audio alongside your video.
- **Microphone Input**: Record your voice with selectable mic device and a refresh button to re-enumerate devices.
- Audio sources are mixed into the final clip automatically.

### 📐 Custom Recording Region *(New in v1.2.0)*

- **Crop Button** (sidebar): Toggles **visibility** of the region selection box for positioning and resizing — does not affect recording mode.
- **Lock Aspect Ratio** (region box toolbar): When **ON**, all recordings (instant replay clips and manual recordings) capture **only the content inside the region box**. When **OFF**, recordings are full-screen.
- **Aspect Ratio Presets**: Choose from **16:9** (YouTube), **9:16** (TikTok / Reels), **1:1** (Instagram), **4:5** (Instagram Portrait), and **4:3** (Classic).
- **Draggable Selection Box**: Drag to reposition and resize the box to frame exactly what you want to record. Bounds are saved automatically.
- The region box can be **hidden** while Lock Aspect Ratio stays ON — recording will still capture only the region.

### 📊 Resolution Presets *(New in v1.2.0)*

Choose your recording resolution:
- **720p** (HD)
- **1080p** (Full HD) — default
- **1440p** (2K)

### 🎞️ Seekable MP4 Output *(New in v1.2.0)*

- Clips are saved as **MP4 (H.264)** for universal playback.
- Automatically post-processed with **FFmpeg `faststart`** to relocate the `moov` atom for **instant seekability** — no more broken seek bars.
- FFmpeg is **bundled** with the application — no external install required.

### 💾 Recordings Management *(New in v1.2.0)*

- Clips are saved to the portable `data/recordings/` directory.
- Open the recordings folder directly from the sidebar.
- Toast notifications confirm when a clip is saved.

## 🛠️ Installation & Build

### Prerequisites

- Node.js (v16 or higher recommended)
- npm (comes with Node.js)

### Running Locally (Development)

1.  Clone the repository:

    ```bash
    git clone https://github.com/ai-lawrence/video-game-browser-and-screen-shot-tool.git
    cd video-game-browser-and-screen-shot-tool
    ```

2.  Install dependencies:

    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

### Building the Application

To create a standalone executable for Windows:

```bash
npm run build:win
```

This will generate:

- **Portable .exe**: A single-file executable in `dist/`.
- **Unpacked Folder**: A directory in `dist/win-unpacked/` containing the executable and resources.

## 📥 Downloads

You can download the latest portable executable directly from the [GitHub Releases](https://github.com/ai-lawrence/video-game-browser-and-screen-shot-tool/releases) page.

## 🎮 Usage

1.  **Launch the App**: Run the executable. The overlay will appear on your screen.
2.  **Toggle Visibility**: Use the global hotkey (default: `Alt+V` or configurable in settings) to hide/show the overlay.
3.  **Resize & Move**:
    - Drag the **handle** to move the AI window.
    - Resize using the corner grip (enforces a 2:3 aspect ratio).
4.  **Snipping**:
    - Click the "Snip" button or use the hotkey.
    - Select an area.
    - The overlay hides -> Snip is taken -> Overlay returns -> Image is sent to AI.
5.  **Recording**:
    - Enable **Background Buffering** in settings for always-on instant replay.
    - Press `Alt+C` (default) to save the last buffer cycle as a clip.
    - Or click the **record button** in the sidebar for manual recording.
6.  **Region Recording**:
    - Click the **Crop** icon in the sidebar to show the region selection box.
    - Drag and resize the box to frame your content.
    - Toggle **Lock Aspect Ratio** in the region box toolbar to enable cropped recording.
    - You can hide the box (click Crop again) while Lock Aspect Ratio stays ON — recording will still capture only the region.
    - Turn **Lock Aspect Ratio OFF** to return to full-screen recording.

## ⚙️ Configuration

Settings are accessible via the gear icon in the sidebar:

- **Shortcuts**: Rebind hotkeys for screenshot, snip, toggle visibility, and save clip.
- **Audio**: Toggle system audio and microphone capture, select mic device.
- **Recording**: Choose resolution (720p / 1080p / 1440p), enable custom aspect ratio with preset selection, toggle background buffering, and set buffer length (30s / 1 min / 2 min).
- **Data Management**: Clear cache or screenshot history.

## 🏗️ Tech Stack

- **Electron**: Cross-platform desktop framework.
- **React**: UI library.
- **TypeScript**: Type-safe development.
- **Vite**: Fast build tool and dev server.
- **Electron Store**: Local configuration persistence.
- **FFmpeg** (bundled via `ffmpeg-static`): Video post-processing for seekable MP4 output.
