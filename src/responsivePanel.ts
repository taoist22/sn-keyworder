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

  return {
    width,
    height,
    isWide,
    columns: width >= 560 ? 2 : 1,
  };
}
