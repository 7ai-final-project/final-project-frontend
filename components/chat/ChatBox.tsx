// app/components/chat/ChatBox.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert
} from "react-native";
import { storage } from "../../services/storage";
import { useAuth } from "../../hooks/useAuth";
import { getWebSocketNonce } from "../../services/api"; // ✅ 새로운 API 헬퍼 함수 임포트

interface ChatMessage {
  userId: string;
  username: string;
  message: string;
  timestamp: string;
}

interface ChatBoxProps {
  roomId: string;
  chatSocketRef: React.MutableRefObject<WebSocket | null>;
}

const ChatBox: React.FC<ChatBoxProps> = ({ roomId, chatSocketRef }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const { user } = useAuth();
  const username = user?.name || "me"; // user 없으면 기본값 me
  const scrollViewRef = useRef<ScrollView | null>(null);
  const formatTimestamp = (isoString: string): string => {
    if (!isoString) return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // WebSocket 연결
  useEffect(() => {
    const connectChat = async () => {
      // ✅ nonce를 가져와서 웹소켓 URL에 사용하도록 수정
      try {
        const nonceResponse = await getWebSocketNonce();
        const nonce = nonceResponse.data.nonce;
        
        const wsUrl = `ws://127.0.0.1:8000/ws/chat/${roomId}/?nonce=${nonce}`;
        console.log("🌐 Chat WebSocket 연결 시도:", wsUrl);

        chatSocketRef.current = new WebSocket(wsUrl);

        chatSocketRef.current.onopen = () => {
          console.log("✅ Chat WebSocket open");
        };

        chatSocketRef.current.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            console.log("📨 받은 메시지:", data);

            if (data.type === 'history') {
              const historyMessages = data.messages.map((msg: any) => ({
                userId: msg.user_id, // 👈 user_id 추가
                username: msg.user || "system",
                message: msg.message || "",
                timestamp: formatTimestamp(msg.created_at),
              }));
              setMessages(historyMessages);
            } 
            else if (data.type === 'new_message') {
              const newMessageData = data.message;
              if (newMessageData && newMessageData.message) {
                const newMessage = {
                  userId: newMessageData.user_id, // 👈 user_id 추가
                  username: newMessageData.user || "system",
                  message: newMessageData.message,
                  timestamp: formatTimestamp(newMessageData.created_at),
                };
                setMessages((prevMessages) => [...prevMessages, newMessage]);
              }
            }
          } catch (err) {
            console.error("⚠️ 메시지 파싱 오류:", err);
          }
        };

        chatSocketRef.current.onclose = () => {
          console.log("❌ Chat WebSocket closed");
        };
      } catch (error) {
        console.error("채팅 WebSocket 연결 실패:", error);
        Alert.alert("연결 오류", "채팅 서버에 연결할 수 없습니다.");
      }
    };

    connectChat();

    return () => {
      chatSocketRef.current?.close();
    };
  }, [roomId]);

  // 메시지 전송
  const sendMessage = () => {
    const ws = chatSocketRef.current;
    const text = newMessage.trim();
    if (ws && ws.readyState === WebSocket.OPEN && text) {
      ws.send(JSON.stringify({ message: text }));
      setNewMessage("");
    }
  };

  // 메시지가 추가될 때 자동 스크롤
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <View style={{ marginTop: 10 }}>
      {/* 채팅창 */}
      <View style={styles.chatContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatScroll}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, index) => {
            const isMyMessage = msg.userId === user?.id;
            return (
              <View
                key={index}
                style={[
                  styles.messageBubble,
                  isMyMessage
                    ? styles.myMessageBubble
                    : styles.otherMessageBubble,
                ]}
              >
                <Text
                  style={[
                    styles.messageUser,
                    isMyMessage
                      ? styles.myMessageUser
                      : styles.otherMessageUser,
                  ]}
                >
                  {msg.username}
                </Text>
                <Text
                  style={[
                    styles.messageText,
                    isMyMessage
                      ? styles.myMessageText
                      : styles.otherMessageText,
                  ]}
                >
                  {msg.message}
                </Text>
                <Text
                  style={[
                    styles.timestamp,
                    isMyMessage ? styles.myTimestamp : styles.otherTimestamp,
                  ]}
                >
                  {msg.timestamp}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* 입력창 */}
        <View style={styles.chatInputContainer}>
          <TextInput
            style={styles.chatInput}
            placeholder="메시지 입력..."
            placeholderTextColor="#aaa"
            value={newMessage}
            onChangeText={setNewMessage}
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendButtonText}>전송</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chatContainer: {
    backgroundColor: "#1C1C1E",
    borderRadius: 8,
    padding: 10,
    height: 300,
  },
  chatMessages: {
    flex: 1,
    marginBottom: 10,
  },
  messageBubble: {
    marginVertical: 4,
    padding: 8,
    borderRadius: 8,
    maxWidth: "70%",
  },
  myMessageBubble: {
    backgroundColor: "#4A90E2",
    alignSelf: "flex-end",
  },
  otherMessageBubble: {
    backgroundColor: "#3A3A3C",
    alignSelf: "flex-start",
  },
  messageUser: {
    fontSize: 12,
    marginBottom: 2,
  },
  myMessageUser: {
    color: "#FFD700",
    textAlign: "right",
  },
  otherMessageUser: {
    color: "#E2C044",
    textAlign: "left",
  },
  messageText: {
    fontSize: 14,
  },
  myMessageText: {
    color: "#fff",
    textAlign: "right",
  },
  otherMessageText: {
    color: "#fff",
    textAlign: "left",
  },
  chatInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  chatInput: {
    flex: 1,
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    paddingHorizontal: 10,
    color: "#fff",
    height: 40,
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: "#E2C044",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendButtonText: {
    color: "#000",
    fontWeight: "bold",
  },
  chatScroll: {
    flex: 1,
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    padding: 10,
    marginVertical: 5,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 2,
  },
  myTimestamp: {
    color: "#ddd",
    textAlign: "left", // 내가 보낸 경우 왼쪽
  },
  otherTimestamp: {
    color: "#ddd",
    textAlign: "right", // 다른 사람은 오른쪽
  },
});

export default ChatBox;