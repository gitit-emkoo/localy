export type ExpressionOption = {
  key: string;
  textKey: string;
};

const COMMON: ExpressionOption[] = [
  { key: 'want_to_visit', textKey: 'resultCard.expression.want_to_visit' },
  { key: 'similar', textKey: 'resultCard.expression.similar' },
  { key: 'nice_vibe', textKey: 'resultCard.expression.nice_vibe' },
];

export const EXPRESSIONS_BY_CATEGORY: Record<string, ExpressionOption[]> = {
  place: COMMON,
  food: [
    { key: 'looks_tasty', textKey: 'resultCard.expression.looks_tasty' },
    { key: 'want_to_try', textKey: 'resultCard.expression.want_to_try' },
    { key: 'similar', textKey: 'resultCard.expression.similar' },
  ],
  daily_life: COMMON,
  emotion: [
    { key: 'relaxing', textKey: 'resultCard.expression.relaxing' },
    { key: 'similar', textKey: 'resultCard.expression.similar' },
    { key: 'nice_vibe', textKey: 'resultCard.expression.nice_vibe' },
  ],
  study: COMMON,
  daily_spending: COMMON,
  fashion: COMMON,
};

export function getExpressionOptions(categoryKey: string): ExpressionOption[] {
  return EXPRESSIONS_BY_CATEGORY[categoryKey] ?? COMMON;
}
