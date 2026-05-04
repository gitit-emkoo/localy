import { useState } from 'react';
import { Pressable, type TextStyle, StyleSheet, TextInput, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

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
  /** 비밀번호 입력 칸에서 눈 아이콘 토글 표시 */
  enablePasswordToggle?: boolean;
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
  enablePasswordToggle,
}: Props) {
  const canToggle = Boolean(secureTextEntry && enablePasswordToggle);
  const [passwordHidden, setPasswordHidden] = useState(true);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrap}>
        <TextInput
          style={[styles.input, canToggle ? styles.inputWithToggle : null, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          secureTextEntry={secureTextEntry ? passwordHidden : false}
          onBlur={onBlur}
          onFocus={onFocus}
        />
        {canToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordHidden ? 'Show password' : 'Hide password'}
            onPress={() => setPasswordHidden((prev) => !prev)}
            style={styles.toggleBtn}>
            <FontAwesome name={passwordHidden ? 'eye' : 'eye-slash'} size={18} color="#6B7280" />
          </Pressable>
        ) : null}
      </View>
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
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F3F4F6',
  },
  inputWithToggle: {
    paddingRight: 44,
  },
  toggleBtn: {
    position: 'absolute',
    right: 12,
    height: 30,
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
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
