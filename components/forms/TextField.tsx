import { type TextStyle, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';

type Props = {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  helperText?: string;
  /** 형식 오류 등 (빨간색) */
  errorText?: string;
  onBlur?: () => void;
  onFocus?: () => void;
  /** TextInput 스타일 덮어쓰기·추가 */
  inputStyle?: TextStyle;
  secureTextEntry?: boolean;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'none',
  maxLength,
  helperText,
  errorText,
  onBlur,
  onFocus,
  inputStyle,
  secureTextEntry,
}: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
        onBlur={onBlur}
        onFocus={onFocus}
      />
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
      {helperText && !errorText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F3F4F6',
  },
  helper: {
    fontSize: 12,
    opacity: 0.7,
  },
  error: {
    fontSize: 12,
    color: '#D92D20',
    fontWeight: '600',
  },
});
