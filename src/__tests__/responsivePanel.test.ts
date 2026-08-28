import {getPanelMetrics} from '../responsivePanel';

describe('getPanelMetrics', () => {
  it('keeps the Nomad panel compact and readable', () => {
    expect(getPanelMetrics(1404, 1872)).toEqual({
      width: 640,
      height: 900,
      isWide: false,
      columns: 2,
    });
  });

  it('uses the wider Manta layout without filling the screen', () => {
    expect(getPanelMetrics(1920, 2560)).toEqual({
      width: 1040,
      height: 1180,
      isWide: true,
      columns: 2,
    });
  });

  it('falls back to one column when the usable window is narrow', () => {
    expect(getPanelMetrics(600, 1000).columns).toBe(1);
  });
});
