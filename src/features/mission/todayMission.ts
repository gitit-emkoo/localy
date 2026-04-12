import { supabase } from '@/src/lib/supabase/client';

import { getLocalCalendarDateKey } from '@/src/lib/date';
import type { MatchState } from '@/src/types/domain';

export type MissionRow = {
  id: string;
  mission_date: string;
  category_key: string;
  title: string;
  short_description: string;
  notice_text: string;
  is_time_sensitive: boolean;
  status: string;
};

export type MatchRequestRow = {
  id: string;
  user_id: string;
  mission_id: string;
  status: 'idle' | 'matching' | 'matched' | 'failed' | 'cancelled';
  timezone_offset_minutes: number;
  team_id: string | null;
};

export type TeamRow = {
  id: string;
  mission_id: string;
  user_a_id: string;
  user_b_id: string;
  user_a_country_code: string;
  user_b_country_code: string;
  match_status: string;
};

export type PartnerProfileRow = {
  id: string;
  nickname: string;
  country_code: string;
  short_bio: string;
};

export function matchRequestStatusToMatchState(status: MatchRequestRow['status'] | undefined): MatchState {
  if (!status) return 'idle';
  if (status === 'failed' || status === 'cancelled') return 'match_failed';
  if (status === 'matched') return 'matched';
  if (status === 'matching') return 'matching';
  return 'idle';
}

export async function getMyProfileId(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const authUserId = auth.user?.id;
  if (!authUserId) return null;

  const res = await supabase.from('user_profiles').select('id').eq('auth_user_id', authUserId).maybeSingle();
  if (res.error || !res.data) return null;
  return res.data.id as string;
}

export async function fetchPublishedMissionForLocalToday() {
  const dateKey = getLocalCalendarDateKey();
  return supabase
    .from('missions')
    .select('*')
    .eq('mission_date', dateKey)
    .eq('status', 'published')
    .maybeSingle();
}

export async function fetchMatchRequest(profileId: string, missionId: string) {
  return supabase
    .from('match_requests')
    .select('*')
    .eq('user_id', profileId)
    .eq('mission_id', missionId)
    .maybeSingle();
}

/**
 * 문서 5-6: 클라이언트는 직접 매칭하지 않고 요청만 기록한다. (매칭 완료는 서버/Edge)
 */
export async function startOrResumeMatchRequest(input: {
  profileId: string;
  missionId: string;
  timezoneOffsetMinutes: number;
}) {
  const existingRes = await fetchMatchRequest(input.profileId, input.missionId);
  if (existingRes.error) {
    return { data: null, error: existingRes.error } as const;
  }

  const existing = existingRes.data as MatchRequestRow | null;
  if (existing?.status === 'matched') {
    return { data: existing, error: new Error('already_matched') } as const;
  }
  if (existing?.status === 'matching') {
    return { data: existing, error: null } as const;
  }

  if (existing) {
    const upd = await supabase
      .from('match_requests')
      .update({
        status: 'matching',
        timezone_offset_minutes: input.timezoneOffsetMinutes,
        requested_at: new Date().toISOString(),
        failed_at: null,
        team_id: null,
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    return { data: upd.data as MatchRequestRow | null, error: upd.error } as const;
  }

  const ins = await supabase
    .from('match_requests')
    .insert({
      user_id: input.profileId,
      mission_id: input.missionId,
      status: 'matching',
      timezone_offset_minutes: input.timezoneOffsetMinutes,
    })
    .select('*')
    .single();

  return { data: ins.data as MatchRequestRow | null, error: ins.error } as const;
}

export async function fetchTeam(teamId: string) {
  return supabase.from('teams').select('*').eq('id', teamId).maybeSingle();
}

/** 팀에 `open` 결과 카드가 있으면(양쪽 제출 완료) id, 없으면 null */
export async function fetchOpenResultCardIdForTeam(teamId: string): Promise<string | null> {
  const res = await supabase
    .from('result_cards')
    .select('id')
    .eq('team_id', teamId)
    .eq('status', 'open')
    .maybeSingle();
  if (res.error || !res.data?.id) return null;
  return String(res.data.id);
}

export async function fetchPartnerProfile(team: TeamRow, myProfileId: string) {
  const partnerId = team.user_a_id === myProfileId ? team.user_b_id : team.user_a_id;
  const res = await supabase
    .from('user_profiles')
    .select('id, nickname, country_code, short_bio')
    .eq('id', partnerId)
    .maybeSingle();
  if (res.error) {
    return { data: null, error: res.error } as const;
  }
  return { data: res.data as PartnerProfileRow | null, error: null } as const;
}

export function partnerCountryFromTeam(team: TeamRow, myProfileId: string): string {
  return team.user_a_id === myProfileId ? team.user_b_country_code : team.user_a_country_code;
}
