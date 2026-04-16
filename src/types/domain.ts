/**
 * 기획 문서와 동일한 이름의 상태·도메인 타입 (임의 확장 금지)
 */

export type MatchState = 'idle' | 'matching' | 'matched' | 'match_failed' | 'expired';

export type TeamMissionState =
  | 'not_started'
  | 'self_submitted_waiting'
  | 'peer_submitted_waiting'
  | 'ready_to_view';

export type ResultCardStatus = 'locked' | 'open';

export type AppLanguageCode = 'ko' | 'en' | 'ja' | 'pt-BR';

/** MVP 출시 8개국 ISO 3166-1 alpha-2 */
export const MVP_COUNTRY_CODES = [
  'KR',
  'JP',
  'VN',
  'PH',
  'TW',
  'ID',
  'BR',
  'MX',
] as const;

export type MvpCountryCode = (typeof MVP_COUNTRY_CODES)[number];
