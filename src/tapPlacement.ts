export type TapPoint = {x: number; y: number};
export const LABEL_FONT_SIZE = 40;
// Keyworder device-test calibration at font size 40 (Manta and Nomad):
// DateTime's 82px offset placed labels about half an 8mm line too high.
// The first correction to 35px landed slightly below the line; try 39px
// to lift labels another 4px. This remains specific to size-40 keyword labels
// and needs on-device confirmation.
const BASELINE_OFFSET = 39;
const BOX_HEIGHT = 50;
const ROW_STRIDE = 74;
const GAP = 40;
const EDGE = 20;

export function createKeywordLayout(
  labels: string[], pageWidth: number, pageHeight: number, point: TapPoint,
) {
  if (![pageWidth, pageHeight, point.x, point.y].every(Number.isFinite) ||
      pageWidth <= EDGE * 2 || pageHeight <= EDGE * 2 ||
      point.x < 0 || point.y < 0 || point.x >= pageWidth || point.y >= pageHeight) {
    throw new Error('Tap was outside the page. Please try again.');
  }
  if (!labels.length) {return [];}
  const widths = labels.map(label => Math.min(pageWidth - EDGE * 2,
    Math.max(LABEL_FONT_SIZE * 4, Math.ceil(label.length * LABEL_FONT_SIZE * 0.8 * 1.15))));
  // Move left only as far as needed for the longest label; wrap at the edge.
  const left = Math.max(EDGE, Math.min(point.x, pageWidth - EDGE - Math.max(...widths)));
  let x = left;
  let row = 0;
  const boxes = labels.map((label, index) => {
    const width = widths[index];
    if (x > left && x + width > pageWidth - EDGE) {row++; x = left;}
    const box = {label, left: x, right: x + width, row};
    x += width + GAP;
    return box;
  });
  // Reserve space below the actual baseline too: the SDK ignores box height.
  const batchHeight = row * ROW_STRIDE + BASELINE_OFFSET + EDGE;
  if (batchHeight > pageHeight - EDGE * 2) {
    throw new Error('Too many keywords to fit on this page. Select a smaller batch.');
  }
  const top = Math.max(EDGE, Math.min(point.y - BASELINE_OFFSET, pageHeight - EDGE - batchHeight));
  return boxes.map(box => ({label: box.label,
    left: Math.round(box.left), right: Math.round(box.right),
    top: Math.round(top + box.row * ROW_STRIDE),
    bottom: Math.round(top + box.row * ROW_STRIDE + BOX_HEIGHT)}));
}
