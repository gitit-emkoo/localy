import { supabase } from '@/src/lib/supabase/client';
import { countryCodeToFlag } from '@/src/lib/countryFlag';
import {
  countryForUser,
  normalizeCountryCode,
  orderedCountryCodesForViewer,
  type TeamCountryLookup,
} from '@/src/lib/teamCountryCodes';

export type BoardSort = 'latest' | 'popular';

export type BoardCardItem = {
  id: string;
  missionTitle: string;
  photoUrl: string;
  countryCodeA: string;
  countryCodeB: string;
  /** 국기 순서(시청자 기준) UI용 */
  viewerCountryCode: string;
  flagPair: string;
  totalReactionCount: number;
  createdAt: string;
};

type ResultCardRow = {
  id: string;
  mission_id: string;
  team_id: string;
  submission_a_id: string;
  submission_b_id: string;
  total_like_count: number;
  total_expression_reaction_count: number;
  created_at: string;
};

type SubmissionRow = {
  id: string;
  user_id: string;
  photo_url: string;
};

type ProfileRow = {
  id: string;
  country_code: string;
};

function buildFlagPair(codeA: string, codeB: string, viewerCountryCode?: string): string {
  const [l, r] = orderedCountryCodesForViewer(codeA, codeB, viewerCountryCode);
  const flags = [countryCodeToFlag(l), countryCodeToFlag(r)].filter(Boolean);
  return flags.join(' × ');
}

async function toSignedUrl(path: string): Promise<string> {
  if (!path) return '';
  const signed = await supabase.storage.from('mission-photos').createSignedUrl(path, 60 * 60);
  if (signed.error || !signed.data?.signedUrl) return '';
  return signed.data.signedUrl;
}

function err(step: string, message: string) {
  return new Error(`[board:${step}] ${message}`);
}

export async function loadBoardCards(
  sort: BoardSort,
  options?: { limit?: number },
): Promise<{ data: BoardCardItem[]; error: Error | null }> {
  const limit = options?.limit ?? 30;

  const { data: authData } = await supabase.auth.getUser();
  const authUserId = authData.user?.id ?? null;
  let viewerCountryCode = '';
  if (authUserId) {
    const meRes = await supabase
      .from('user_profiles')
      .select('country_code')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (!meRes.error && meRes.data?.country_code) {
      viewerCountryCode = normalizeCountryCode(String(meRes.data.country_code));
    }
  }

  let query = supabase
    .from('result_cards')
    .select(
      'id, mission_id, team_id, submission_a_id, submission_b_id, total_like_count, total_expression_reaction_count, created_at',
    )
    .eq('status', 'open');

  if (sort === 'popular') {
    query = query
      .order('total_like_count', { ascending: false })
      .order('total_expression_reaction_count', { ascending: false })
      .order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const cardRes = await query.limit(limit);
  if (cardRes.error) return { data: [], error: err('result_cards', cardRes.error.message) };

  const cards = (cardRes.data ?? []) as ResultCardRow[];
  if (!cards.length) return { data: [], error: null };

  const missionIds = Array.from(new Set(cards.map((c) => c.mission_id)));
  const submissionIds = Array.from(new Set(cards.flatMap((c) => [c.submission_a_id, c.submission_b_id])));

  const teamIds = Array.from(new Set(cards.map((c) => c.team_id)));

  if (missionIds.length === 0 || submissionIds.length === 0 || teamIds.length === 0) {
    return { data: [], error: err('ids', 'result_cards 데이터가 비정상입니다.') };
  }

  const [missionRes, submissionRes, teamRes] = await Promise.all([
    supabase.from('missions').select('id, title').in('id', missionIds),
    supabase.from('submissions').select('id, user_id, photo_url').in('id', submissionIds),
    supabase
      .from('teams')
      .select('id, user_a_id, user_b_id, user_a_country_code, user_b_country_code')
      .in('id', teamIds),
  ]);

  if (missionRes.error) return { data: [], error: err('missions', missionRes.error.message) };
  if (submissionRes.error) return { data: [], error: err('submissions', submissionRes.error.message) };
  if (teamRes.error) return { data: [], error: err('teams', teamRes.error.message) };

  if (!submissionRes.data?.length) {
    return {
      data: [],
      error: err(
        'submissions',
        'open 결과 카드에 연결된 제출을 읽지 못했습니다. Supabase RLS(007) 적용 여부를 확인해 주세요.',
      ),
    };
  }

  const missionMap = new Map<string, string>(
    (missionRes.data ?? []).map((m) => [String(m.id), String(m.title)]),
  );

  const submissionMap = new Map<string, SubmissionRow>(
    ((submissionRes.data ?? []) as SubmissionRow[]).map((s) => [s.id, s]),
  );

  const userIds = Array.from(new Set((submissionRes.data ?? []).map((s) => String(s.user_id))));
  const profileRes =
    userIds.length > 0
      ? await supabase.from('user_profiles').select('id, country_code').in('id', userIds)
      : { data: [] as ProfileRow[], error: null };
  if (profileRes.error) return { data: [], error: err('user_profiles', profileRes.error.message) };

  const profileMap = new Map<string, ProfileRow>(
    ((profileRes.data ?? []) as ProfileRow[]).map((p) => [p.id, p]),
  );

  const teamMap = new Map<string, TeamCountryLookup>(
    ((teamRes.data ?? []) as TeamCountryLookup[]).map((t) => [String(t.id), t]),
  );

  const rows = await Promise.all(
    cards.map(async (c) => {
      const sA = submissionMap.get(c.submission_a_id);
      const sB = submissionMap.get(c.submission_b_id);
      if (!sA || !sB) return null;

      const pA = profileMap.get(String(sA.user_id));
      const pB = profileMap.get(String(sB.user_id));
      const team = teamMap.get(c.team_id);
      const ccA = countryForUser(String(sA.user_id), pA?.country_code, team);
      const ccB = countryForUser(String(sB.user_id), pB?.country_code, team);
      const photoUrl = await toSignedUrl(sA.photo_url);

      return {
        id: c.id,
        missionTitle: missionMap.get(c.mission_id) ?? '',
        photoUrl,
        countryCodeA: ccA,
        countryCodeB: ccB,
        viewerCountryCode,
        flagPair: buildFlagPair(ccA, ccB, viewerCountryCode),
        totalReactionCount: typeof c.total_like_count === 'number' ? c.total_like_count : 0,
        createdAt: c.created_at,
      } satisfies BoardCardItem;
    }),
  );

  return { data: rows.filter((r): r is BoardCardItem => Boolean(r)), error: null };
}

