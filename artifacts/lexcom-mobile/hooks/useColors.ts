import colors from '@/constants/colors';

/**
 * Returns the LexCom dark design tokens.
 * LexCom is a dark-first app — the dark palette is always used.
 */
export function useColors() {
  return { ...colors.dark, radius: colors.radius };
}
