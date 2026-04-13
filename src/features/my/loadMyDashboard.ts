import { supabase } from '@/src/lib/supabase/client';

export type MyActivitySummary = {
  joinedMissionCount: number;
  receivedReactionCount: number;
  /** 다른 사람 제출에 남긴 하트 수 */
  sentReactionCount: number;
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

  const mySubmissionRes = await supabase.from('submissions').select('id').eq('user_id', profileId).eq('status', 'submitted');

  if (mySubmissionRes.error) {
    return { data: null, error: new Error(mySubmissionRes.error.message) };
  }

  const mySubmissionIds = (mySubmissionRes.data ?? []).map((r) => String(r.id));

  let receivedReactionCount = 0;
  if (mySubmissionIds.length > 0) {
    const receivedRes = await supabase
      .from('submission_likes')
      .select('id', { count: 'exact', head: true })
      .in('submission_id', mySubmissionIds)
      .neq('user_id', profileId);
    if (receivedRes.error) return { data: null, error: new Error(receivedRes.error.message) };
    receivedReactionCount = countOrZero(receivedRes.count);
  }

  const sentRes = await supabase
    .from('submission_likes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profileId);
  if (sentRes.error) {
    return { data: null, error: new Error(sentRes.error.message) };
  }

  return {
    data: {
      joinedMissionCount: countOrZero(joinedRes.count),
      receivedReactionCount,
      sentReactionCount: countOrZero(sentRes.count),
    },
    error: null,
  };
}
