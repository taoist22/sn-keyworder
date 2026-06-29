export type PanelMetrics = {
  width: number;
  height: number;
  isWide: boolean;
  columns: 1 | 2;
};

export function getPanelMetrics(
  screenWidth: number,
  screenHeight: number,
): PanelMetrics {
  const isWide = screenWidth >= 1600;
  const width = Math.round(
    isWide
      ? Math.min(1040, screenWidth * 0.72)
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
