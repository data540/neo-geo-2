export function calculateSOV(ownMentions: number, competitorMentions: number): number | null {
  const total = ownMentions + competitorMentions;
  if (total === 0) return null;
  return Math.round((ownMentions / total) * 1000) / 10;
}

export function calculateConsistency(runsWithMention: number, totalValidRuns: number): number {
  if (totalValidRuns === 0) return 0;
  return Math.round((runsWithMention / totalValidRuns) * 1000) / 10;
}

export function calculateBrandConsistencyGlobal(
  promptsWithConsistency: Array<{ consistency: number }>
): number {
  const total = promptsWithConsistency.length;
  if (total === 0) return 0;
  const highConsistency = promptsWithConsistency.filter((p) => p.consistency >= 70).length;
  return Math.round((highConsistency / total) * 1000) / 10;
}

export function calculateAvgPosition(positions: Array<number | null>): number | null {
  const valid = positions.filter((p): p is number => p !== null);
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}
