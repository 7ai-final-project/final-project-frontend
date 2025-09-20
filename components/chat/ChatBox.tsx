// app/components/chat/ChatBox.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Linking, // ✨ 개선 사항: 링크를 열기 위해 Linking import
} from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { getWebSocketNonce } from "../../services/api";

// ✨ 개선 사항: 메시지 상태(status)와 고유 ID(id)를 포함하도록 인터페이스 확장
interface ChatMessage {
  id: string | number; // 낙관적 UI를 위한 고유 ID
  userId: string;
  username: string;
  message: string;
  timestamp: string;
  status?: 'sending' | 'sent'; // 메시지 전송 상태
}

interface ChatBoxProps {
  roomId: string;
  chatSocketRef: React.MutableRefObject<WebSocket | null>;
}

// ✨ 개선 사항: URL을 파싱하고 링크를 적용하는 텍스트 렌더러 컴포넌트
const MessageTextRenderer = ({ text, style, linkStyle }: { text: string; style: any; linkStyle: any }) => {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          return (
            <Text
              key={index}
              style={linkStyle}
              onPress={() => {
                let url = part;
                if (!url.startsWith('http')) {
                  url = `https://` + url;
                }
                Linking.openURL(url);
              }}
            >
              {part}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
};


const ChatBox: React.FC<ChatBoxProps> = ({ roomId, chatSocketRef }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView | null>(null);

  const formatTimestamp = (isoString: string): string => {
    if (!isoString) return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ✨ 개선 사항: 날짜 비교를 위한 헬퍼 함수
  const getDisplayDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  useEffect(() => {
    // ✨ 해결책: 사용자 정보가 완전히 로드되었을 때만 연결을 시작하도록 가드 추가
    if (!user || !user.id) {
      return; 
    }

    const connectChat = async () => {
      try {
        const nonceResponse = await getWebSocketNonce();
        const nonce = nonceResponse.data.nonce;
        
        const wsUrl = `ws://127.0.0.1:8000/ws/chat/${roomId}/?nonce=${nonce}`;
        const ws = new WebSocket(wsUrl);
        chatSocketRef.current = ws;

        ws.onopen = () => console.log("✅ Chat WebSocket open");
        ws.onclose = () => console.log("❌ Chat WebSocket closed");

        ws.onmessage = (e) => {
          const data = JSON.parse(e.data);

          if (data.type === 'history') {
            const historyMessages = data.messages.map((msg: any, index: number) => ({
              id: msg.id || `hist-${index}`,
              userId: msg.user_id,
              username: msg.username || "system",
              message: msg.message || "",
              timestamp: msg.created_at,
              status: 'sent' as const,
            }));
            setMessages(historyMessages);
          } 
          else if (data.type === 'new_message') {
            const newMessageData = data.message;
            if (newMessageData && newMessageData.message) {
              const receivedMessage = {
                id: newMessageData.id,
                userId: newMessageData.user_id,
                username: newMessageData.username || "system",
                message: newMessageData.message,
                timestamp: newMessageData.created_at,
                status: 'sent' as const,
              };

              setMessages((prevMessages) => {
                if (receivedMessage.userId === user.id) { // user가 null이 아님을 보장
                    const newMessages = prevMessages.filter(msg => !(msg.status === 'sending' && msg.userId === user.id));
                    return [...newMessages, receivedMessage];
                }
                return [...prevMessages, receivedMessage];
              });
            }
          }
        };
      } catch (error) {
        console.error("채팅 WebSocket 연결 실패:", error);
        Alert.alert("연결 오류", "채팅 서버에 연결할 수 없습니다.");
      }
    };

    connectChat();

    // ✨ 해결책: 컴포넌트가 사라지거나 재연결될 때 이전 연결을 확실히 종료
    return () => {
      if (chatSocketRef.current) {
        chatSocketRef.current.onmessage = null; // 이벤트 핸들러 정리
        chatSocketRef.current.close();
      }
    };
  }, [roomId, user?.id]);


  const sendMessage = () => {
    const ws = chatSocketRef.current;
    const text = newMessage.trim();
    // ✨ 개선 사항: 비어있는 메시지 전송 방지
    if (!ws || ws.readyState !== WebSocket.OPEN || !text) {
        return;
    }

    // ✨ 개선 사항: 낙관적 UI 업데이트
    const optimisticMessage: ChatMessage = {
      id: Date.now(), // 임시 고유 ID
      userId: user!.id,
      username: user!.name,
      message: text,
      timestamp: new Date().toISOString(),
      status: 'sending',
    };

    setMessages(prev => [...prev, optimisticMessage]);
    ws.send(JSON.stringify({ message: text }));
    setNewMessage("");
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // ✨ 개선 사항: 전송 버튼 활성화/비활성화 상태
  const isSendDisabled = newMessage.trim() === "";
  let lastMessageDate: string | null = null;

  return (
    <View style={{ marginTop: 10 }}>
      <View style={styles.chatContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatScroll}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, index) => {
            const isMyMessage = msg.userId === user?.id;
            
            // ✨ 개선 사항: 날짜 구분선 로직
            const currentDate = getDisplayDate(msg.timestamp);
            const showDateSeparator = currentDate !== lastMessageDate;
            lastMessageDate = currentDate;

            return (
              <React.Fragment key={msg.id}>
                {showDateSeparator && (
                  <View style={styles.dateSeparator}>
                    <Text style={styles.dateSeparatorText}>--- {currentDate} ---</Text>
                  </View>
                )}
                {/* ✨ 개선 사항: 타임스탬프 위치 변경을 위한 새로운 레이아웃 */}
                <View style={[styles.messageRow, isMyMessage ? styles.myMessageRow : styles.otherMessageRow]}>
                  <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble, msg.status === 'sending' && { opacity: 0.6 }]}>
                    {!isMyMessage && <Text style={styles.messageUser}>{msg.username}</Text>}
                    {/* ✨ 개선 사항: 링크 인식을 위해 MessageTextRenderer 사용 */}
                    <MessageTextRenderer 
                      text={msg.message} 
                      style={isMyMessage ? styles.myMessageText : styles.otherMessageText} 
                      linkStyle={styles.linkText}
                    />
                  </View>
                  <Text style={styles.timestamp}>{formatTimestamp(msg.timestamp)}</Text>
                </View>
              </React.Fragment>
            );
          })}
        </ScrollView>

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
          <TouchableOpacity
            style={[styles.sendButton, isSendDisabled && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={isSendDisabled}
          >
            <Text style={styles.sendButtonText}>전송</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chatContainer: { backgroundColor: "#1C1C1E", borderRadius: 8, padding: 10, height: 300 },
  chatScroll: { flex: 1, backgroundColor: "#2C2C2E", borderRadius: 8, padding: 10, marginVertical: 5 },
  // ✨ 개선 사항: 메시지 한 줄(버블+타임스탬프)을 위한 스타일
  messageRow: { flexDirection: 'row', marginVertical: 4, alignItems: 'flex-end', maxWidth: '80%', gap: 8, },
  myMessageRow: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  otherMessageRow: { alignSelf: 'flex-start' },
  messageBubble: { padding: 10, borderRadius: 12 },
  myMessageBubble: { backgroundColor: "#007AFF" },
  otherMessageBubble: { backgroundColor: "#3A3A3C" },
  messageUser: { fontSize: 13, fontWeight: 'bold', color: "#E2C044", marginBottom: 4 },
  myMessageText: { fontSize: 15, color: "#fff" },
  otherMessageText: { fontSize: 15, color: "#fff" },
  // ✨ 개선 사항: 링크 텍스트 스타일
  linkText: { color: '#6EB5FF', textDecorationLine: 'underline' },
  timestamp: { fontSize: 11, color: "#999" },
  chatInputContainer: { flexDirection: "row", alignItems: "center" },
  chatInput: { flex: 1, backgroundColor: "#3A3A3C", borderRadius: 18, paddingHorizontal: 15, color: "#fff", height: 40, paddingVertical: 10 },
  sendButton: { marginLeft: 8, backgroundColor: "#E2C044", borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  // ✨ 개선 사항: 비활성화된 전송 버튼 스타일
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: "#000", fontWeight: "bold" },
  // ✨ 개선 사항: 날짜 구분선 스타일
  dateSeparator: { alignSelf: 'center', marginVertical: 10 },
  dateSeparatorText: { color: '#888', fontSize: 12 },
});

export default ChatBox;