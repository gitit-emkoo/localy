/** 기기 로컬 달력 기준 YYYY-MM-DD (당일 미션 조회용) */
export function getLocalCalendarDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
