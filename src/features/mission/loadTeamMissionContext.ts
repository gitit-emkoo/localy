import {
  fetchActiveMatchRequest,
  fetchActiveMission,
  fetchTeam,
  getMyProfileId,
  type MatchRequestRow,
  type MissionRow,
  type TeamRow,
} from '@/src/features/mission/todayMission';
import { supabase } from '@/src/lib/supabase/client';

export type SubmissionRow = {
  id: string;
  team_id: string;
  mission_id: string;
  user_id: string;
  photo_url: string;
  caption_original: string;
  submitted_at: string;
  status: string;
};

export type ResultCardRow = {
  id: string;
  team_id: string;
  mission_id: string;
  status: string;
};

export type TeamMissionContext =
  | { ok: false; reason: 'no_profile' | 'no_mission' | 'no_team'; message?: string }
  | {
      ok: true;
      myProfileId: string;
      mission: MissionRow;
      team: TeamRow;
      matchRequest: MatchRequestRow;
      submissions: SubmissionRow[];
      resultCard: ResultCardRow | null;
      me: TeamMemberProfile;
      partner: TeamMemberProfile;
      missionTitle: string;
    };

export type TeamMemberProfile = {
  id: string;
  nickname: string;
  age: number | null;
  country_code: string;
  country_name: string;
  short_bio: string;
};

export async function loadTeamMissionContext(): Promise<TeamMissionContext> {
  const myProfileId = await getMyProfileId();
  if (!myProfileId) {
    return { ok: false, reason: 'no_profile' };
  }

  const mRes = await fetchActiveMission();
  if (mRes.error || !mRes.data) {
    return { ok: false, reason: 'no_mission' };
  }

  const mission = mRes.data as MissionRow;
  const mrRes = await fetchActiveMatchRequest(myProfileId, mission.id);
  if (mrRes.error) {
    return { ok: false, reason: 'no_team', message: mrRes.error.message };
  }

  const mr = mrRes.data as MatchRequestRow | null;
  if (!mr || mr.status !== 'matched' || !mr.team_id) {
    return { ok: false, reason: 'no_team' };
  }

  const teamRes = await fetchTeam(mr.team_id);
  const team = teamRes.data as TeamRow | null;
  if (!team) {
    return { ok: false, reason: 'no_team' };
  }

  const subRes = await supabase
    .from('submissions')
    .select('id, team_id, mission_id, user_id, photo_url, caption_original, submitted_at, status')
    .eq('team_id', team.id)
    .eq('status', 'submitted');

  if (subRes.error) {
    return { ok: false, reason: 'no_team', message: subRes.error.message };
  }

  const submissions = (subRes.data ?? []) as SubmissionRow[];

  const rcRes = await supabase.from('result_cards').select('id, team_id, mission_id, status').eq('team_id', team.id).maybeSingle();

  const resultCard = (rcRes.data as ResultCardRow | null) ?? null;

  const pRes = await supabase
    .from('user_profiles')
    .select('id, nickname, age, country_code, country_name, short_bio')
    .in('id', [team.user_a_id, team.user_b_id]);
  if (pRes.error || !pRes.data || pRes.data.length < 2) {
    return { ok: false, reason: 'no_team', message: pRes.error?.message ?? 'profiles_not_found' };
  }

  const me = pRes.data.find((p) => p.id === myProfileId) as TeamMemberProfile | undefined;
  const partner = pRes.data.find((p) => p.id !== myProfileId) as TeamMemberProfile | undefined;
  if (!me || !partner) {
    return { ok: false, reason: 'no_team', message: 'invalid_team_profiles' };
  }

  return {
    ok: true,
    myProfileId,
    mission,
    team,
    matchRequest: mr,
    submissions,
    resultCard,
    me,
    partner,
    missionTitle: mission.title,
  };
}
