import { Stack } from 'expo-router';
import React from 'react';

export default function LegalLayout() {
  return (
    <Stack>
      <Stack.Screen name="terms" options={{ headerShown: false }} />
    </Stack>
  );
}