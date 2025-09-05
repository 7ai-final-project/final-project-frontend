import { Stack } from "expo-router";

export default function GameLayout() {
  return (
    <Stack>
      <Stack.Screen name="story" options={{ title: "스토리 모드" }} />
      <Stack.Screen name="single" options={{ title: "싱글 게임" }} />
      <Stack.Screen name="multi" options={{ title: "멀티 게임" }} />
    </Stack>
  );
}
