/** ISO 3166-1 alpha-2 → regional indicator flag emoji */
export function countryCodeToFlag(code: string): string {
  const c = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  const base = 127397;
  return String.fromCodePoint(c.charCodeAt(0) + base, c.charCodeAt(1) + base);
}
