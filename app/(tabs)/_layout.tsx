import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import { Image, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import Colors from '@/constants/Colors';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';

function AppTabIcon(props: { route: 'home' | 'board' | 'world' | 'my'; focused: boolean }) {
  const sourceMap = {
    home: require('../../assets/tab-icons/Home.png'),
    board: require('../../assets/tab-icons/Board.png'),
    world: require('../../assets/tab-icons/World.png'),
    my: require('../../assets/tab-icons/My.png'),
  } as const;

  return (
    <Image
      source={sourceMap[props.route]}
      style={{
        width: 24,
        height: 24,
        marginBottom: -2,
        opacity: props.focused ? 1 : 0.62,
      }}
      resizeMode="contain"
    />
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('app.name'),
          headerTitle: () => (
            <Image
              source={require('../../assets/logohome.png')}
              style={styles.headerLogo}
              resizeMode="contain"
              accessibilityLabel={t('app.name')}
            />
          ),
          tabBarLabel: t('tabs.home'),
          tabBarIcon: ({ focused }) => <AppTabIcon route="home" focused={focused} />,
          headerRight: () => (
            <Link href="/notifications" asChild>
              <Pressable accessibilityRole="button">
                {({ pressed }) => (
                  <FontAwesome
                    name="bell-o"
                    size={22}
                    color={Colors[colorScheme ?? 'light'].text}
                    style={{ marginRight: 16, opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          title: t('tabs.board'),
          tabBarIcon: ({ focused }) => <AppTabIcon route="board" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="world"
        options={{
          title: t('tabs.world'),
          tabBarIcon: ({ focused }) => <AppTabIcon route="world" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: t('tabs.my'),
          tabBarIcon: ({ focused }) => <AppTabIcon route="my" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerLogo: {
    height: 28,
    width: 132,
  },
});
