import {getPanelMetrics} from '../responsivePanel';

// These inputs are dp, as reported by `useWindowDimensions()` on device.
// An earlier version of this file passed pixel values (1920 x 2560), which
// made the Manta look like it took the wide branch when in reality it never
// did -- the test agreed with the bug instead of catching it.
const NOMAD = [748.8, 998.4] as const;
const MANTA = [1024, 1365.33] as const;

describe('getPanelMetrics', () => {
  it('keeps the Nomad panel compact and readable', () => {
    expect(getPanelMetrics(...NOMAD)).toEqual({
      width: 629,
      height: 779,
      isWide: false,
      columns: 1,
    });
  });

  it('uses the wider Manta layout without filling the screen', () => {
    expect(getPanelMetrics(...MANTA)).toEqual({
      width: 922,
      height: 1120,
      isWide: true,
      columns: 2,
    });
  });

  it('gives the Manta a materially wider panel than the Nomad', () => {
    expect(
      getPanelMetrics(...MANTA).width - getPanelMetrics(...NOMAD).width,
    ).toBeGreaterThan(200);
  });

  it('drops the Nomad to one column rather than starving the label', () => {
    // Two columns on a 629dp panel left ~115dp for the keyword name.
    expect(getPanelMetrics(...NOMAD).columns).toBe(1);
    expect(getPanelMetrics(...MANTA).columns).toBe(2);
  });

  it('falls back to one column when the usable window is narrow', () => {
    expect(getPanelMetrics(600, 1000).columns).toBe(1);
  });
});
