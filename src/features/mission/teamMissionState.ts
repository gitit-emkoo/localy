import type { TeamMissionState } from '@/src/types/domain';

export function computeTeamMissionState(input: {
  myProfileId: string;
  submissionUserIds: string[];
}): TeamMissionState {
  const mine = input.submissionUserIds.includes(input.myProfileId);
  const peer = input.submissionUserIds.some((id) => id !== input.myProfileId);

  if (!mine && !peer) return 'not_started';
  if (mine && !peer) return 'self_submitted_waiting';
  if (!mine && peer) return 'peer_submitted_waiting';
  return 'ready_to_view';
}
