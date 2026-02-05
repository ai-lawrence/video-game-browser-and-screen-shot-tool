# Video Game Browser & Screenshot Tool (Electron Overlay AI Companion)

A specialized desktop application designed to provide a persistent, non-intrusive AI interface and utility layer for Windows 11 gamers. This overlay sits on top of your full-screen borderless games, giving you instant access to AI assistance (ChatGPT, Gemini, Perplexity) and advanced interaction tools without alt-tabbing.

## 🚀 Key Features

*   **Always-On-Top Overlay**: A transparent, click-through layer that stays visible over your game.
*   **Multi-AI Support**: Seamlessly switch between **ChatGPT**, **Gemini**, and **Perplexity AI** via the sidebar. Includes session persistence so you stay logged in.
*   **Smart Snipping Tool**: Capture regions of your screen instantly.
    *   **Clean Capture**: The overlay automatically hides itself during screenshots to ensure a clean image.
    *   **Send to AI**: Automatically pastes captured snips into the active AI chat for immediate analysis.
    *   **Auto-Close**: The snipping interface automatically closes after saving/sending.
*   **Gallery Management**: Built-in gallery to view, manage, and delete screenshots and snips.
*   **Customizable Hotkeys**: Rebindable global hotkeys for toggling visibility and taking screenshots.
*   **Portable Design**: All configuration and data are stored locally in a `data` folder next to the executable, making it fully portable.

## 🛠️ Installation & Build

### Prerequisites
*   Node.js (v16 or higher recommended)
*   npm (comes with Node.js)

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
*   **Portable .exe**: A single-file executable in `dist/`.
*   **Unpacked Folder**: A directory in `dist/win-unpacked/` containing the executable and resources.

## 🎮 Usage

1.  **Launch the App**: Run the executable. The overlay will appear on your screen.
2.  **Toggle Visibility**: Use the global hotkey (default: `Ctrl+H` or configurable in settings) to hide/show the overlay.
3.  **Resize & Move**: 
    *   Drag the **handle** to move the AI window.
    *   Resize using the corner grip (enforces a 2:3 aspect ratio).
4.  **Snipping**: 
    *   Click the "Snip" button or use the hotkey.
    *   Select an area.
    *   The overlay hides -> Snip is taken -> Overlay returns -> Image is sent to AI.

## ⚙️ Configuration

Settings are accessible via the gear icon in the sidebar:
*   **Hotkeys**: Click to record new keybinds.
*   **Data Management**: Clear cache or screenshot history.

## 🏗️ Tech Stack

*   **Electron**: Cross-platform desktop framework.
*   **React**: UI library.
*   **TypeScript**: Type-safe development.
*   **Vite**: Fast build tool and dev server.
*   **Electron Store**: Local configuration persistence.
