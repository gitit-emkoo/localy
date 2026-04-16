/** ISO 3166-1 alpha-2 → regional indicator flag emoji */
export function countryCodeToFlag(code: string): string {
  const c = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  const base = 127397;
  return String.fromCodePoint(c.charCodeAt(0) + base, c.charCodeAt(1) + base);
}

/** English country/region name for badges (locale-independent). */
export function countryCodeToEnglishName(countryCode: string): string {
  const code = String(countryCode).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return code || '—';
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}
