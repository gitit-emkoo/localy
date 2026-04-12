import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

type Props = {
  title?: string;
  description?: string;
};

export function ScreenPlaceholder({ title, description }: Props) {
  return (
    <View style={styles.container}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {description ? <Text style={styles.desc}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  desc: {
    fontSize: 15,
    opacity: 0.75,
    textAlign: 'center',
  },
});
