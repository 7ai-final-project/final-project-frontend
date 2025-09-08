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
  Pressable,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { storage } from "../../../../services/storage";
import {
  fetchRoomDetail,
  joinRoom,
  getWebSocketNonce,
  // API: 새로 추가된 API 호출 함수들을 import 합니다.
  fetchScenarios,
  fetchDifficulties,
  fetchModes,
  saveRoomOptions,
  fetchGenres,
  leaveRoom,
} from "../../../../services/api";
import ChatBox from "../../../../components/chat/ChatBox";
import { useWebSocket } from "@//components/context/WebSocketContext";
import { useAuth } from '../../../../hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';

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
  selected_by_room: Participant[];
}

// API: 서버에서 받아올 게임 옵션 데이터 타입을 정의합니다.
interface Scenario {
  id: string;
  title: string;
  description: string;
}
interface Difficulty {
  id: string;
  name: string;
}
interface Mode {
  id: string;
  name: string;
}
interface Genre {
  id: string;
  name: string;
}


// --- 컴포넌트 시작 ---
export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roomId = id as string;

  // --- 상태 변수 선언 ---
  const [room, setRoom] = useState<RoomType | null>(null);
  const [wsMsg, setWsMsg] = useState<string>("");
  const { wsRef } = useWebSocket();
  const { user, loading: authLoading } = useAuth();

  const [isCountdownModalVisible, setIsCountdownModalVisible] = useState(false);
  const [countdownModalContent, setCountdownModalContent] = useState("");
  const [isTopicModalVisible, setIsTopicModalVisible] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState<boolean>(false);
  const [isLeaveModalVisible, setIsLeaveModalVisible] = useState(false);

  const chatSocketRef = useRef<WebSocket | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // State: 하드코딩된 배열을 제거하고, API로부터 받아올 목록과 유저가 선택한 ID를 저장할 state를 선언합니다.
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [modes, setModes] = useState<Mode[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]); // Genre 인터페이스도 추가해야 함

  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [selectedDifficultyId, setSelectedDifficultyId] = useState<string | null>(null);
  const [selectedModeId, setSelectedModeId] = useState<string | null>(null);
  const [selectedGenreId, setSelectedGenreId] = useState<string | null>(null);

  // --- useEffect Hooks ---
  useEffect(() => {
    // API로부터 게임 옵션 목록을 불러오는 함수
    const loadGameOptions = async () => {
      try {
        const [scenariosRes, difficultiesRes, modesRes, genresRes] = await Promise.all([
          fetchScenarios(),
          fetchDifficulties(),
          fetchModes(),
          fetchGenres(),
        ]);
        
        setScenarios(scenariosRes.data.results || scenariosRes.data);
        setDifficulties(difficultiesRes.data.results || difficultiesRes.data);
        setModes(modesRes.data.results || modesRes.data);
        setGenres(genresRes.data.results || genresRes.data);

        // 기본값 설정 (첫 번째 항목으로)
        if (modesRes.data.length > 0 && !selectedModeId) {
          setSelectedModeId(modesRes.data[0].id);
        }

      } catch (error) {
        console.error("게임 옵션 로딩 실패:", error);
        Alert.alert("오류", "게임 옵션 정보를 불러오는 데 실패했습니다.");
      }
    };

    const joinAndLoadRoom = async () => {
      if (!roomId) return;
      try {
        const res = await joinRoom(roomId);
        setRoom(res.data);
      } catch (error: any) {
        console.error("방 참가 실패:", error);
        Alert.alert("입장 실패", error.response?.data?.detail || "방에 입장할 수 없습니다.");
        router.replace("/game/multi");
      }
    };

    const connectWebSocket = async () => {
      try {
        const nonceResponse = await getWebSocketNonce();
        const nonce = nonceResponse.data.nonce;

        const scheme = "ws";
        const backendHost = "127.0.0.1:8000";
        const url = `${scheme}://${backendHost}/ws/game/${roomId}/?nonce=${nonce}`;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => setWsMsg("📡 실시간 연결됨");
        ws.onclose = () => setWsMsg("🔌 연결 종료");
        ws.onerror = (e) => console.error("WebSocket Error:", e);

        ws.onmessage = (ev: MessageEvent) => {
          const data = JSON.parse(ev.data);
          const message = data.message;

          if (data.type === "room_broadcast" && message?.event === "game_start") {
            setWsMsg("⏳ 게임 카운트다운...");
            setIsCountdownModalVisible(true);
            const gameOptions = {
              topic: message.topic,
              difficulty: message.difficulty,
              mode: message.mode,
              genre: message.genre,
            };

            let secondsLeft = 5;
            const countdownText = `주제: ${gameOptions.topic}\n난이도: ${gameOptions.difficulty}\n방식: ${gameOptions.mode}\n장르: ${gameOptions.genre}\n\n${secondsLeft}초 후 게임을 시작합니다...`;
            setCountdownModalContent(countdownText);
            
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            
            countdownIntervalRef.current = setInterval(() => {
              secondsLeft -= 1;
              if (secondsLeft > 0) {
                setCountdownModalContent(
                  `주제: ${gameOptions.topic}\n난이도: ${gameOptions.difficulty}\n방식: ${gameOptions.mode}\n장르: ${gameOptions.genre}\n\n${secondsLeft}초 후 게임을 시작합니다...`
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
                    genre: gameOptions.genre,
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

    const initialize = async () => {
      await Promise.all([
        joinAndLoadRoom(),
        loadGameOptions(),
      ]);

      if (user) {
        const token = await storage.getItem("access_token");
        if (token) {
          connectWebSocket();
        } else {
            console.error("로그인된 사용자이지만 토큰을 찾을 수 없습니다.");
            Alert.alert("인증 오류", "사용자 토큰을 찾을 수 없어 연결에 실패했습니다.");
        }
      }
    };
    
    if (!authLoading) {
      initialize();
    }

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [roomId, user, authLoading]);

  // --- 메모이제이션 변수 ---
  const isOwner = useMemo(() => room?.owner === user?.name && !!user?.name, [room, user]);
  const allReady = useMemo(() => room?.selected_by_room?.every((p) => p.is_ready) && (room?.selected_by_room?.length ?? 0) > 0, [room]);
  const canStart = isOwner && allReady && room?.status === "waiting" && !!selectedScenarioId && !!selectedDifficultyId && !!selectedModeId && !!selectedGenreId;
  const myParticipant = room?.selected_by_room?.find((p) => p.username === user?.name);

  const selectedScenarioTitle = useMemo(() => scenarios.find(s => s.id === selectedScenarioId)?.title, [scenarios, selectedScenarioId]);
  const selectedDifficultyName = useMemo(() => difficulties.find(d => d.id === selectedDifficultyId)?.name, [difficulties, selectedDifficultyId]);
  const selectedModeName = useMemo(() => modes.find(m => m.id === selectedModeId)?.name, [modes, selectedModeId]);
  const selectedGenreName = useMemo(() => genres.find(g => g.id === selectedGenreId)?.name, [genres, selectedGenreId]);


  // --- 이벤트 핸들러 ---
  const handleLeaveRoom = async () => {
    if (!roomId) return;
    try {
      await leaveRoom(roomId);
      Alert.alert("알림", "방에서 나갔습니다.");
      // 모달을 닫고 멀티플레이 로비 화면으로 이동
      setIsLeaveModalVisible(false);
      router.replace("/game/multi");
    } catch (error) {
      console.error("방 나가기 실패:", error);
      Alert.alert("오류", "방을 나가는 데 실패했습니다.");
      setIsLeaveModalVisible(false);
    }
  };

  const handleOptionSelect = async () => {
    if (!isOwner) return;

    // 모든 옵션이 선택되었는지 확인
    if (!selectedScenarioId || !selectedDifficultyId || !selectedModeId || !selectedGenreId) {
      Alert.alert("알림", "주제, 장르, 난이도, 게임 방식을 모두 선택해야 합니다.");
      return;
    }

    const payload = {
      scenario: selectedScenarioId,
      difficulty: selectedDifficultyId,
      mode: selectedModeId,
      genre: selectedGenreId,
    };
    
    try {
      await saveRoomOptions(roomId, payload);
      setIsTopicModalVisible(false);
    } catch (error) {
      console.error("옵션 저장 실패:", error);
      Alert.alert("오류", "옵션 저장에 실패했습니다.");
    }
  };

  const onStartGame = () => {
    if (!canStart || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      Alert.alert("시작 불가", "모든 플레이어가 준비하고 게임 옵션을 모두 선택해야 시작할 수 있습니다.");
      return;
    }
    wsRef.current.send(JSON.stringify({ action: "start_game" }));
  };

  const onEndGame = () => {
    if (!isOwner || room?.status !== 'play' || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
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
        style={styles.scrollView}
        contentContainerStyle={styles.container}
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
                <Ionicons name="book" size={14} color="#ccc" /> 주제: {selectedScenarioTitle || "선택되지 않음"}
              </Text>
              <Text style={styles.status}>
                <Ionicons name="color-palette" size={14} color="#ccc" /> 장르: {selectedGenreName || "선택되지 않음"}
              </Text>
              <Text style={styles.status}>
                <Ionicons name="star" size={14} color="#ccc" /> 난이도: {selectedDifficultyName || "선택되지 않음"}
              </Text>
              <Text style={styles.status}>
                <Ionicons name="swap-horizontal" size={14} color="#ccc" /> 방식: {selectedModeName || "선택되지 않음"}
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

              {isOwner && room.status === 'play' && (
                <TouchableOpacity
                  style={[styles.btn, styles.endBtn]}
                  onPress={onEndGame}
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
              <Text style={styles.subTitle}>참가자 ({room.selected_by_room?.length || 0}/{room.max_players})</Text>
              <View style={styles.headerButtonContainer}>
                {/* 방 나가기 버튼을 이곳으로 이동 */}
                <TouchableOpacity
                  style={styles.headerIconBtn}
                  onPress={() => setIsLeaveModalVisible(true)}
                >
                  <Ionicons name="exit-outline" size={24} color="#E0E0E0" />
                </TouchableOpacity>

                {/* 기존 채팅 버튼 */}
                <TouchableOpacity
                  style={styles.headerIconBtn}
                  onPress={() => setIsChatVisible(prev => !prev)}
                >
                  <Ionicons name="chatbubbles" size={20} color="#E2C044" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.participantsBox}>
              {room.selected_by_room?.map((p) => (
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
            
            <ScrollView 
              style={styles.modalScrollView} 
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalSubTitle}>주제 선택</Text>
              {scenarios.map((scenario) => (
                <TouchableOpacity
                  key={scenario.id}
                  style={[styles.topicOption, selectedScenarioId === scenario.id && styles.topicSelected]}
                  onPress={() => setSelectedScenarioId(scenario.id)}
                >
                  <Text style={styles.topicText}>{scenario.title}</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.modalSubTitle}>장르 선택</Text>
              {genres.map((genre) => (
                <TouchableOpacity
                  key={genre.id}
                  style={[styles.topicOption, selectedGenreId === genre.id && styles.topicSelected]}
                  onPress={() => setSelectedGenreId(genre.id)}
                >
                  <Text style={styles.topicText}>{genre.name}</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.modalSubTitle}>난이도 선택</Text>
              {difficulties.map((dif) => (
                <TouchableOpacity
                  key={dif.id}
                  style={[styles.topicOption, selectedDifficultyId === dif.id && styles.topicSelected]}
                  onPress={() => setSelectedDifficultyId(dif.id)}
                >
                  <Text style={styles.topicText}>{dif.name}</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.modalSubTitle}>게임 방식 선택</Text>
              {modes.map((mode) => (
                <TouchableOpacity
                  key={mode.id}
                  style={[styles.topicOption, selectedModeId === mode.id && styles.topicSelected]}
                  onPress={() => setSelectedModeId(mode.id)}
                >
                  <Text style={styles.topicText}>{mode.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={handleOptionSelect}
            >
              <Text style={styles.topicText}>선택 완료</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        transparent={true}
        visible={isLeaveModalVisible}
        animationType="fade"
        onRequestClose={() => setIsLeaveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.leaveModalBox}>
            {/* isOwner 값에 따라 다른 문구를 보여줍니다. */}
            <Text style={styles.leaveModalText}>
              {isOwner
                ? "방장이 나가면 방이 삭제됩니다.\n정말 나가시겠습니까?"
                : "방에서 나가시겠습니까?"}
            </Text>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsLeaveModalVisible(false)}
              >
                <Text style={styles.topicText}>아니요</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleLeaveRoom}
              >
                <Text style={styles.topicText}>예</Text>
              </TouchableOpacity>
            </View>
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
    flexGrow: 1,
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
    maxHeight: "80%",
    backgroundColor: "#161B2E",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2C344E'
  },
  modalScrollView: {
    flexGrow: 0,
    marginBottom: 15,
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
  text: { color: '#fff' },
  headerButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10, // 버튼 사이의 간격
  },
  headerIconBtn: {
    padding: 8,
    backgroundColor: '#161B2E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2C344E'
  },
  leaveButton: {
    position: 'absolute',
    top: 50, // 상단 safe area에 맞춰 조정 가능
    right: 20,
    zIndex: 10, // 다른 요소들 위에 보이도록 z-index 설정
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(22, 27, 46, 0.8)', // 반투명 배경
  },
  leaveModalBox: {
    width: "30%",
    backgroundColor: "#161B2E",
    borderRadius: 12,
    padding: 25,
    borderWidth: 1,
    borderColor: '#2C344E',
    alignItems: 'center',
  },
  leaveModalText: {
    fontSize: 18,
    color: "#E0E0E0",
    fontWeight: 'bold',
    marginBottom: 20,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 10,
  },
  confirmButton: {
    backgroundColor: '#E53E3E', // 빨간색 계열
  },
  cancelButton: {
    backgroundColor: '#4A5568', // 회색 계열
  }
});