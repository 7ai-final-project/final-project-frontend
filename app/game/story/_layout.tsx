import { Stack } from "expo-router";

export default function StoryModeLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "메인" }} />
      <Stack.Screen name="play" options={{ title: "플레이" }} />
    </Stack>
  );
}
