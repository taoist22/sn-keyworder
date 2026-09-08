https://github.com/user-attachments/assets/c61e4b78-69de-432d-8114-107f0b865d02

# Keyworder for Supernote

**Keyworder** is a productivity plugin for the Supernote Nomad and Manta that lets you stamp your most-used keywords onto a note page with a single tap, and automatically adds them to the device's native keyword navigation index.

> **Pre-release:** This plugin requires the Supernote beta firmware and is not yet intended for general use.

## Features

- **Tap to place a batch** — select keywords, press Insert, then tap the note once to place them as separate, movable elements in wrapped rows
- **Duplicate review before placement** — skip keywords already indexed on the page, place their labels again without duplicate index entries, or cancel
- **Selection to add keyword** — lasso handwritten or typed text in notes, or select text in PDFs/EPUBs, then tap the Keyworder button and save it directly to your keyword list; works with OCR for handwriting
- **Native index integration** — automatically adds each keyword to the device's built-in keyword index for page navigation
- **In-plugin keyword management** — add, delete, and pin keywords directly from the plugin; changes persist automatically
- **Group-based keyword sets** — create reusable groups such as meetings, classes, projects, or assignments, then assign existing keywords to one or more groups
- **Bulk import** — use the **[Keyword Builder web tool](https://taoist22.github.io/sn-keyworder/keyword-tool.html)** to create a `keywords.json` file, then load the list onto the device
- **Pinned keywords** — keep your most-used keywords at the top of the list for zero-scroll access
- **Structured keywords** — optionally save a keyword with a short key so it inserts as `key:value` for tools such as sn-query; key capitalization is preserved for display and insertion
- **Keyword views** — filter the picker by pinned keywords or by group, then select the filtered view when you want a batch
- **Long-press to edit** — long-press any keyword in Manage Keywords to change its text, structured key, or group membership, or to delete it
- **At-a-glance indicators** — compact `G2` and `K` badges show group membership and structured keys without crowding out the keyword name
- **Responsive Nomad and Manta layout** — the panel sizes itself to the device, and the keyword list uses two columns only when a row still has room for the keyword name: two columns on Manta, one on Nomad
- **A-Z letter rail** — filter the Keyword, Manage Keywords, and Manage Groups screens by first letter using the vertical rail on the right side of the list

## Installation

1. Download `Keyworder.snplg` from the [v1.5.0-beta release](https://github.com/taoist22/sn-keyworder/releases/tag/v1.5.0-beta).
2. Connect your Supernote to your computer using the Supernote Partner app or Browse & Access.
3. Copy `Keyworder.snplg` into the `MyStyle` folder on your device.
4. On your Supernote, open a note, tap the **plugin icon** in the toolbar, go to **Manage Plugins**, tap **Add Plugin**, and select `Keyworder`.

## Managing Your Keywords And Groups

Keywords are managed entirely within the plugin — no external tools or file transfers needed.

### Reading the keyword list

Each row in the Manage screen shows the keyword, then up to two small indicators:

| Indicator | Meaning |
| --- | --- |
| `G2` | The keyword belongs to 2 groups. The number is the group count. |
| `K` | The keyword has a structured key, so it inserts as `key:value`. |

Long-press the row to see or change the actual group names and key.

The indicators are deliberately small and fixed-width so that long keyword names stay readable. Earlier versions listed group names in full on each row, which on smaller panels could push the keyword name off the row entirely.

A keyword whose only group is a copy of its own structured key is not counted in `G`. That group is created automatically, and counting it would duplicate what `K` already tells you.

### Adding a keyword

1. Open Keyworder and tap **Manage** in the header.
2. Tap **+ Add**, type your keyword, and optionally add a short key such as `course`, `topic`, `status`, or `ACC201`. If you have groups, you can tick them here too. The add panel previews the saved value before you confirm.
3. The keyword is saved immediately and will be there the next time you open the plugin. If a structured key is present, Keyworder inserts it as `key:value`.

Keys keep the capitalization you enter, so `ACC201` displays and inserts as `ACC201:keyword`. Duplicate checks when saving keywords to your list are case-insensitive.

Structured keys are different from groups:

- Use a **structured key** when you want the inserted keyword itself to include searchable metadata, such as `course:ACC201` or `status:TODO`.
- Use a **group** when you want to organize and batch-select existing keywords without changing how each keyword inserts.

### Pinning a keyword

In the Manage screen, tap the **star** at the left of any keyword to move it to the Pinned section at the top of the list for quick access. A hollow star (☆) means unpinned, a filled star (★) means pinned. Tap it again to unpin.

### Editing a keyword

**Long-press** any keyword in the Manage screen to open its editor. From there you can:

- change the keyword text
- add, change, or clear its structured key
- tick the groups it belongs to
- delete it

Tap **✓** to save or **✕** to cancel. The editor opens as a bordered card above the list.

Group membership can be set from either direction: from a keyword's editor here, or from the **Groups** tab by selecting a group and ticking its members.

### Deleting a keyword

Long-press the keyword to open its editor, then tap **Delete keyword**.

Deleting is undoable. An **Undo** banner appears at the top of the Manage screen for about nine seconds and restores the keyword to its original position in the list.

There is deliberately no delete button on the keyword rows themselves: the rows respond to a long press, and a destructive control sitting inside a whole-row gesture is easy to trigger by accident.

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

You can also work from the other direction: long-press a keyword on the **Keywords** tab and tick its groups in the editor.

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
   Create the `SnKeyworder` folder first if it does not already exist.
3. Open Keyworder, tap **Manage**, then tap **Import**.
4. New keywords are merged in — any matching `key:value` combination already in your list is skipped.

The Manage screen includes the same right-side A-Z rail as the main keyword picker. Tap a letter to show only keywords beginning with that letter, or tap **All** at the top of the rail to return to the full list.

## Usage

### Inserting keywords onto a page

1. Open a note and tap the **plugin icon** in the toolbar.
2. Tap one or more keywords to check them. Use **All**, **Pinned**, group filters, or the right-side A-Z rail to narrow the list. **Select Pinned** or **Select Group** appears only after you choose a filtered view.
3. Tap **Insert**. Keyworder checks whether any selections are already indexed on this page. If a warning appears, choose **Skip duplicates**, **Place all**, or **Cancel**.
4. When **Tap to place · 30 seconds** appears, tap the note where the first row should begin. One tap places the whole batch; rows wrap downward. The text is aligned to the tapped line, with placement tested on Nomad and Manta.

Your current pen can remain selected: the placement overlay captures the tap without leaving a pen dot. Drags and long presses are ignored. **Cancel**, hardware **Back**, or the 30-second timeout closes placement without inserting anything.

Near page edges, the batch shifts inward to fit. Very large batches are rejected before insertion; select fewer keywords. Each label remains separately movable. New keywords are added to the native keyword navigation index; structured keywords use `key:value`, with no space after the colon.

### Reviewing duplicates

The warning lists selected keywords already in the current page’s native index:

- **Skip duplicates** places only new keywords. If none remain, Keyworder returns to the picker without asking for a tap.
- **Place all** places all selected labels but skips index entries that already exist. Confirmed duplicates do not reopen the panel with a warning after placement.
- **Cancel** returns to keyword selection without inserting anything.

The check compares indexed keyword text; it does not scan handwriting or unindexed visible text. File-read permission is required. If the check fails, nothing is placed. Actual insertion or indexing failures still display a warning.

In PDFs and EPUBs, the main picker continues to add keywords to the page index without placing visible labels or asking for a placement tap.

Keyworder adjusts the insert location for Nomad and Manta screen dimensions, including synced notes created on the other device, so visible text should remain on-page while still being indexed in the native keyword navigation pane.

> **Moving individual keywords:** Inserted keywords are separate text boxes, but Supernote's lasso selection area is not always tight to the visible word. When moving a single keyword, draw the lasso carefully around only that keyword; nearby keywords may be selected too if the boxes are close together.

### Adding a keyword from selected text

You can add a word or phrase to your keyword list directly from the page or document without opening the main panel:

1. In a note, use lasso to select handwritten strokes or a typed text box containing the text you want to save as a keyword. In a PDF or EPUB, select document text.
2. Tap the **Keyworder** button in the lasso or text-selection toolbar. For handwriting, the plugin will recognise the text automatically.
3. Review or edit the pre-filled text in the **Add as Keyword** panel, then tap **Add**.
4. The keyword is saved to your list and registered in the native keyword index for the current page. The plugin returns to the main keyword panel.

## Permissions and privacy

- **File read** is requested before insertion to check the current page’s keyword index, and when you import `MyStyle/SnKeyworder/keywords.json`. If access is denied or the check fails, insertion stops before placing anything.
- **File write** is requested when you insert visible keyword labels or add
  keywords to the current page's native keyword index.
- Keyword lists and groups are stored in Keyworder's private on-device storage.
- Keyworder makes no network requests and does not upload note content,
  handwriting, selected text, keywords, or other user data. The optional
  Keyword Builder is a separate browser tool; importing its downloaded JSON file
  is a local file operation on the Supernote.

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm
- JDK 19+ (for native Android build)

### Build

```bash
npm install
rm -rf build/generated build/outputs
JAVA_HOME=/path/to/your/jdk ANDROID_HOME=/path/to/android-sdk ./buildPlugin.sh
```

The plugin file will be generated at `build/outputs/Keyworder.snplg`. Verify the package contains `app.npk`, its config points to `/app.npk`, and `reactPackages` includes `com.reactnativecommunity.asyncstorage.AsyncStoragePackage`. A completed JavaScript bundle alone is not a valid native build.

> **Note:** The first build generates autolinking files; run the build command twice on a clean checkout to ensure `reactPackages` is correctly populated in the plugin config.

## Changelog

### Unreleased

- Fixed keyword names being truncated, or disappearing entirely, in Manage Keywords. Worst on keywords belonging to several groups; severe on Nomad.
- Panels are now sized correctly per device. The sizing calculation compared a screen width in dp against a threshold written in pixels, so no device ever matched it and the Manta was given a Nomad-sized panel.
- The keyword list now uses two columns only when a row still has room for the keyword name: two on Manta, one on Nomad.
- Group and key chips on each row replaced with compact `G{n}` and `K` indicators, so the keyword name keeps the space.
- Long-press a keyword to edit it. The editor now also sets group membership, which previously could only be done from the Groups tab.
- Delete moved off the row and into the editor, so a stray long press cannot trigger it. The Undo window is now nine seconds.
- Darkened the unpinned star, which was nearly invisible on e-ink.
- Larger, darker key and group lines beneath each keyword on the main panel.
- A group that merely duplicates a keyword's own structured key is no longer shown or counted.

### 1.5.0-beta

- Place a selected batch with one tap on the note, with wrapped rows and line alignment tested on Manta and Nomad.
- Review existing page keywords before placement: Skip duplicates, Place all, or Cancel.
- Reuse existing index entries when placing duplicate labels, avoiding the post-placement duplicate warning.
- Cancel placement with the banner, hardware Back, or timeout; reject placement if the page or orientation changes.
- Preserve index-only insertion for PDF/EPUB pages.
- Require the firmware permission bridge; check file-read access before duplicate lookup and import.

## License

[MIT](LICENSE)
