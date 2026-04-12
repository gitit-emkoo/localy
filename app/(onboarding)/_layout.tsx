import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack>
      <Stack.Screen name="profile" options={{ headerShown: false }} />
    </Stack>
  );
}
