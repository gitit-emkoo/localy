export type ExpressionOption = {
  key: string;
  textKey: string;
  emoji: string;
};

/** 고정 순서 (집계 동률 시 보조 정렬에도 사용). 미션 카테고리와 무관하게 동일 7개. */
export const EXPRESSION_OPTIONS_ORDERED: ExpressionOption[] = [
  { key: 'mood_nice', emoji: '✨', textKey: 'resultCard.expression.mood_nice' },
  { key: 'similar_to_us', emoji: '🙌', textKey: 'resultCard.expression.similar_to_us' },
  { key: 'surprisingly_different', emoji: '😮', textKey: 'resultCard.expression.surprisingly_different' },
  { key: 'fun_side_by_side', emoji: '😄', textKey: 'resultCard.expression.fun_side_by_side' },
  { key: 'best_combo', emoji: '🏆', textKey: 'resultCard.expression.best_combo' },
  { key: 'want_visit', emoji: '✈️', textKey: 'resultCard.expression.want_visit' },
  { key: 'want_taste', emoji: '😋', textKey: 'resultCard.expression.want_taste' },
];

export function getExpressionOptions(_categoryKey: string): ExpressionOption[] {
  return EXPRESSION_OPTIONS_ORDERED;
}

/**
 * B 방식: 접힘 = 집계 상위 3개(동률 시 고정 순서), 펼침 = 전체 7개(고정 순서).
 */
export function getVisibleExpressionOptions(
  all: ExpressionOption[],
  countMap: Map<string, number>,
  expanded: boolean,
): ExpressionOption[] {
  const enriched = all.map((opt, index) => ({
    opt,
    count: countMap.get(opt.key) ?? 0,
    index,
  }));
  if (expanded) {
    return enriched.map((e) => e.opt);
  }
  return enriched
    .slice()
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.index - b.index;
    })
    .slice(0, 3)
    .map((e) => e.opt);
}
