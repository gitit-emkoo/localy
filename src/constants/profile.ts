import type { MvpCountryCode } from '@/src/types/domain';

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;

export const SHORT_BIO_MAX = 40;
export const INTRO_MAX = 120;

export const CAPTION_MAX = 60;

export type InterestKey =
  | 'food'
  | 'daily_life'
  | 'place'
  | 'emotion'
  | 'study'
  | 'daily_spending'
  | 'fashion';

export const INTEREST_OPTIONS: { key: InterestKey; labelKey: string }[] = [
  { key: 'food', labelKey: 'profile.interest.food' },
  { key: 'daily_life', labelKey: 'profile.interest.dailyLife' },
  { key: 'place', labelKey: 'profile.interest.place' },
  { key: 'emotion', labelKey: 'profile.interest.emotion' },
  { key: 'study', labelKey: 'profile.interest.study' },
  { key: 'daily_spending', labelKey: 'profile.interest.dailySpending' },
  { key: 'fashion', labelKey: 'profile.interest.fashion' },
];

export const MVP_COUNTRIES: {
  code: MvpCountryCode;
  nameKey: string;
}[] = [
  { code: 'KR', nameKey: 'country.KR' },
  { code: 'JP', nameKey: 'country.JP' },
  { code: 'VN', nameKey: 'country.VN' },
  { code: 'PH', nameKey: 'country.PH' },
  { code: 'TW', nameKey: 'country.TW' },
  { code: 'ID', nameKey: 'country.ID' },
  { code: 'BR', nameKey: 'country.BR' },
  { code: 'MX', nameKey: 'country.MX' },
];
