export type PanelMetrics = {
  width: number;
  height: number;
  isWide: boolean;
  columns: 1 | 2;
};

// `useWindowDimensions()` reports dp, not pixels. Measured on device:
//   Manta        1024   x 1365.33 dp  (1920 x 2560 px)
//   Nomad / A5X   748.8 x  998.4  dp  (1404 x 1872 px)
// The previous threshold was written in pixels (1600), so no real device ever
// matched it: the Manta reports 1024 and was handed a Nomad-sized panel.
const WIDE_MIN_WIDTH_DP = 900;

// Both panels reserve a 30dp A-Z rail beside the list.
const ALPHA_RAIL_DP = 30;

// What one keyword row needs before its label starts starving. Pin button
// (36), the two indicators (26 each), the gaps between them (48), row padding
// (40) and two-column cell padding (8) come to ~184dp of chrome, so a usable
// label wants ~340dp of row. Below that, a second column costs more in
// truncation than it returns in density -- which is what the Nomad hit: a
// 2-column split left it ~115dp of label, and at fontScale 1.0 (against the
// Manta's 0.85) its text renders ~18% larger on top of that.
const MIN_ROW_WIDTH_DP = 340;

export function getPanelMetrics(
  screenWidth: number,
  screenHeight: number,
): PanelMetrics {
  const isWide = screenWidth >= WIDE_MIN_WIDTH_DP;
  const width = Math.round(
    isWide
      ? Math.min(960, screenWidth * 0.9)
      : Math.min(640, screenWidth * 0.84),
  );
  const height = Math.round(
    isWide
      ? Math.min(1180, screenHeight * 0.82)
      : Math.min(900, screenHeight * 0.78),
  );

  // Columns follow whether a row actually fits, not whether the panel is wide.
  const listWidth = width - ALPHA_RAIL_DP;
  const columns: 1 | 2 = listWidth >= MIN_ROW_WIDTH_DP * 2 ? 2 : 1;

  return {width, height, isWide, columns};
}
