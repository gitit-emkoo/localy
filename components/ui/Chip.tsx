import { Pressable, StyleSheet, ViewStyle } from 'react-native';

import { Text } from '@/components/Themed';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Chip({ label, selected, onPress, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.unselected,
        pressed ? styles.pressed : null,
        style,
      ]}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  selected: {
    borderColor: '#D4A017',
  },
  unselected: {
    borderColor: '#E5E7EB',
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    fontSize: 13,
    fontWeight: '400',
    color: '#111827',
  },
});
