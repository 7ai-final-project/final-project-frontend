import { Stack } from "expo-router";
import { WebSocketProvider } from "@/components/context/WebSocketContext";

export default function MultiModeLayout() {
  return (
    <WebSocketProvider>
      <Stack>
        <Stack.Screen name="play" options={{ title: "게임 플레이" }} />
        <Stack.Screen name="room" options={{ title: "게임방" }} />
      </Stack>
    </WebSocketProvider>
  );
}