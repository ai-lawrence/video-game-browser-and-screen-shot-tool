# Creating Plugins for Video Game Overlay

Welcome to the plugin development guide for the **Video Game Overlay** application. This guide will walk you through creating a new plugin, extending its features (like prompts, sidebar buttons, and themes), testing it locally, and preparing it for distribution.

---

## 1. What is a Plugin?

In the Video Game Overlay app, a plugin is a module that provides game-specific knowledge and features. It can inject custom AI prompts, add helpful sidebar buttons, and apply a custom color theme.

A plugin is simply a folder that contains a `manifest.json` file. All the power of the plugin comes from configuring this manifest correctly.

---

## 2. Setting Up Your Local Environment

This application is **fully portable** — all data is stored in a `data` folder right next to the executable. Nothing is saved to `%APPDATA%` or any other system directory.

Your plugins directory is located at:

```text
<app-directory>\data\plugins\
```

For example, if your application executable is at `C:\Games\video-game-overlay.exe`, then your plugins folder would be:

```text
C:\Games\data\plugins\
```

> **Tip:** If you're running the app in development mode, the `data` folder is created at the project root instead.

**To create a new plugin:**

1. Navigate to the `data\plugins\` folder next to the application executable.
2. Create a new folder for your plugin. Name it the same as your plugin's ID (e.g., `my-game-plugin`).
3. Inside this folder, create a new file named `manifest.json`.

---

## 3. Creating the `manifest.json`

The `manifest.json` file is where you define your plugin's identity and its features.

Here is the basic required structure for your `manifest.json`:

```json
{
  "id": "my-game-plugin",
  "name": "My Custom Game Plugin",
  "version": "1.0.0",
  "description": "Adds useful prompts and tools for my favorite game.",
  "author": "Your Name",
  "icon": "🕹️",
  "game": "My Game",
  "tags": ["fps", "strategy"]
}
```

- **`id`** *(required)*: Unique identifier for your plugin (use hyphenated lowercase letters). This **must** match the name of your plugin's folder.
- **`name`** *(required)*: The human-readable name of your plugin.
- **`version`**: The current version of your plugin.
- **`description`**: A short explanation of what your plugin does.
- **`author`**: Your name or your organization.
- **`icon`**: An emoji to represent the plugin in the UI.
- **`game`**: The specific game this plugin is designed for.
- **`tags`**: Helpful search tags for filtering in the plugin browser.

---

## 4. Adding Features to Your Plugin

Once your basic identity is set up, you can start extending the overlay's functionality. Add the following optional arrays and objects to your `manifest.json`.

### A. Adding Custom Prompts

You can pre-define prompts that users can send to the AI overlay while playing the game.

Add a `prompts` array:

```json
{
  "prompts": [
    {
      "id": "strategy-advice",
      "title": "Strategy Advice",
      "icon": "💡",
      "text": "What is the best strategy against the current boss in this area?"
    },
    {
      "id": "loot-check",
      "title": "Analyze Loot",
      "icon": "💎",
      "text": "Analyze the loot in this screenshot. Is it worth keeping?"
    }
  ]
}
```

### B. Adding Sidebar Buttons

You can add interactive buttons to the application's sidebar that inject prompts or open external URLs (like wikis).

Add a `sidebarButtons` array:

```json
{
  "sidebarButtons": [
    {
      "id": "wiki-link",
      "label": "Open Wiki",
      "icon": "Globe",
      "action": "open-url",
      "url": "https://my-game-wiki.com/guides"
    },
    {
      "id": "quick-strategy",
      "label": "Get Strategy",
      "icon": "Sword",
      "action": "inject-prompt",
      "promptId": "strategy-advice"
    }
  ]
}
```

**Supported Actions:**

- `"open-url"`: Opens the specified `url` in the overlay's browser.
- `"inject-prompt"`: Triggers the prompt specified by `promptId` (must match an ID from your `prompts` array).
- `"toggle-panel"`: Toggles a side panel (if supported by the UI).

**Supported Icons:** Sidebar button icons use [Lucide icon](https://lucide.dev/icons/) names (e.g., `Globe`, `Sword`, `Shield`, `Map`) or emoji characters.

### C. Adding Custom Themes

If you want the overlay to match the aesthetics of your game, you can override the application's color scheme.

Add a `theme` object:

```json
{
  "theme": {
    "primary": "#E63946",
    "surface": "#1D3557",
    "accent": "#F1FAEE"
  }
}
```

All three fields (`primary`, `surface`, `accent`) are optional CSS color values.

---

## 5. Testing Your Plugin

1. Ensure your `manifest.json` is saved inside `data\plugins\my-game-plugin\` (relative to the application executable).
2. Fully restart the **Video Game Overlay** application.
3. Once the application loads, it will automatically scan the `data\plugins\` folder for valid manifests.
4. Open the **Game Plugins** panel from the sidebar to see your plugin listed under the **Installed** tab.
5. Click **Activate** to apply your new sidebar buttons, prompts, and theme.

> **Troubleshooting:** If your plugin isn't appearing, ensure:
>
> - Your `manifest.json` contains valid JSON syntax (no trailing commas, proper quoting).
> - The `id` and `name` fields are both present — these are the minimum required fields.
> - The plugin folder name matches the `id` in your manifest.

---

## 6. Packaging and Distribution

If you want to share your plugin with others:

1. **Zip the contents**: Compress the contents of your `my-game-plugin` folder into a `.zip` file. The root of the zip file should directly contain the `manifest.json`, not the parent folder.
2. **Release**: Upload this zip file to a GitHub release or a preferred hosting location.
3. **Register (Optional)**: The application fetches available plugins from a centralized registry at:

   ```
   https://github.com/ai-lawrence/overlay-plugins
   ```

   You can submit a Pull Request to the `plugins.json` file in that repository, adding your plugin's metadata (including the `downloadUrl` pointing directly to your zip file) to make it discoverable by all users inside the app's **Browse** tab.

---

## 7. Full Example `manifest.json`

Here is a complete example showing all available features combined into a single manifest:

```json
{
  "id": "dark-souls-companion",
  "name": "Dark Souls Companion",
  "version": "1.0.0",
  "description": "Boss strategies, item lookups, and a dark red theme for Dark Souls.",
  "author": "YourName",
  "icon": "⚔️",
  "game": "Dark Souls",
  "tags": ["souls-like", "rpg", "action"],
  "prompts": [
    {
      "id": "boss-strategy",
      "title": "Boss Strategy",
      "icon": "🗡️",
      "text": "What is the recommended strategy for defeating this boss?"
    },
    {
      "id": "item-lookup",
      "title": "Identify Item",
      "icon": "🔍",
      "text": "What is this item and where can I use it?"
    }
  ],
  "sidebarButtons": [
    {
      "id": "fextralife-wiki",
      "label": "Fextralife Wiki",
      "icon": "Globe",
      "action": "open-url",
      "url": "https://darksouls.wiki.fextralife.com/"
    },
    {
      "id": "quick-boss",
      "label": "Boss Help",
      "icon": "Sword",
      "action": "inject-prompt",
      "promptId": "boss-strategy"
    }
  ],
  "theme": {
    "primary": "#8B0000",
    "surface": "#1a1a1a",
    "accent": "#FFD700"
  }
}
```
