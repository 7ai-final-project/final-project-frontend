import { useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
// ✅ storage에서 토큰을 가져오기 위해 import를 유지합니다.
import { storage } from "../../../../services/storage";
import {
  fetchRoomDetail,
  joinRoom,
  leaveRoom,
  toggleReady,
  startGame,
  endGame,
} from "../../../../services/api";
import ChatBox from "../../../../components/chat/ChatBox";
import { useWebSocket } from "@//components/context/WebSocketContext";
import { useAuth } from '../../../../hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';

// ✅ 새로운 API 호출을 위해 import
import { getWebSocketNonce } from "../../../../services/api";

// --- 인터페이스 정의 ---
interface Participant {
  id: string;
  username: string;
  is_ready: boolean;
}

interface RoomType {
  id: string;
  name: string;
  description: string;
  owner: string;
  max_players: number;
  status: string;
  participants: Participant[];
}

// --- 컴포넌트 시작 ---
export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roomId = id as string;

  // --- 상태 변수 선언 ---
  const [room, setRoom] = useState<RoomType | null>(null);
  const [wsMsg, setWsMsg] = useState<string>("");
  const { wsRef } = useWebSocket();

  const [isCountdownModalVisible, setIsCountdownModalVisible] = useState(false);
  const [countdownModalContent, setCountdownModalContent] = useState("");
  const [isTopicModalVisible, setIsTopicModalVisible] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const topics = ["해와달", "구운몽", "이상한 나라의 앨리스"];
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const difficulties = ["초급", "중급", "상급"];
  const [selectedMode, setSelectedMode] = useState<string>("동시 선택");
  const modes = ["동시 선택", "턴제"];
  const [isChatVisible, setIsChatVisible] = useState<boolean>(false);
  const chatSocketRef = useRef<WebSocket | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const selectedModeRef = useRef(selectedMode);
  
  // ✅ useAuth 훅에서 user 객체와 인증 로딩 상태를 가져옵니다.
  const { user, loading: authLoading } = useAuth();

  // --- useEffect Hooks ---
  useEffect(() => {
    selectedModeRef.current = selectedMode;
  }, [selectedMode]);

  useEffect(() => {
    const joinAndLoadRoom = async () => {
      if (!roomId) return;
      try {
        const res = await joinRoom(roomId); 
        setRoom(res.data);
      } catch (error: any) {
        console.error("방에 참가하거나 정보를 불러오는데 실패했습니다:", error);
        if (error.response?.data?.detail) {
          Alert.alert("입장 실패", error.response.data.detail);
        } else {
          Alert.alert("오류", "방에 입장할 수 없습니다.");
        }
        router.replace("/game/multi");
      }
    };

    // ✅ 웹소켓 연결 함수 수정
    const connectWebSocket = async (token: string) => {
      try {
        // 1. 서버에 nonce 발급 요청
        // API 인터셉터가 토큰을 자동으로 추가하므로, 인자 없이 호출
        const nonceResponse = await getWebSocketNonce(); 
        const nonce = nonceResponse.data.nonce;
        
        // 2. nonce를 포함한 URL로 웹소켓 연결
        const scheme = "ws";
        const backendHost = "127.0.0.1:8000";
        const url = `${scheme}://${backendHost}/ws/game/${roomId}/?nonce=${nonce}`;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => setWsMsg("📡 실시간 연결됨");
        ws.onclose = () => setWsMsg("🔌 연결 종료");
        ws.onerror = (e) => console.error("WebSocket Error:", e);

        // 웹소켓 메시지 처리
        ws.onmessage = (ev: MessageEvent) => {
          const data = JSON.parse(ev.data);
          const message = data.message;

          if (data.type === "room_broadcast" && message?.event === "game_start") {
            setWsMsg("⏳ 게임 카운트다운...");
            setIsCountdownModalVisible(true);
            const receivedMode = message.mode || message.game_mode || selectedModeRef.current;
            const gameOptions = {
              topic: message.topic,
              difficulty: message.difficulty,
              mode: receivedMode,
            };

            let secondsLeft = 5;
            const countdownText = `주제: ${gameOptions.topic}\n난이도: ${gameOptions.difficulty}\n방식: ${gameOptions.mode}\n\n${secondsLeft}초 후 게임을 시작합니다...`;
            setCountdownModalContent(countdownText);
            
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            
            countdownIntervalRef.current = setInterval(() => {
              secondsLeft -= 1;
              if (secondsLeft > 0) {
                setCountdownModalContent(
                  `주제: ${gameOptions.topic}\n난이도: ${gameOptions.difficulty}\n방식: ${gameOptions.mode}\n\n${secondsLeft}초 후 게임을 시작합니다...`
                );
              } else {
                if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                
                router.push({
                  pathname: "/game/multi/play/[id]",
                  params: {
                    id: roomId,
                    topic: gameOptions.topic,
                    difficulty: gameOptions.difficulty,
                    mode: gameOptions.mode,
                  },
                });
                
                setIsCountdownModalVisible(false);
                setCountdownModalContent("");
              }
            }, 1000);
            return;
          }

          if (data.type === "room_deleted") {
            Alert.alert("알림", "방이 삭제되어 로비로 이동합니다.", [
              { text: "확인", onPress: () => router.replace("/game/multi") },
            ]);
            return;
          }
          fetchRoomDetail(roomId).then((res) => setRoom(res.data));
        };
      } catch (error) {
        console.error("웹소켓 nonce 발급 실패:", error);
        Alert.alert("연결 실패", "안전한 웹소켓 연결 키를 발급받지 못했습니다.");
      }
    };

    // 초기화 함수
    const initialize = async () => {
      await joinAndLoadRoom();
      // ✅ useAuth로 user가 로그인 상태임이 확인되면, storage에서 토큰을 가져옵니다.
      if (user) {
        const token = await storage.getItem("access_token");
        if (token) {
          connectWebSocket(token);
        } else {
            console.error("로그인된 사용자이지만 토큰을 찾을 수 없습니다.");
            Alert.alert("인증 오류", "사용자 토큰을 찾을 수 없어 연결에 실패했습니다.");
        }
      }
    };
    
    // ✅ useAuth의 로딩이 끝난 후에만 초기화 로직을 실행합니다.
    if (!authLoading) {
        initialize();
    }

    // 컴포넌트 언마운트 시 정리 함수
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [roomId, user, authLoading]); // user와 authLoading이 변경될 때마다 effect를 재실행

  // --- 메모이제이션 변수 ---
  const isOwner = useMemo(() => room?.owner === user?.name && !!user?.name, [room, user]);
  const allReady = useMemo(() => room?.participants?.every((p) => p.is_ready) && (room?.participants?.length ?? 0) > 0, [room]);
  const canStart = isOwner && allReady && room?.status === "waiting";
  const canEnd = isOwner && room?.status === "in_game";
  const myParticipant = room?.participants?.find((p) => p.username === user?.name);

  // --- 이벤트 핸들러 ---
  const onStartGame = () => {
    if (!canStart || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert("게임 시작 조건을 만족하지 않았거나, 서버 연결이 불안정합니다.");
      return;
    }
    if (!selectedTopic || !selectedDifficulty || !selectedMode) {
      alert("주제, 난이도, 게임 방식을 모두 선택해주세요.");
      return;
    }
    wsRef.current.send(
      JSON.stringify({
        action: "start_game",
        topic: selectedTopic,
        difficulty: selectedDifficulty,
        mode: selectedMode,
      })
    );
  };

  const onEndGame = () => {
    if (!canEnd || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ action: "end_game" }));
  };

  const onToggleReady = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ action: "toggle_ready" }));
  };
  
  // --- 렌더링 ---
  if (authLoading || !room) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#E2C044" />
        <Text style={styles.text}>정보를 불러오는 중...</Text>
      </SafeAreaView>
    );
  }
  
  return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
        style={styles.scrollView} // 스크롤뷰 자체 스타일
        contentContainerStyle={styles.container} // 내부 콘텐츠 컨테이너 스타일
      >
        <View style={styles.mainContainer}>
          {/* 좌측 패널 */}
          <View style={styles.leftPanel}>
            <View style={styles.infoBox}>
              <Text style={styles.title}>#{room.name}</Text>
              <Text style={styles.desc}>{room.description}</Text>
              <View style={styles.divider} />
              <Text style={styles.status}>
                <Ionicons name="game-controller" size={14} color="#ccc" /> 상태: {room.status}
              </Text>
              <Text style={styles.status}>
                <Ionicons name="book" size={14} color="#ccc" /> 주제: {selectedTopic || "선택되지 않음"}
              </Text>
              <Text style={styles.status}>
                <Ionicons name="star" size={14} color="#ccc" /> 난이도: {selectedDifficulty || "선택되지 않음"}
              </Text>
              <Text style={styles.status}>
                <Ionicons name="swap-horizontal" size={14} color="#ccc" /> 방식: {selectedMode || "선택되지 않음"}
              </Text>
            </View>

            {isOwner && (
              <TouchableOpacity
                style={styles.gameOptionButton}
                onPress={() => setIsTopicModalVisible(true)}
              >
                <Ionicons name="settings-sharp" size={20} color="#E2C044" />
                <Text style={styles.gameOptionButtonText}>게임 옵션 설정</Text>
              </TouchableOpacity>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.btn, myParticipant?.is_ready ? styles.unreadyBtn : styles.readyBtn]}
                onPress={onToggleReady}
                disabled={room.status !== "waiting"}
              >
                <Ionicons name={myParticipant?.is_ready ? "close-circle" : "checkbox"} size={22} color="#fff" />
                <Text style={styles.btnText}>{myParticipant?.is_ready ? "준비 해제" : "준비 완료"}</Text>
              </TouchableOpacity>
              
              {isOwner && room.status === 'waiting' && (
                <TouchableOpacity
                  style={[styles.btn, styles.startBtn, !canStart && styles.btnDisabled]}
                  onPress={onStartGame}
                  disabled={!canStart}
                >
                  <Ionicons name="play-sharp" size={22} color="#fff" />
                  <Text style={styles.btnText}>게임 시작</Text>
                </TouchableOpacity>
              )}

              {isOwner && room.status === 'in_game' && (
                <TouchableOpacity
                  style={[styles.btn, styles.endBtn, !canEnd && styles.btnDisabled]}
                  onPress={onEndGame}
                  disabled={!canEnd}
                >
                  <Ionicons name="stop-circle" size={22} color="#fff" />
                  <Text style={styles.btnText}>게임 종료</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 우측 패널 */}
          <View style={styles.rightPanel}>
            <View style={styles.participantsHeader}>
              <Text style={styles.subTitle}>참가자 ({room.participants?.length || 0}/{room.max_players})</Text>
              <TouchableOpacity
                style={styles.chatBtn}
                onPress={() => setIsChatVisible(prev => !prev)}
              >
                <Ionicons name="chatbubbles" size={20} color="#E2C044" />
              </TouchableOpacity>
            </View>
            <View style={styles.participantsBox}>
              {room.participants?.map((p) => (
                <View key={p.id} style={styles.participantRow}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {room.owner === p.username && (
                      <Ionicons name="key" size={16} color="#E2C044" style={{ marginRight: 8 }} />
                    )}
                    <Text style={styles.participantName}>{p.username}</Text>
                  </View>
                  <View style={p.is_ready ? styles.ready : styles.notReady}>
                    <Ionicons name={p.is_ready ? "checkmark-circle" : "hourglass-outline"} size={16} color={p.is_ready ? "#4CAF50" : "#aaa"} />
                    <Text style={p.is_ready ? styles.readyText : styles.notReadyText}>
                      {p.is_ready ? "READY" : "WAITING"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.wsMsg}>{wsMsg}</Text>
          </View>
        </View>
      </ScrollView>
      {/* 모달 및 채팅창 */}
      <Modal
        transparent={true}
        visible={isCountdownModalVisible}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.countdownModalOverlay}>
          <View style={styles.countdownModalContentBox}>
            <Text style={styles.countdownModalText}>
              {countdownModalContent}
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        transparent={true}
        visible={isTopicModalVisible}
        animationType="fade"
        onRequestClose={() => setIsTopicModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>게임 옵션</Text>
            <Text style={styles.modalSubTitle}>주제 선택</Text>
            {topics.map((topic, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.topicOption, selectedTopic === topic && styles.topicSelected]}
                onPress={() => {
                  if (topic !== "해와달") {
                    Alert.alert("구현 예정", "이 주제는 아직 준비되지 않았습니다.");
                    return;
                  }
                  setSelectedTopic(topic);
                }}
              >
                <Text style={styles.topicText}>{topic}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.modalSubTitle}>난이도 선택</Text>
            {difficulties.map((dif, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.topicOption, selectedDifficulty === dif && styles.topicSelected]}
                onPress={() => setSelectedDifficulty(dif)}
              >
                <Text style={styles.topicText}>{dif}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.modalSubTitle}>게임 방식 선택</Text>
            {modes.map((mode, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.topicOption, selectedMode === mode && styles.topicSelected]}
                onPress={() => setSelectedMode(mode)}
              >
                <Text style={styles.topicText}>{mode}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsTopicModalVisible(false)}
            >
              <Text style={styles.topicText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {isChatVisible && <ChatBox roomId={roomId} chatSocketRef={chatSocketRef} />}
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B1021",
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flexGrow: 1, // 콘텐츠가 적어도 전체 화면을 채우도록 함
    padding: 20,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  mainContainer: { flex: 1, flexDirection: "row", gap: 20 },
  leftPanel: { width: "35%", gap: 20 },
  rightPanel: { flex: 1 },
  infoBox: {
    backgroundColor: "#161B2E",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2C344E",
    gap: 8,
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#E0E0E0", marginBottom: 4 },
  desc: { fontSize: 14, color: "#A0A0A0", marginBottom: 12, fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: '#2C344E', marginVertical: 8 },
  status: { fontSize: 14, color: "#ccc", alignItems: 'center' },
  gameOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2C044',
    gap: 8
  },
  gameOptionButtonText: {
    color: '#E2C044',
    fontWeight: 'bold',
    fontSize: 16
  },
  buttonContainer: { flex: 1, justifyContent: 'flex-end', gap: 12 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 8,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  btnText: { color: "#fff", fontSize: 18, fontWeight: 'bold' },
  readyBtn: { backgroundColor: "#1D7A50" },
  unreadyBtn: { backgroundColor: "#A0A0A0" },
  startBtn: { backgroundColor: "#7C3AED" },
  endBtn: { backgroundColor: '#E53E3E' },
  btnDisabled: { backgroundColor: "#4A5568", opacity: 0.7 },
  participantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  subTitle: { fontSize: 20, fontWeight: "bold", color: "#E2C044" },
  chatBtn: {
    padding: 8,
    backgroundColor: '#161B2E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2C344E'
  },
  participantsBox: {
    flex: 1,
    backgroundColor: "#161B2E",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2C344E",
    gap: 8,
  },
  participantRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0B1021",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  participantName: { color: "#E0E0E0", fontSize: 16 },
  ready: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notReady: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  readyText: { fontWeight: "bold", color: "#4CAF50", fontSize: 14 },
  notReadyText: { color: "#aaa", fontSize: 14 },
  wsMsg: { fontSize: 12, color: "#aaa", textAlign: "center", marginTop: 10 },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalBox: {
    width: "35%",
    backgroundColor: "#161B2E",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2C344E'
  },
  modalTitle: {
    fontSize: 20,
    color: "#E0E0E0",
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: "center",
  },
  modalSubTitle: { color: '#A0A0A0', marginBottom: 10, fontSize: 16 },
  topicOption: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#2C344E",
    marginVertical: 6,
  },
  topicSelected: { backgroundColor: "#7C3AED", borderWidth: 0 },
  topicText: { color: "#fff", textAlign: "center", fontWeight: 'bold' },
  modalCloseButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#4A5568",
    marginTop: 20
  },
  countdownModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  countdownModalContentBox: {
    width: '40%',
    backgroundColor: '#161B2E',
    borderRadius: 15,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C344E'
  },
  countdownModalText: {
    color: '#E0E0E0',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 32,
  },
  text: { color: '#fff' }
});