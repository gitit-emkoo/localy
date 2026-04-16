import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/src/lib/supabase/client';

import type { MatchState } from '@/src/types/domain';
import { invokeMatchmakingWorker } from '@/src/features/mission/invokeMatchmakingWorker';

export type MissionRow = {
  id: string;
  mission_date: string;
  /** 서버(UTC) 기준 활성 구간 시작 */
  valid_from: string;
  /** 서버(UTC) 기준 활성 구간 끝(배타) */
  valid_to: string;
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
  status: 'idle' | 'matching' | 'matched' | 'failed' | 'cancelled' | 'expired';
  timezone_offset_minutes: number;
  team_id: string | null;
  failed_at?: string | null;
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
  if (status === 'expired') return 'expired';
  if (status === 'failed') return 'match_failed';
  if (status === 'cancelled') return 'idle';
  if (status === 'matched') return 'matched';
  if (status === 'matching') return 'matching';
  return 'idle';
}

const COOLDOWN_MS = 30_000;

function cooldownStorageKey(profileId: string, missionId: string) {
  return `match_retry_not_before:${profileId}:${missionId}`;
}

export async function setMatchRetryCooldown(profileId: string, missionId: string) {
  const until = Date.now() + COOLDOWN_MS;
  await AsyncStorage.setItem(cooldownStorageKey(profileId, missionId), String(until));
}

async function assertMatchRetryAllowed(profileId: string, missionId: string): Promise<Error | null> {
  const raw = await AsyncStorage.getItem(cooldownStorageKey(profileId, missionId));
  if (!raw) return null;
  const until = Number(raw);
  if (Number.isNaN(until) || Date.now() >= until) return null;
  return new Error('match_retry_cooldown');
}

export async function getMyProfileId(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const authUserId = auth.user?.id;
  if (!authUserId) return null;

  const res = await supabase.from('user_profiles').select('id').eq('auth_user_id', authUserId).maybeSingle();
  if (res.error || !res.data) return null;
  return res.data.id as string;
}

/** 서버 시각 `now()`로 활성 미션 1건 (없으면 data null). 로컬 달력으로 미션을 고르지 않는다. */
export async function fetchActiveMission() {
  return supabase.rpc('get_active_mission');
}

/** 활성 요청만: matching | matched (합의: 동시에 최대 1건) */
export async function fetchActiveMatchRequest(profileId: string, missionId: string) {
  return supabase
    .from('match_requests')
    .select('*')
    .eq('user_id', profileId)
    .eq('mission_id', missionId)
    .in('status', ['matching', 'matched'])
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

/** 홈 표시용: 해당 미션에 대한 가장 최근 요청 한 건(히스토리 포함) */
export async function fetchLatestMatchRequest(profileId: string, missionId: string) {
  return supabase
    .from('match_requests')
    .select('*')
    .eq('user_id', profileId)
    .eq('mission_id', missionId)
    .order('requested_at', { ascending: false })
    .limit(1)
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
  const cooldownErr = await assertMatchRetryAllowed(input.profileId, input.missionId);
  if (cooldownErr) {
    return { data: null, error: cooldownErr } as const;
  }

  const latestPeek = await fetchLatestMatchRequest(input.profileId, input.missionId);
  if (latestPeek.error) {
    return { data: null, error: latestPeek.error } as const;
  }
  const latestRow = latestPeek.data as MatchRequestRow | null;
  if (latestRow?.status === 'expired') {
    return { data: null, error: new Error('match_expired') } as const;
  }
  if (latestRow?.status === 'failed' && latestRow.failed_at) {
    const failedAt = new Date(latestRow.failed_at).getTime();
    if (!Number.isNaN(failedAt) && Date.now() - failedAt < COOLDOWN_MS) {
      return { data: null, error: new Error('match_retry_cooldown') } as const;
    }
  }

  const existingRes = await fetchActiveMatchRequest(input.profileId, input.missionId);
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

  if (ins.error || !ins.data) {
    return { data: null, error: ins.error } as const;
  }

  const row = ins.data as MatchRequestRow;
  void invokeMatchmakingWorker({ matchRequestId: row.id, missionId: input.missionId });
  return { data: row, error: null } as const;
}

/** matching 상태만 취소 → cancelled (합의: row 유지, 새 매칭은 새 row) */
export async function cancelActiveMatchRequest(input: { profileId: string; missionId: string }) {
  const activeRes = await fetchActiveMatchRequest(input.profileId, input.missionId);
  if (activeRes.error) return { error: activeRes.error } as const;
  const active = activeRes.data as MatchRequestRow | null;
  if (!active || active.status !== 'matching') {
    return { error: null } as const;
  }
  const upd = await supabase
    .from('match_requests')
    .update({ status: 'cancelled', failed_at: null })
    .eq('id', active.id)
    .eq('user_id', input.profileId);
  if (upd.error) return { error: upd.error } as const;
  await setMatchRetryCooldown(input.profileId, input.missionId);
  return { error: null } as const;
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
