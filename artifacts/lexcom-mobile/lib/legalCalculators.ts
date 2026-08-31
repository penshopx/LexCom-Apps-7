export type TerminationReason = 'company_standard' | 'resign' | 'force_majeure';

export const TERMINATION_REASONS: TerminationReason[] = [
  'company_standard',
  'resign',
  'force_majeure',
];

export const TERMINATION_RULES: Record<
  TerminationReason,
  {
    label: string;
    severanceMultiplier: number;
    serviceAwardMultiplier: number;
    explanation: string;
  }
> = {
  company_standard: {
    label: 'PHK perusahaan (1×)',
    severanceMultiplier: 1,
    serviceAwardMultiplier: 1,
    explanation:
      'Gunakan hanya jika alasan PHK memberi hak 1× pesangon dan 1× UPMK. Alasan PHK lain dapat memiliki koefisien berbeda.',
  },
  resign: {
    label: 'Resign',
    severanceMultiplier: 0,
    serviceAwardMultiplier: 0,
    explanation:
      'Resign: umumnya tidak mendapat pesangon atau UPMK; cek uang penggantian hak dan uang pisah sesuai perjanjian kerja.',
  },
  force_majeure: {
    label: 'Force majeure (tutup)',
    severanceMultiplier: 0.5,
    serviceAwardMultiplier: 1,
    explanation:
      'Perusahaan tutup karena force majeure: pesangon 0,5× dan UPMK 1× sesuai PP 35/2021.',
  },
};

export const MAX_BPHTB_RATE_PERCENT = 5;

export function getSeveranceBaseMonths(yearsOfService: number): number {
  if (yearsOfService < 1) return 1;
  if (yearsOfService < 2) return 2;
  if (yearsOfService < 3) return 3;
  if (yearsOfService < 4) return 4;
  if (yearsOfService < 5) return 5;
  if (yearsOfService < 6) return 6;
  if (yearsOfService < 7) return 7;
  if (yearsOfService < 8) return 8;
  return 9;
}

export function getServiceAwardBaseMonths(yearsOfService: number): number {
  if (yearsOfService < 3) return 0;
  if (yearsOfService < 6) return 2;
  if (yearsOfService < 9) return 3;
  if (yearsOfService < 12) return 4;
  if (yearsOfService < 15) return 5;
  if (yearsOfService < 18) return 6;
  if (yearsOfService < 21) return 7;
  if (yearsOfService < 24) return 8;
  return 10;
}

export function calculatePesangon(
  monthlySalary: number,
  yearsOfService: number,
  reason: TerminationReason,
) {
  const rule = TERMINATION_RULES[reason];
  const severance =
    monthlySalary *
    getSeveranceBaseMonths(yearsOfService) *
    rule.severanceMultiplier;
  const serviceAward =
    monthlySalary *
    getServiceAwardBaseMonths(yearsOfService) *
    rule.serviceAwardMultiplier;

  return {
    severance,
    serviceAward,
    total: severance + serviceAward,
    severanceMultiplier: rule.severanceMultiplier,
    serviceAwardMultiplier: rule.serviceAwardMultiplier,
  };
}

export function calculateBphtb(
  acquisitionValue: number,
  regionalNpoptkp: number,
  regionalRatePercent: number,
) {
  if (
    regionalRatePercent < 0 ||
    regionalRatePercent > MAX_BPHTB_RATE_PERCENT
  ) {
    throw new RangeError(
      `Tarif BPHTB harus antara 0% dan ${MAX_BPHTB_RATE_PERCENT}%`,
    );
  }

  const taxableAcquisitionValue = Math.max(
    0,
    acquisitionValue - regionalNpoptkp,
  );

  return {
    taxableAcquisitionValue,
    bphtb: taxableAcquisitionValue * (regionalRatePercent / 100),
  };
}