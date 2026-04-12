import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { countryCodeToFlag } from '@/src/lib/countryFlag';
import { normalizeCountryCode, orderedCountryCodesForViewer } from '@/src/lib/teamCountryCodes';

type Props = {
  codeA: string;
  codeB: string;
  viewerCountryCode?: string;
  /** 보드: viewer(기본). 홈 팀 줄: 이미 [나, 상대] 순이면 as_is */
  pairOrder?: 'viewer' | 'as_is';
  /** 기본 16 — 보드 카드 메타와 맞춤 */
  flagFontSize?: number;
};

/**
 * 국기 이모지 두 개를 한 Text에 넣으면 로케일·폰트 스케일·RTL에서 한쪽이 잘리는 경우가 있어 분리 렌더링.
 */
export function FlagPairRow({
  codeA,
  codeB,
  viewerCountryCode,
  pairOrder = 'viewer',
  flagFontSize = 16,
}: Props) {
  const [left, right] =
    pairOrder === 'as_is'
      ? [normalizeCountryCode(codeA), normalizeCountryCode(codeB)]
      : orderedCountryCodesForViewer(codeA, codeB, viewerCountryCode);
  const f1 = countryCodeToFlag(left);
  const f2 = countryCodeToFlag(right);
  const lh = flagFontSize + 4;

  return (
    <View style={styles.row}>
      <Text allowFontScaling={false} style={[styles.flag, { fontSize: flagFontSize, lineHeight: lh }]}>
        {f1 || '\u00a0'}
      </Text>
      <Text allowFontScaling={false} style={[styles.sep, { fontSize: flagFontSize - 2, lineHeight: lh }]}>
        {' × '}
      </Text>
      <Text allowFontScaling={false} style={[styles.flag, { fontSize: flagFontSize, lineHeight: lh }]}>
        {f2 || '\u00a0'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    flexGrow: 0,
    direction: 'ltr',
  },
  flag: {
    flexShrink: 0,
  },
  sep: {
    flexShrink: 0,
    opacity: 0.55,
    fontWeight: '600',
  },
});
