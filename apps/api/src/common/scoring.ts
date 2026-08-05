export interface ScoredRating {
  questionId: string;
  weight: number;
  rating: number;
}

export function weightedScore(ratings: ScoredRating[]): number | null {
  if (!ratings.length) return null;
  const byQuestion = new Map<string, { weight: number; ratings: number[] }>();
  for (const item of ratings) {
    const current = byQuestion.get(item.questionId) ?? { weight: item.weight, ratings: [] };
    current.ratings.push(item.rating);
    byQuestion.set(item.questionId, current);
  }
  let weightedTotal = 0;
  let totalWeight = 0;
  for (const { weight, ratings: values } of byQuestion.values()) {
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    weightedTotal += average * weight;
    totalWeight += weight;
  }
  return totalWeight ? Number((weightedTotal / totalWeight).toFixed(2)) : null;
}
