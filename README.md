

https://github.com/user-attachments/assets/f34df9e4-7201-4b98-add2-7ec3ba60ab7e



https://github.com/user-attachments/assets/e0c9dfe5-80fb-4943-8f01-95a33f713459

# Keyworder for Supernote

**Keyworder** is a productivity plugin for the Supernote Nomad that lets you stamp your most-used keywords onto a note page with a single tap, and automatically adds them to the device's native keyword navigation index.

> **Pre-release:** This plugin requires the Supernote beta firmware and is not yet intended for general use.

## Features

- **One-tap tagging** — insert a keyword onto the current page instantly, no lasso or handwriting recognition needed
- **Native index integration** — automatically adds each keyword to the device's built-in keyword index for page navigation
- **In-plugin keyword management** — add, delete, and pin keywords directly from the plugin; changes persist automatically
- **Pinned keywords** — keep your most-used keywords at the top of the list for zero-scroll access
- **A-Z jump row** — quickly navigate large keyword lists with alphabetical shortcuts

## Installation

1. Download `Keyworder.snplg` from the [latest release](https://github.com/taoist22/sn-keyworder/releases).
2. Connect your Supernote to your computer using the Supernote Partner app or Browse & Access.
3. Copy `Keyworder.snplg` into the `MyStyle` folder on your device.
4. On your Supernote, open a note, tap the **plugin icon** in the toolbar, go to **Manage Plugins**, tap **Add Plugin**, and select `Keyworder`.

## Managing Your Keywords

Keywords are managed entirely within the plugin — no external tools or file transfers needed.

### Adding a keyword

1. Open Keyworder and tap **Manage** in the header.
2. Tap **+ Add**, type your keyword, and confirm.
3. The keyword is saved immediately and will be there the next time you open the plugin.

### Pinning a keyword

In the Manage screen, tap the **pin icon** next to any keyword to move it to the Pinned section at the top of the list for quick access.

### Deleting a keyword

In the Manage screen, tap the **delete icon** next to the keyword you want to remove.

## Usage

1. Open a note and tap the **plugin icon** in the toolbar.
2. Select a keyword from the list.
3. The plugin stamps the keyword at the bottom of the page — it will be selected so you can immediately move it to your desired location. It is also added to the native keyword navigation index.

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm
- JDK 19+ (for native Android build)

### Build

```bash
npm install
JAVA_HOME=/path/to/your/jdk ./buildPlugin.sh
```

The plugin file will be generated at `build/outputs/Keyworder.snplg`.

> **Note:** The first build generates autolinking files; run the build command twice on a clean checkout to ensure `reactPackages` is correctly populated in the plugin config.

## License

[MIT](LICENSE)
