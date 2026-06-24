https://github.com/user-attachments/assets/c61e4b78-69de-432d-8114-107f0b865d02

# Keyworder for Supernote

**Keyworder** is a productivity plugin for the Supernote Nomad and Manta that lets you stamp your most-used keywords onto a note page with a single tap, and automatically adds them to the device's native keyword navigation index.

> **Pre-release:** This plugin requires the Supernote beta firmware and is not yet intended for general use.

## Features

- **Multi-keyword insertion** — check any number of keywords and insert them all in one tap; each keyword lands as a separate, movable element in wrapped rows near the bottom of the page
- **Lasso to add keyword** — lasso any handwritten or typed text, tap the Keyworder button in the lasso toolbar, and save it directly to your keyword list; works with OCR for handwriting
- **Native index integration** — automatically adds each keyword to the device's built-in keyword index for page navigation
- **In-plugin keyword management** — add, delete, and pin keywords directly from the plugin; changes persist automatically
- **Bulk import** — use the **[Keyword Builder web tool](https://taoist22.github.io/sn-keyworder/keyword-tool.html)** to create a `keywords.json` file, then load the list onto the device
- **Pinned keywords** — keep your most-used keywords at the top of the list for zero-scroll access
- **Structured keywords** — optionally save a keyword with a short key so it inserts as `key:value` for tools such as sn-query
- **Keyword views** — filter the picker by pinned keywords or by key, then select the filtered view when you want a batch
- **A-Z jump row** — quickly navigate large keyword lists with alphabetical shortcuts

## Installation

1. Download `Keyworder.snplg` from the [v1.3.2-beta release](https://github.com/taoist22/sn-keyworder/releases/tag/v1.3.2-beta).
2. Connect your Supernote to your computer using the Supernote Partner app or Browse & Access.
3. Copy `Keyworder.snplg` into the `MyStyle` folder on your device.
4. On your Supernote, open a note, tap the **plugin icon** in the toolbar, go to **Manage Plugins**, tap **Add Plugin**, and select `Keyworder`.

## Managing Your Keywords

Keywords are managed entirely within the plugin — no external tools or file transfers needed.

### Adding a keyword

1. Open Keyworder and tap **Manage** in the header.
2. Tap **+ Add**, type your keyword, and optionally add a short key such as `course`, `topic`, or `status`. The add panel previews the saved value before you confirm.
3. The keyword is saved immediately and will be there the next time you open the plugin. If a key is present, Keyworder inserts it as `key:value`.

### Pinning a keyword

In the Manage screen, tap the **pin icon** next to any keyword to move it to the Pinned section at the top of the list for quick access.

### Deleting a keyword

In the Manage screen, tap the **delete icon** next to the keyword you want to remove.

### Bulk importing keywords

You can import a large list of keywords at once by dropping a JSON file onto your device:

1. Build your keyword list using the **[Keyword Builder web tool](https://taoist22.github.io/sn-keyworder/keyword-tool.html)** and download the generated `keywords.json`, or create one manually:
   ```json
   ["TODO:", "REVIEW:", "URGENT", "SOC297", "ENG102"]
   ```
   You can also import structured keywords:
   ```json
   [
     {"key": "status", "label": "TODO"},
     {"key": "course", "label": "SOC297"},
     {"key": "topic", "label": "field notes"}
   ]
   ```
2. Connect your Supernote via Browse & Access and copy `keywords.json` to:
   ```
   MyStyle/SnKeyworder/keywords.json
   ```
   The `SnKeyworder` folder is created automatically the first time you tap Import.
3. Open Keyworder, tap **Manage**, then tap **Import**.
4. New keywords are merged in — any matching `key:value` combination already in your list is skipped.

## Usage

### Inserting keywords onto a page

1. Open a note and tap the **plugin icon** in the toolbar.
2. Tap one or more keywords to check them. Use **All**, **Pinned**, or key filters to narrow the list. **Select Filter** appears only after you choose **Pinned** or a key filter.
3. Tap **Insert**. Each keyword is stamped onto the page as a separate element in wrapped rows near the bottom — use lasso to move individual keywords to your desired locations. All inserted keywords are also added to the native keyword navigation index. Structured keywords are inserted and indexed as `key:value`, with no space after the colon.

> **Moving individual keywords:** Inserted keywords are separate text boxes, but Supernote's lasso selection area is not always tight to the visible word. When moving a single keyword, draw the lasso carefully around only that keyword; nearby keywords may be selected too if the boxes are close together.

### Adding a keyword by lassoing text

You can add a word or phrase to your keyword list directly from the page without opening the main panel:

1. Use lasso to select handwritten strokes or a typed text box containing the text you want to save as a keyword.
2. Tap the **Keyworder** button in the lasso toolbar. For handwriting, the plugin will recognise the text automatically.
3. Review or edit the pre-filled text in the **Add as Keyword** panel, then tap **Add**.
4. The keyword is saved to your list and registered in the native keyword index for the current page. The plugin returns to the main keyword panel.

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
