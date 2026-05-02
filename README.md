# Keyworder for Supernote

**Keyworder** is a productivity plugin for the Supernote Nomad that lets you stamp your most-used keywords onto a note page with a single tap, and automatically adds them to the device's native keyword navigation index.

> **Pre-release:** This plugin requires the Supernote beta firmware and is not yet intended for general use.

## Features

- **One-tap tagging** — insert a keyword onto the current page instantly, no lasso or handwriting recognition needed
- **Native index integration** — automatically adds each keyword to the device's built-in keyword index for page navigation
- **Pinned keywords** — keep your most-used keywords at the top of the list for zero-scroll access
- **A-Z jump row** — quickly navigate large keyword lists with alphabetical shortcuts

## Installation

1. Download `Keyworder.snplg` from the [latest release](https://github.com/taoist22/sn-keyworder/releases).
2. Connect your Supernote to your computer using the Supernote Partner app or Browse & Access.
3. Copy `Keyworder.snplg` into the `MyStyle` folder on your device.
4. On your Supernote, open a note, tap the **plugin icon** in the toolbar, go to **Manage Plugins**, tap **Add Plugin**, and select `Keyworder`.

## Setting Up Your Keywords

Keyworder uses a `keywords.json` file stored on your device to populate the keyword list. Use the **Keyword Builder** web tool to create and manage this file:

**[Open the Keyword Builder](https://taoist22.github.io/sn-keyworder/keyword-tool.html)**

1. **Launch the plugin first** — open a note, tap the plugin icon, and open Keyworder. This creates the `MyStyle/SnKeyworder/` folder on your device automatically.
2. Go to the Keyword Builder, add your keywords, and click **Download keywords.json**.
3. Connect your Supernote via the Partner app or Browse & Access.
4. Copy `keywords.json` into `MyStyle/SnKeyworder/` on your device.
5. Close and reopen the plugin — your keywords will load automatically.

To update your keywords later, return to the Keyword Builder (your list will still be there), make your changes, download the updated file, copy it back to the same folder, then tap **Refresh** in the plugin to load the changes.

## Usage

1. Open a note and tap the **plugin icon** in the toolbar.
2. Select a keyword from the list.
3. The plugin stamps the keyword at the bottom of the page — move it to your desired location. It is also added to the native keyword navigation index.
4. Tap **Refresh** in the header at any time to reload your keyword list after uploading an updated `keywords.json`.

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm

### Build

```bash
npm install
./buildPlugin.sh
```

The plugin file will be generated at `build/outputs/Keyworder.snplg`.

## License

[MIT](LICENSE)
