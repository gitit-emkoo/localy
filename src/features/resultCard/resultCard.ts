import { supabase } from '@/src/lib/supabase/client';

export type ResultCardDetail = {
  id: string;
  status: 'locked' | 'open';
  missionTitle: string;
  missionCategoryKey: string;
  compareLine: string | null;
  itemA: {
    submissionId: string;
    userId: string;
    nickname: string;
    countryCode: string;
    countryName: string;
    age: number | null;
    shortBio: string;
    photoUrl: string;
    captionOriginal: string;
    likeCount: number;
    myLike: boolean;
  };
  itemB: {
    submissionId: string;
    userId: string;
    nickname: string;
    countryCode: string;
    countryName: string;
    age: number | null;
    shortBio: string;
    photoUrl: string;
    captionOriginal: string;
    likeCount: number;
    myLike: boolean;
  };
  expressionSummary: Array<{ expressionKey: string; expressionText: string; count: number }>;
  viewerState: {
    myExpressionReaction: string | null;
    isSaved: boolean;
    /** 내 제출이 포함된 결과 카드 — 저장 불가; 표현 선택만 제한 */
    isOwnResultCard: boolean;
  };
};

export async function getMyProfileId() {
  const { data: auth } = await supabase.auth.getUser();
  const authUserId = auth.user?.id;
  if (!authUserId) return null;

  const meRes = await supabase
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (meRes.error || !meRes.data) return null;
  return String(meRes.data.id);
}

async function toSignedUrl(path: string): Promise<string> {
  const signed = await supabase.storage.from('mission-photos').createSignedUrl(path, 60 * 60);
  if (signed.error || !signed.data?.signedUrl) {
    return '';
  }
  return signed.data.signedUrl;
}

export async function fetchResultCardDetail(resultCardId: string): Promise<{ data: ResultCardDetail | null; error: Error | null }> {
  const meId = await getMyProfileId();
  if (!meId) return { data: null, error: new Error('not_signed_in') };

  const cardRes = await supabase
    .from('result_cards')
    .select('id, status, mission_id, compare_line, submission_a_id, submission_b_id')
    .eq('id', resultCardId)
    .maybeSingle();
  if (cardRes.error || !cardRes.data) {
    return { data: null, error: new Error(cardRes.error?.message ?? 'card_not_found') };
  }

  const card = cardRes.data as {
    id: string;
    status: 'locked' | 'open';
    mission_id: string;
    compare_line: string | null;
    submission_a_id: string;
    submission_b_id: string;
  };

  const missionRes = await supabase
    .from('missions')
    .select('title, category_key')
    .eq('id', card.mission_id)
    .maybeSingle();
  if (missionRes.error || !missionRes.data) {
    return { data: null, error: new Error('mission_not_found') };
  }

  const subRes = await supabase
    .from('submissions')
    .select('id, user_id, photo_url, caption_original')
    .in('id', [card.submission_a_id, card.submission_b_id]);
  if (subRes.error || !subRes.data || subRes.data.length < 2) {
    return { data: null, error: new Error(subRes.error?.message ?? 'submissions_not_found') };
  }

  const sA = subRes.data.find((s) => s.id === card.submission_a_id);
  const sB = subRes.data.find((s) => s.id === card.submission_b_id);
  if (!sA || !sB) return { data: null, error: new Error('invalid_submission_pair') };

  const profileRes = await supabase
    .from('user_profiles')
    .select('id, nickname, country_code, country_name, age, short_bio')
    .in('id', [sA.user_id, sB.user_id]);
  if (profileRes.error || !profileRes.data || profileRes.data.length < 2) {
    return { data: null, error: new Error(profileRes.error?.message ?? 'profiles_not_found') };
  }

  const pA = profileRes.data.find((p) => p.id === sA.user_id);
  const pB = profileRes.data.find((p) => p.id === sB.user_id);
  if (!pA || !pB) return { data: null, error: new Error('invalid_profile_pair') };

  const [photoA, photoB] = await Promise.all([toSignedUrl(sA.photo_url), toSignedUrl(sB.photo_url)]);

  const likesRes = await supabase
    .from('submission_likes')
    .select('submission_id, user_id')
    .in('submission_id', [card.submission_a_id, card.submission_b_id]);
  if (likesRes.error) {
    return { data: null, error: new Error(likesRes.error.message) };
  }

  let likeCountA = 0;
  let likeCountB = 0;
  let myLikeA = false;
  let myLikeB = false;
  for (const row of likesRes.data ?? []) {
    const sid = String(row.submission_id);
    const uid = String(row.user_id);
    if (sid === card.submission_a_id) {
      likeCountA += 1;
      if (uid === meId) myLikeA = true;
    } else if (sid === card.submission_b_id) {
      likeCountB += 1;
      if (uid === meId) myLikeB = true;
    }
  }

  const exprRes = await supabase
    .from('card_expression_reactions')
    .select('user_id, expression_key, expression_text')
    .eq('result_card_id', card.id);
  if (exprRes.error) {
    return { data: null, error: new Error(exprRes.error.message) };
  }

  const exprMap = new Map<string, { expressionKey: string; expressionText: string; count: number }>();
  let myExpressionReaction: string | null = null;
  for (const r of exprRes.data ?? []) {
    const key = String(r.expression_key);
    const text = String(r.expression_text);
    const cur = exprMap.get(key);
    if (cur) {
      cur.count += 1;
    } else {
      exprMap.set(key, { expressionKey: key, expressionText: text, count: 1 });
    }
    if (String(r.user_id) === meId) myExpressionReaction = key;
  }

  const savedRes = await supabase
    .from('saved_cards')
    .select('id')
    .eq('result_card_id', card.id)
    .eq('user_id', meId)
    .maybeSingle();
  const isSaved = Boolean(savedRes.data?.id);
  const isOwnResultCard = meId === String(pA.id) || meId === String(pB.id);

  return {
    data: {
      id: card.id,
      status: card.status,
      missionTitle: String(missionRes.data.title),
      missionCategoryKey: String(missionRes.data.category_key),
      compareLine: card.compare_line,
      itemA: {
        submissionId: String(sA.id),
        userId: String(pA.id),
        nickname: String(pA.nickname),
        countryCode: String(pA.country_code),
        countryName: String(pA.country_name),
        age: typeof pA.age === 'number' ? pA.age : null,
        shortBio: String(pA.short_bio),
        photoUrl: photoA,
        captionOriginal: String(sA.caption_original),
        likeCount: likeCountA,
        myLike: myLikeA,
      },
      itemB: {
        submissionId: String(sB.id),
        userId: String(pB.id),
        nickname: String(pB.nickname),
        countryCode: String(pB.country_code),
        countryName: String(pB.country_name),
        age: typeof pB.age === 'number' ? pB.age : null,
        shortBio: String(pB.short_bio),
        photoUrl: photoB,
        captionOriginal: String(sB.caption_original),
        likeCount: likeCountB,
        myLike: myLikeB,
      },
      expressionSummary: Array.from(exprMap.values()).sort((a, b) => b.count - a.count),
      viewerState: {
        myExpressionReaction,
        isSaved,
        isOwnResultCard,
      },
    },
    error: null,
  };
}

export async function toggleSubmissionLike(submissionId: string): Promise<{ error: Error | null }> {
  const meId = await getMyProfileId();
  if (!meId) return { error: new Error('not_signed_in') };

  const existing = await supabase
    .from('submission_likes')
    .select('id')
    .eq('submission_id', submissionId)
    .eq('user_id', meId)
    .maybeSingle();
  if (existing.error) return { error: new Error(existing.error.message) };

  if (existing.data?.id) {
    const del = await supabase.from('submission_likes').delete().eq('id', existing.data.id);
    return { error: del.error ? new Error(del.error.message) : null };
  }

  const ins = await supabase.from('submission_likes').insert({
    submission_id: submissionId,
    user_id: meId,
  });
  return { error: ins.error ? new Error(ins.error.message) : null };
}

export async function setExpressionReaction(input: { resultCardId: string; expressionKey: string; expressionText: string }) {
  const meId = await getMyProfileId();
  if (!meId) return { error: new Error('not_signed_in') } as const;

  const isParticipant = await viewerIsParticipantInResultCard(input.resultCardId, meId);
  if (isParticipant) {
    return { error: new Error('own_result_card') } as const;
  }

  const up = await supabase.from('card_expression_reactions').upsert(
    {
      result_card_id: input.resultCardId,
      user_id: meId,
      expression_key: input.expressionKey,
      expression_text: input.expressionText,
    },
    { onConflict: 'result_card_id,user_id' },
  );

  return { error: up.error ? new Error(up.error.message) : null } as const;
}

async function viewerIsParticipantInResultCard(resultCardId: string, meId: string): Promise<boolean> {
  const cardRes = await supabase
    .from('result_cards')
    .select('submission_a_id, submission_b_id')
    .eq('id', resultCardId)
    .maybeSingle();
  if (!cardRes.data) return false;
  const a = cardRes.data.submission_a_id as string;
  const b = cardRes.data.submission_b_id as string;
  const subRes = await supabase.from('submissions').select('user_id').in('id', [a, b]);
  if (subRes.error || !subRes.data?.length) return false;
  return subRes.data.some((s) => String(s.user_id) === meId);
}

export async function toggleSavedCard(resultCardId: string) {
  const meId = await getMyProfileId();
  if (!meId) return { error: new Error('not_signed_in'), saved: null } as const;

  const cur = await supabase
    .from('saved_cards')
    .select('id')
    .eq('result_card_id', resultCardId)
    .eq('user_id', meId)
    .maybeSingle();
  if (cur.error) return { error: new Error(cur.error.message), saved: null } as const;

  if (cur.data?.id) {
    const del = await supabase.from('saved_cards').delete().eq('id', cur.data.id);
    return { error: del.error ? new Error(del.error.message) : null, saved: false } as const;
  }

  const isOwn = await viewerIsParticipantInResultCard(resultCardId, meId);
  if (isOwn) {
    return { error: new Error('own_result_card'), saved: null } as const;
  }

  const ins = await supabase.from('saved_cards').insert({
    user_id: meId,
    result_card_id: resultCardId,
  });
  return { error: ins.error ? new Error(ins.error.message) : null, saved: true } as const;
}
