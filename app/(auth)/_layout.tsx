import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen name="email" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="verify-reset" options={{ title: '' }} />
      <Stack.Screen name="reset-password" options={{ title: '' }} />
      <Stack.Screen name="verify" options={{ title: '' }} />
    </Stack>
  );
}
