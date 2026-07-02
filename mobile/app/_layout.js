import React from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * Root layout.
 *
 * Expo Router wraps _layout.js inside its own NavigationContainer before
 * calling this function, so useRouter() / useSegments() used inside
 * AuthProvider are always within a valid navigation context.
 *
 * Stack order matches the file-system screens in /app.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="health" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="scan-qr" />
          <Stack.Screen name="generate-qr" />
          <Stack.Screen name="donors" />
          <Stack.Screen name="map-route" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
