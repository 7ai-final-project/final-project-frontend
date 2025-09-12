// app\game\multi\_layout.tsx

import { Stack } from "expo-router";
import { WebSocketProvider } from "@/components/context/WebSocketContext";

export default function MultiModeLayout() {
  return (
    <WebSocketProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="play"/>
        <Stack.Screen name="room"/>
      </Stack>
    </WebSocketProvider>
  );
}