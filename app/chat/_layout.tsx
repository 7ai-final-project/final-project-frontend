import { Stack } from "expo-router";
import { WebSocketProvider } from "@/components/context/WebSocketContext";
import { SafeAreaView, ScrollView, StyleSheet } from "react-native";

export default function RootLayout() {
  return (
    <WebSocketProvider>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false} // iOS 튕김 효과 제거 (원하면 빼도 됨)
        >
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="index" options={{ headerShown: false }} />
            {/* <Stack.Screen name="single_mode" options={{ headerShown: false }} /> */}
            {/* <Stack.Screen name="multi_mode" options={{ headerShown: false }} /> */}
          </Stack>
        </ScrollView>
      </SafeAreaView>
    </WebSocketProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B1021", // 전체 배경
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: "100%",
  },
});
