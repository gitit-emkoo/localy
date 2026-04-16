import type { ResultCardDetail } from '@/src/features/resultCard/resultCard';

function patchSubmissionItem(
  item: ResultCardDetail['itemA'],
  submissionId: string,
): ResultCardDetail['itemA'] {
  if (item.submissionId !== submissionId) return item;
  const nextMyLike = !item.myLike;
  const delta = nextMyLike ? 1 : -1;
  return {
    ...item,
    myLike: nextMyLike,
    likeCount: Math.max(0, item.likeCount + delta),
  };
}

/** Toggle like on the matching item (A or B). Caller runs after duplicate-tap guard. */
export function applyOptimisticSubmissionLike(
  detail: ResultCardDetail,
  submissionId: string,
): ResultCardDetail {
  return {
    ...detail,
    itemA: patchSubmissionItem(detail.itemA, submissionId),
    itemB: patchSubmissionItem(detail.itemB, submissionId),
  };
}

export function applyOptimisticSaved(detail: ResultCardDetail, nextSaved: boolean): ResultCardDetail {
  return {
    ...detail,
    viewerState: { ...detail.viewerState, isSaved: nextSaved },
  };
}

/**
 * Updates expression summary when the viewer changes their pick.
 * Mirrors server upsert: one reaction per user per card; switching moves one count from old key to new key.
 */
export function applyOptimisticExpression(
  detail: ResultCardDetail,
  newKey: string,
  newText: string,
): ResultCardDetail {
  const prevKey = detail.viewerState.myExpressionReaction;
  if (prevKey === newKey) {
    return {
      ...detail,
      viewerState: { ...detail.viewerState, myExpressionReaction: newKey },
    };
  }

  const map = new Map<string, { expressionKey: string; expressionText: string; count: number }>();
  for (const row of detail.expressionSummary) {
    map.set(row.expressionKey, { ...row });
  }

  const dec = (k: string) => {
    const cur = map.get(k);
    if (!cur) return;
    cur.count -= 1;
    if (cur.count <= 0) map.delete(k);
  };

  const inc = (k: string, text: string) => {
    const cur = map.get(k);
    if (cur) {
      cur.count += 1;
    } else {
      map.set(k, { expressionKey: k, expressionText: text, count: 1 });
    }
  };

  if (prevKey) dec(prevKey);
  inc(newKey, newText);

  return {
    ...detail,
    expressionSummary: Array.from(map.values()).sort((a, b) => b.count - a.count),
    viewerState: { ...detail.viewerState, myExpressionReaction: newKey },
  };
}
