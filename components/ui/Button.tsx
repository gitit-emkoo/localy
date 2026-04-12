import { ActivityIndicator, Pressable, StyleSheet, ViewStyle } from 'react-native';

import { Text } from '@/components/Themed';

type Variant = 'primary' | 'secondary';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
}: Props) {
  const isDisabled = Boolean(disabled || loading);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#111'} />
      ) : (
        <Text style={[styles.label, variant === 'primary' ? styles.labelOnPrimary : null]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: '#2F6BFF',
  },
  secondary: {
    backgroundColor: '#EEF2FF',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  labelOnPrimary: {
    color: '#fff',
  },
});
