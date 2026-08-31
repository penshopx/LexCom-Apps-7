import { describe, expect, it } from 'vitest';
import {
  calculateBphtb,
  calculatePesangon,
  getServiceAwardBaseMonths,
  getSeveranceBaseMonths,
  MAX_BPHTB_RATE_PERCENT,
} from './legalCalculators';

describe('pesangon tenure bands', () => {
  it.each([
    [0, 1, 0],
    [2.99, 3, 0],
    [3, 4, 2],
    [7.99, 8, 3],
    [8, 9, 3],
    [24, 9, 10],
  ])(
    'uses the correct base months at %s years',
    (years, severanceMonths, serviceAwardMonths) => {
      expect(getSeveranceBaseMonths(years)).toBe(severanceMonths);
      expect(getServiceAwardBaseMonths(years)).toBe(serviceAwardMonths);
    },
  );
});

describe('pesangon termination reasons', () => {
  const salary = 5_000_000;
  const years = 5;

  it('uses 1x severance and 1x UPMK for the scoped company PHK option', () => {
    expect(calculatePesangon(salary, years, 'company_standard')).toEqual({
      severance: 30_000_000,
      serviceAward: 10_000_000,
      total: 40_000_000,
      severanceMultiplier: 1,
      serviceAwardMultiplier: 1,
    });
  });

  it('does not include severance or UPMK for resignation', () => {
    expect(calculatePesangon(salary, years, 'resign')).toEqual({
      severance: 0,
      serviceAward: 0,
      total: 0,
      severanceMultiplier: 0,
      serviceAwardMultiplier: 0,
    });
  });

  it('uses 0.5x severance and 1x UPMK for a force-majeure closure', () => {
    expect(calculatePesangon(salary, years, 'force_majeure')).toEqual({
      severance: 15_000_000,
      serviceAward: 10_000_000,
      total: 25_000_000,
      severanceMultiplier: 0.5,
      serviceAwardMultiplier: 1,
    });
  });
});

describe('regional BPHTB', () => {
  it('uses the NPOPTKP and tariff supplied for the region', () => {
    expect(calculateBphtb(500_000_000, 80_000_000, 5).bphtb).toBe(21_000_000);
    expect(calculateBphtb(500_000_000, 100_000_000, 4).bphtb).toBe(
      16_000_000,
    );
    expect(calculateBphtb(500_000_000, 80_000_000, 4.5).bphtb).toBe(
      18_900_000,
    );
  });

  it('never creates a negative taxable base', () => {
    expect(calculateBphtb(70_000_000, 80_000_000, 5)).toEqual({
      taxableAcquisitionValue: 0,
      bphtb: 0,
    });
  });

  it('accepts the statutory tariff boundaries', () => {
    expect(calculateBphtb(500_000_000, 80_000_000, 0).bphtb).toBe(0);
    expect(
      calculateBphtb(
        500_000_000,
        80_000_000,
        MAX_BPHTB_RATE_PERCENT,
      ).bphtb,
    ).toBe(21_000_000);
  });

  it('rejects a tariff outside the statutory range', () => {
    expect(() => calculateBphtb(500_000_000, 80_000_000, -0.01)).toThrow(
      RangeError,
    );
    expect(() => calculateBphtb(500_000_000, 80_000_000, 5.01)).toThrow(
      RangeError,
    );
  });
});