import { Stack, useLocalSearchParams } from "expo-router";
import { useState, useRef } from "react";
import { View, TouchableOpacity, StyleSheet, Modal, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ChatBox from "../../components/chat/ChatBox";

export default function GameLayout() {
  const [isChatVisible, setIsChatVisible] = useState(false);
  const chatSocketRef = useRef<WebSocket | null>(null);

  // URL 파라미터에서 roomId 가져오기
  const { id: roomId } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={{ flex: 1 }}>
      {/* 실제 화면 (index.tsx 등) */}
      <Stack screenOptions={{ headerShown: false }} />

      {/* 채팅 버튼 (우측 상단) */}
      <TouchableOpacity
        style={styles.chatButton}
        onPress={() => setIsChatVisible(true)}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={28} color="#fff" />
      </TouchableOpacity>

      {/* 채팅창 모달 */}
      <Modal
        transparent={true}
        visible={isChatVisible}
        animationType="slide"
        onRequestClose={() => setIsChatVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* 닫기 버튼 */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsChatVisible(false)}
            >
              <Text style={{ color: "#fff" }}>닫기 ✖</Text>
            </TouchableOpacity>

            {/* ChatBox 연결 */}
            {roomId ? (
              <ChatBox roomId={roomId} chatSocketRef={chatSocketRef} />
            ) : (
              <Text style={{ color: "#fff" }}>❌ roomId가 없습니다.</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  chatButton: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 30,
    zIndex: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalContent: {
    width: "90%",
    height: "70%",
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 12,
  },
  closeButton: {
    alignSelf: "flex-end",
    marginBottom: 8,
  },
});
