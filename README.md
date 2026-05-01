# Keyworder for Supernote

**Keyworder** is a productivity utility for Supernote devices that allows you to tag note pages with your most-used keywords in a single tap. It bridges the gap between your personal organizational system and the Supernote's native indexing.

## Features

- **One-Tap Tagging:** Instantly insert a keyword onto the current page without using the lasso or handwriting recognition.
- **Global Palette:** Maintain a consistent list of keywords available across all your notes.
- **Native Index Integration:** Automatically adds keywords to the device's internal keyword index for native navigation.
- **Favorites & Pinning:** Keep your high-frequency tags at the top for zero-scroll access.
- **A-Z Jump Row:** Quickly navigate large keyword collections with alphabetical shortcuts.

## Installation

1. Build the plugin (see below) or download the `Keyworder.snplg` file.
2. Connect your Supernote to your computer via USB.
3. Copy `Keyworder.snplg` into the `Plugins` folder on your Supernote's internal storage.
4. On your device, ensure the plugin is active under **Settings > Apps > Plugins**.

## Usage

1. Tap the **Tag** icon in your Supernote toolbar.
2. Select a keyword from your list.
3. The plugin will stamp the text at the bottom of the page and add it to the native keyword index.
4. Tap **Manage** to add, delete, or pin keywords.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm

### Build Instructions

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the build script:
   ```bash
   chmod +x buildPlugin.sh
   ./buildPlugin.sh
   ```
3. The installer will be generated at `build/outputs/Keyworder.snplg`.

## Technical Note

This plugin is built using the **Supernote Plugin SDK** (`sn-plugin-lib`). It leverages the `PluginNoteAPI` for text insertion and the `PluginFileAPI` for native keyword indexing.

## License

[MIT](LICENSE)
