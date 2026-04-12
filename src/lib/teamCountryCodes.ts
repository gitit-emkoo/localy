/** ISO 국가코드 정규화 (국기 이모지/표시용) */
export function normalizeCountryCode(code: string): string {
  return String(code ?? '').trim().toUpperCase();
}

export type TeamCountryLookup = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  user_a_country_code: string;
  user_b_country_code: string;
};

/**
 * 프로필 country_code 우선, 없으면 teams에서 해당 user_id 슬롯의 국가코드.
 * submission_a/b 순서는 제출 시각 기준이라 user_a/b와 일치하지 않을 수 있음.
 */
/** 보드/카드에서 시청자 국가가 B와 같을 때만 순서를 바꿔 표시 */
export function orderedCountryCodesForViewer(
  codeA: string,
  codeB: string,
  viewerCountryCode?: string,
): [string, string] {
  const a = normalizeCountryCode(codeA);
  const b = normalizeCountryCode(codeB);
  const viewer = normalizeCountryCode(viewerCountryCode ?? '');
  if (viewer && viewer === b && viewer !== a) return [b, a];
  return [a, b];
}

export function countryForUser(
  userId: string,
  profileCountry: string | undefined,
  team: TeamCountryLookup | undefined,
): string {
  const fromProfile = normalizeCountryCode(profileCountry ?? '');
  if (fromProfile) return fromProfile;
  if (!team) return '';
  const uid = String(userId);
  if (uid === String(team.user_a_id)) return normalizeCountryCode(team.user_a_country_code);
  if (uid === String(team.user_b_id)) return normalizeCountryCode(team.user_b_country_code);
  return '';
}
