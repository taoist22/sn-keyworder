https://github.com/user-attachments/assets/c61e4b78-69de-432d-8114-107f0b865d02

# Keyworder for Supernote

**Keyworder** is a productivity plugin for the Supernote Nomad and Manta that lets you stamp your most-used keywords onto a note page with a single tap, and automatically adds them to the device's native keyword navigation index.

> **Pre-release:** This plugin requires the Supernote beta firmware and is not yet intended for general use.

## Features

- **Multi-keyword insertion** — check any number of keywords and insert them all in one tap; each keyword lands as a separate, movable element in wrapped rows near the bottom of the page
- **Selection to add keyword** — lasso handwritten or typed text in notes, or select text in PDFs/EPUBs, then tap the Keyworder button and save it directly to your keyword list; works with OCR for handwriting
- **Native index integration** — automatically adds each keyword to the device's built-in keyword index for page navigation
- **In-plugin keyword management** — add, delete, and pin keywords directly from the plugin; changes persist automatically
- **Group-based keyword sets** — create reusable groups such as meetings, classes, projects, or assignments, then assign existing keywords to one or more groups
- **Bulk import** — use the **[Keyword Builder web tool](https://taoist22.github.io/sn-keyworder/keyword-tool.html)** to create a `keywords.json` file, then load the list onto the device
- **Pinned keywords** — keep your most-used keywords at the top of the list for zero-scroll access
- **Structured keywords** — optionally save a keyword with a short key so it inserts as `key:value` for tools such as sn-query; key capitalization is preserved for display and insertion
- **Keyword views** — filter the picker by pinned keywords or by group, then select the filtered view when you want a batch
- **Responsive Nomad and Manta layout** — larger, denser panels with compact two-column keyword lists on supported screen sizes
- **A-Z letter rail** — filter the Keyword, Manage Keywords, and Manage Groups screens by first letter using the vertical rail on the right side of the list

## Installation

1. Download `Keyworder.snplg` from the [v1.3.9-beta release](https://github.com/taoist22/sn-keyworder/releases/tag/v1.3.9-beta).
2. Connect your Supernote to your computer using the Supernote Partner app or Browse & Access.
3. Copy `Keyworder.snplg` into the `MyStyle` folder on your device.
4. On your Supernote, open a note, tap the **plugin icon** in the toolbar, go to **Manage Plugins**, tap **Add Plugin**, and select `Keyworder`.

## Managing Your Keywords And Groups

Keywords are managed entirely within the plugin — no external tools or file transfers needed.

### Adding a keyword

1. Open Keyworder and tap **Manage** in the header.
2. Tap **+ Add**, type your keyword, and optionally add a short key such as `course`, `topic`, `status`, or `ACC201`. The add panel previews the saved value before you confirm.
3. The keyword is saved immediately and will be there the next time you open the plugin. If a structured key is present, Keyworder inserts it as `key:value`.

Keys keep the capitalization you enter, so `ACC201` displays and inserts as `ACC201:keyword`. Duplicate checks are still case-insensitive.

Structured keys are different from groups:

- Use a **structured key** when you want the inserted keyword itself to include searchable metadata, such as `course:ACC201` or `status:TODO`.
- Use a **group** when you want to organize and batch-select existing keywords without changing how each keyword inserts.

### Pinning a keyword

In the Manage screen, tap the **pin icon** next to any keyword to move it to the Pinned section at the top of the list for quick access.

### Deleting a keyword

In the Manage screen, tap the **delete icon** next to the keyword you want to remove.

### Creating groups

Groups let you reuse the same keyword across different contexts without duplicating it. For example, `Ed` can belong to both `MeetingA` and `MeetingB`.

1. Open Keyworder and tap **Manage**.
2. Tap the **Groups** tab.
3. Type a group name such as `MeetingA`, `ACC201`, `Exam_1`, or `ProjectX`, then tap **+ Group**.
4. Select the group from the left side of the Groups screen.
5. The right side opens to the current members of that group. Tap **All** on the right-side letter rail to show every keyword, then tap keywords to add or remove them from the group.

When a group is selected:

- The default view shows only current group members.
- **All** toggles between current members and all available keywords.
- Letter buttons filter whichever view is currently active.
- Checked keywords are members of the selected group.

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
   Imported items may also include groups:
   ```json
   [
     {"label": "Ed", "groups": ["MeetingA", "MeetingB"]},
     {"label": "Quiz 1", "groups": ["ACC201", "Assignments"]},
     {"key": "status", "label": "TODO", "groups": ["Assignments"]}
   ]
   ```
2. Connect your Supernote via Browse & Access and copy `keywords.json` to:
   ```
   MyStyle/SnKeyworder/keywords.json
   ```
   The `SnKeyworder` folder is created automatically the first time you tap Import.
3. Open Keyworder, tap **Manage**, then tap **Import**.
4. New keywords are merged in — any matching `key:value` combination already in your list is skipped.

The Manage screen includes the same right-side A-Z rail as the main keyword picker. Tap a letter to show only keywords beginning with that letter, or tap **All** at the top of the rail to return to the full list.

## Usage

### Inserting keywords onto a page

1. Open a note and tap the **plugin icon** in the toolbar.
2. Tap one or more keywords to check them. Use **All**, **Pinned**, group filters, or the right-side A-Z rail to narrow the list. **Select Pinned** or **Select Group** appears only after you choose a filtered view.
3. Tap **Insert**. Each keyword is stamped onto the page as a separate element in wrapped rows near the bottom — use lasso to move individual keywords to your desired locations. All inserted keywords are also added to the native keyword navigation index. Structured keywords are inserted and indexed as `key:value`, with no space after the colon.

Keyworder adjusts the insert location for Nomad and Manta screen dimensions, including synced notes created on the other device, so visible text should remain on-page while still being indexed in the native keyword navigation pane.

> **Moving individual keywords:** Inserted keywords are separate text boxes, but Supernote's lasso selection area is not always tight to the visible word. When moving a single keyword, draw the lasso carefully around only that keyword; nearby keywords may be selected too if the boxes are close together.

### Adding a keyword from selected text

You can add a word or phrase to your keyword list directly from the page or document without opening the main panel:

1. In a note, use lasso to select handwritten strokes or a typed text box containing the text you want to save as a keyword. In a PDF or EPUB, select document text.
2. Tap the **Keyworder** button in the lasso or text-selection toolbar. For handwriting, the plugin will recognise the text automatically.
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
