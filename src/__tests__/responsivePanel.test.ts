import {getPanelMetrics} from '../responsivePanel';

// These inputs are dp, as reported by `useWindowDimensions()` on device.
// An earlier version of this file passed pixel values (1920 x 2560), which
// made the Manta look like it took the wide branch when in reality it never
// did -- the test agreed with the bug instead of catching it.
describe('getPanelMetrics', () => {
  it('keeps the Nomad panel compact and readable', () => {
    expect(getPanelMetrics(748.8, 998.4)).toEqual({
      width: 629,
      height: 779,
      isWide: false,
      columns: 2,
    });
  });

  it('uses the wider Manta layout without filling the screen', () => {
    expect(getPanelMetrics(1024, 1365.33)).toEqual({
      width: 922,
      height: 1120,
      isWide: true,
      columns: 2,
    });
  });

  it('gives the Manta a materially wider panel than the Nomad', () => {
    const nomad = getPanelMetrics(748.8, 998.4);
    const manta = getPanelMetrics(1024, 1365.33);
    expect(manta.width - nomad.width).toBeGreaterThan(200);
  });

  it('falls back to one column when the usable window is narrow', () => {
    expect(getPanelMetrics(600, 1000).columns).toBe(1);
  });
});
