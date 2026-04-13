import { supabase } from '@/src/lib/supabase/client';
import { countryCodeToFlag } from '@/src/lib/countryFlag';
import { getMyProfileId } from '@/src/features/resultCard/resultCard';
import {
  countryForUser,
  normalizeCountryCode,
  orderedCountryCodesForViewer,
  type TeamCountryLookup,
} from '@/src/lib/teamCountryCodes';

export type MyCardItem = {
  id: string;
  missionTitle: string;
  photoUrl: string;
  countryCodeA: string;
  countryCodeB: string;
  viewerCountryCode: string;
  flagPair: string;
  reactionCount: number;
  createdAt: string;
};

type ResultCardRow = {
  id: string;
  mission_id: string;
  team_id: string;
  submission_a_id: string;
  submission_b_id: string;
  total_like_count: number;
  created_at: string;
};

type SubmissionRow = { id: string; user_id: string; photo_url: string };
type ProfileRow = { id: string; country_code: string };

async function toSignedUrl(path: string): Promise<string> {
  const signed = await supabase.storage.from('mission-photos').createSignedUrl(path, 60 * 60);
  if (signed.error || !signed.data?.signedUrl) return '';
  return signed.data.signedUrl;
}

function flagPair(a: string, b: string, viewerCountryCode?: string): string {
  const [l, r] = orderedCountryCodesForViewer(a, b, viewerCountryCode);
  return [countryCodeToFlag(l), countryCodeToFlag(r)].filter(Boolean).join(' × ');
}

async function hydrateCards(
  cards: ResultCardRow[],
  viewerCountryCode: string,
): Promise<{ data: MyCardItem[]; error: Error | null }> {
  if (!cards.length) return { data: [], error: null };

  const missionIds = Array.from(new Set(cards.map((c) => c.mission_id)));
  const teamIds = Array.from(new Set(cards.map((c) => c.team_id)));
  const submissionIds = Array.from(new Set(cards.flatMap((c) => [c.submission_a_id, c.submission_b_id])));

  const [missionRes, teamRes, submissionRes] = await Promise.all([
    supabase.from('missions').select('id, title').in('id', missionIds),
    supabase
      .from('teams')
      .select('id, user_a_id, user_b_id, user_a_country_code, user_b_country_code')
      .in('id', teamIds),
    supabase.from('submissions').select('id, user_id, photo_url').in('id', submissionIds),
  ]);
  if (missionRes.error) return { data: [], error: new Error(missionRes.error.message) };
  if (teamRes.error) return { data: [], error: new Error(teamRes.error.message) };
  if (submissionRes.error) return { data: [], error: new Error(submissionRes.error.message) };

  const submissionMap = new Map<string, SubmissionRow>(((submissionRes.data ?? []) as SubmissionRow[]).map((s) => [s.id, s]));
  const missionMap = new Map<string, string>((missionRes.data ?? []).map((m) => [String(m.id), String(m.title)]));
  const teamMap = new Map<string, TeamCountryLookup>(
    ((teamRes.data ?? []) as TeamCountryLookup[]).map((t) => [String(t.id), t]),
  );

  const userIds = Array.from(new Set(((submissionRes.data ?? []) as SubmissionRow[]).map((s) => String(s.user_id))));
  const profileRes = await supabase.from('user_profiles').select('id, country_code').in('id', userIds);
  if (profileRes.error) return { data: [], error: new Error(profileRes.error.message) };
  const profileMap = new Map<string, ProfileRow>(((profileRes.data ?? []) as ProfileRow[]).map((p) => [String(p.id), p]));

  const rows = await Promise.all(
    cards.map(async (c) => {
      const sA = submissionMap.get(c.submission_a_id);
      const sB = submissionMap.get(c.submission_b_id);
      if (!sA || !sB) return null;
      const team = teamMap.get(c.team_id);

      const ccA = countryForUser(
        String(sA.user_id),
        profileMap.get(String(sA.user_id))?.country_code,
        team,
      );
      const ccB = countryForUser(
        String(sB.user_id),
        profileMap.get(String(sB.user_id))?.country_code,
        team,
      );

      return {
        id: c.id,
        missionTitle: missionMap.get(c.mission_id) ?? '',
        photoUrl: await toSignedUrl(sA.photo_url),
        countryCodeA: ccA,
        countryCodeB: ccB,
        viewerCountryCode,
        flagPair: flagPair(ccA, ccB, viewerCountryCode),
        reactionCount: typeof c.total_like_count === 'number' ? c.total_like_count : 0,
        createdAt: c.created_at,
      } satisfies MyCardItem;
    }),
  );

  return { data: rows.filter((r): r is MyCardItem => Boolean(r)), error: null };
}

export async function loadMyResultCards(): Promise<{ data: MyCardItem[]; error: Error | null }> {
  const profileId = await getMyProfileId();
  if (!profileId) return { data: [], error: new Error('not_signed_in') };
  const meRes = await supabase.from('user_profiles').select('country_code').eq('id', profileId).maybeSingle();
  const viewerCountryCode = normalizeCountryCode(String(meRes.data?.country_code ?? ''));

  const subRes = await supabase.from('submissions').select('id').eq('user_id', profileId).eq('status', 'submitted');
  if (subRes.error) return { data: [], error: new Error(subRes.error.message) };
  const ids = (subRes.data ?? []).map((r) => String(r.id));
  if (!ids.length) return { data: [], error: null };

  const cardsRes = await supabase
    .from('result_cards')
    .select('id, mission_id, team_id, submission_a_id, submission_b_id, total_like_count, created_at')
    .or(`submission_a_id.in.(${ids.join(',')}),submission_b_id.in.(${ids.join(',')})`)
    .order('created_at', { ascending: false });
  if (cardsRes.error) return { data: [], error: new Error(cardsRes.error.message) };

  return hydrateCards((cardsRes.data ?? []) as ResultCardRow[], viewerCountryCode);
}

export async function loadSavedCards(): Promise<{ data: MyCardItem[]; error: Error | null }> {
  const profileId = await getMyProfileId();
  if (!profileId) return { data: [], error: new Error('not_signed_in') };
  const meRes = await supabase.from('user_profiles').select('country_code').eq('id', profileId).maybeSingle();
  const viewerCountryCode = normalizeCountryCode(String(meRes.data?.country_code ?? ''));

  const savedRes = await supabase.from('saved_cards').select('result_card_id').eq('user_id', profileId);
  if (savedRes.error) return { data: [], error: new Error(savedRes.error.message) };
  const cardIds = (savedRes.data ?? []).map((r) => String(r.result_card_id));
  if (!cardIds.length) return { data: [], error: null };

  const cardsRes = await supabase
    .from('result_cards')
    .select('id, mission_id, team_id, submission_a_id, submission_b_id, total_like_count, created_at')
    .in('id', cardIds)
    .order('created_at', { ascending: false });
  if (cardsRes.error) return { data: [], error: new Error(cardsRes.error.message) };

  return hydrateCards((cardsRes.data ?? []) as ResultCardRow[], viewerCountryCode);
}

