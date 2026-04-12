import { supabase } from '@/src/lib/supabase/client';

export type MyActivitySummary = {
  joinedMissionCount: number;
  receivedReactionCount: number;
  sentExpressionCount: number;
};

function countOrZero(value: number | null): number {
  return typeof value === 'number' ? value : 0;
}

export async function loadMyActivitySummary(profileId: string): Promise<{
  data: MyActivitySummary | null;
  error: Error | null;
}> {
  const joinedRes = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profileId)
    .eq('status', 'submitted');

  if (joinedRes.error) {
    return { data: null, error: new Error(joinedRes.error.message) };
  }

  const mySubmissionRes = await supabase
    .from('submissions')
    .select('id')
    .eq('user_id', profileId)
    .eq('status', 'submitted');

  if (mySubmissionRes.error) {
    return { data: null, error: new Error(mySubmissionRes.error.message) };
  }

  const mySubmissionIds = (mySubmissionRes.data ?? []).map((r) => String(r.id));
  let myCardIds: string[] = [];
  if (mySubmissionIds.length > 0) {
    const [cardsA, cardsB] = await Promise.all([
      supabase.from('result_cards').select('id').in('submission_a_id', mySubmissionIds),
      supabase.from('result_cards').select('id').in('submission_b_id', mySubmissionIds),
    ]);
    if (cardsA.error) {
      return { data: null, error: new Error(cardsA.error.message) };
    }
    if (cardsB.error) {
      return { data: null, error: new Error(cardsB.error.message) };
    }
    const merged = new Set<string>();
    for (const row of cardsA.data ?? []) merged.add(String(row.id));
    for (const row of cardsB.data ?? []) merged.add(String(row.id));
    myCardIds = Array.from(merged);
  }

  let receivedReactionCount = 0;
  if (myCardIds.length > 0) {
    const [iconRes, exprRes] = await Promise.all([
      supabase
        .from('card_icon_reactions')
        .select('id', { count: 'exact', head: true })
        .in('result_card_id', myCardIds)
        .neq('user_id', profileId),
      supabase
        .from('card_expression_reactions')
        .select('id', { count: 'exact', head: true })
        .in('result_card_id', myCardIds)
        .neq('user_id', profileId),
    ]);
    if (iconRes.error) return { data: null, error: new Error(iconRes.error.message) };
    if (exprRes.error) return { data: null, error: new Error(exprRes.error.message) };
    receivedReactionCount = countOrZero(iconRes.count) + countOrZero(exprRes.count);
  }

  const sentExprRes = await supabase
    .from('card_expression_reactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profileId);
  if (sentExprRes.error) {
    return { data: null, error: new Error(sentExprRes.error.message) };
  }

  return {
    data: {
      joinedMissionCount: countOrZero(joinedRes.count),
      receivedReactionCount,
      sentExpressionCount: countOrZero(sentExprRes.count),
    },
    error: null,
  };
}

