import type { Href } from 'expo-router';

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string' || v.trim().length === 0) return null;
  return v;
}

/** Expo 푸시 `data` / 알림 행 `payload_json`에서 라우트 경로를 만든다. */
export function hrefFromPushData(data: Record<string, unknown> | undefined | null): Href | null {
  if (!data || typeof data !== 'object') return null;

  const targetType = asNonEmptyString(data.targetType ?? data.target_type);
  const targetId = asNonEmptyString(data.targetId ?? data.target_id);

  if (targetType === 'team' && targetId) {
    return `/team/${targetId}` as Href;
  }
  if ((targetType === 'result_card' || targetType === 'resultCard') && targetId) {
    return `/result-card/${targetId}` as Href;
  }

  const type = asNonEmptyString(data.type);
  if (type === 'MATCH_COMPLETED') {
    const teamId = asNonEmptyString(data.teamId ?? data.team_id);
    if (teamId) return `/team/${teamId}` as Href;
  }
  if (type === 'RESULT_READY') {
    const cardId = asNonEmptyString(data.resultCardId ?? data.result_card_id ?? data.resultCardID);
    if (cardId) return `/result-card/${cardId}` as Href;
  }

  return null;
}
