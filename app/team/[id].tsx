import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { TeamMissionBody } from '@/app/team-mission';

export default function TeamByIdScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const teamId = useMemo(() => (Array.isArray(id) ? id[0] : id) ?? '', [id]);

  return <TeamMissionBody forcedTeamId={teamId || undefined} />;
}
