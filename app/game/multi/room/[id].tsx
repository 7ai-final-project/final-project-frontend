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
  TextInput,
  ImageBackground,
  Animated,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { storage } from "../../../../services/storage";
import {
  fetchRoomDetail,
  joinRoom,
  getWebSocketNonce,
  fetchScenarios,
  fetchDifficulties,
  fetchModes,
  saveRoomOptions,
  fetchGenres,
  fetchMySession,
  leaveRoom,
  Character,
  fetchCharactersByTopic,
} from "../../../../services/api";
import { useFonts } from 'expo-font';
import ChatBox from "../../../../components/chat/ChatBox";
import { useWebSocket } from "@//components/context/WebSocketContext";
import { useAuth } from '../../../../hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';

// --- 인터페이스 정의 ---
interface Participant {
  id: string;
  username: string;
  is_ready: boolean;
  is_away: boolean;
}

interface RoomType {
  id: string;
  name: string;
  description: string;
  owner: string;
  max_players: number;
  status: string;
  selected_by_room: Participant[];
  room_type: 'public' | 'private';
}

interface LoadedSessionData {
  choice_history: any[];
  character_history: {
    myCharacter: Character;
    aiCharacters: Character[];
    allCharacters: Character[];
  };
}

interface Scenario { id: string; title: string; description: string; }
interface Difficulty { id: string; name: string; }
interface Mode { id: string; name: string; }
interface Genre { id: string; name: string; }

const Toast: React.FC<{ message: string; visible: boolean; onHide: () => void; }> = ({ message, visible, onHide }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
            const timer = setTimeout(() => {
                Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onHide());
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [visible, fadeAnim, onHide]);

    if (!visible) return null;

    return (
        <Animated.View style={[styles.toastContainer, { opacity: fadeAnim }]}>
            <Text style={styles.toastText}>{message}</Text>
        </Animated.View>
    );
};

// --- 컴포넌트 시작 ---
export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roomId = id as string;

  const backgroundImages = [
    require('../../../../assets/images/game/multi/background/gameroom_image_1.png'),
    require('../../../../assets/images/game/multi/background/gameroom_image_2.png'),
  ];
   const [fontsLoaded, fontError] = useFonts({
    'neodgm': require('../../../../assets/fonts/neodgm.ttf'),
  });

  const [selectedBackgroundImage, setSelectedBackgroundImage] = useState(
    backgroundImages[Math.floor(Math.random() * backgroundImages.length)]
  );

  // --- 상태 및 Ref 선언 ---
  const [room, setRoom] = useState<RoomType | null>(null);
  const roomRef = useRef<RoomType | null>(null);

  const [characters, setCharacters] = useState<Character[]>([]);
  const charactersRef = useRef<Character[]>([]);

  const [wsMsg, setWsMsg] = useState<string>("");
  const { wsRef } = useWebSocket();
  const { user, loading: authLoading } = useAuth();

  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  const [isCountdownModalVisible, setIsCountdownModalVisible] = useState(false);
  const [countdownModalContent, setCountdownModalContent] = useState("");
  const [isTopicModalVisible, setIsTopicModalVisible] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState<boolean>(false);
  const [isLeaveModalVisible, setIsLeaveModalVisible] = useState(false);

  const [loadedSession, setLoadedSession] = useState<LoadedSessionData | null>(null);
  const [isNotificationModalVisible, setIsNotificationModalVisible] = useState(false);
  const [notificationModalContent, setNotificationModalContent] = useState({ title: "", message: "" });
  const [notificationModalCallback, setNotificationModalCallback] = useState<(() => void) | null>(null);

  const [toast, setToast] = useState({ visible: false, message: "" });

  const [isGameLoaded, setIsGameLoaded] = useState(false);
  const [isLoadingGame, setIsLoadingGame] = useState(false);
  const countdownIntervalRef = useRef<number | null>(null);
  const isStartingRef = useRef(false);
  const chatSocketRef = useRef<WebSocket | null>(null);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [modes, setModes] = useState<Mode[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);

  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [selectedDifficultyId, setSelectedDifficultyId] = useState<string | null>(null);
  const [selectedModeId, setSelectedModeId] = useState<string | null>(null);
  const [selectedGenreId, setSelectedGenreId] = useState<string | null>(null);

  // --- 핵심 로직 함수들 ---

  const loadedSessionRef = useRef<LoadedSessionData | null>(null);
  useEffect(() => {
    loadedSessionRef.current = loadedSession;
  }, [loadedSession]);

  const connectWebSocket = async () => {
    try {
      const nonceResponse = await getWebSocketNonce();
      const nonce = nonceResponse.data.nonce;
      const scheme = "wss";
      const backendHost = "team6-backend.koreacentral.cloudapp.azure.com";
      const url = `${scheme}://${backendHost}/ws/game/${roomId}/?nonce=${nonce}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setWsMsg("📡 실시간 연결됨");
      ws.onclose = () => setWsMsg("🔌 연결 종료");
      ws.onerror = (e) => console.error("WebSocket Error:", e);

      // ✨ 해결책: 메시지 처리 로직을 명확하게 분리하여 수정
      ws.onmessage = (ev: MessageEvent) => {
        const data = JSON.parse(ev.data);

        // 1. type이 최상위에 있는 메시지를 먼저 처리합니다.
        if (data.type === "room_state") {
          if (roomRef.current?.status === 'play') {
            fetchRoomDetail(roomId).then((res) => setRoom(res.data));
          } else {
            setRoom((prevRoom) => {
              if (!prevRoom) return null;
              // 참가자 목록(selected_by_room)을 새 데이터로 교체합니다.
              return { ...prevRoom, selected_by_room: data.selected_by_room };
            });
          }
          return; // 처리가 끝났으므로 함수 종료
        }

        // 2. 'room_broadcast' 타입 내부에 실제 내용이 있는 메시지를 처리합니다.
        if (data.type === "room_broadcast") {
          const message = data.message;
          if (!message) return;

          // 옵션 업데이트 처리
          if (message.type === "options_update") {
            const { options } = message;
            setSelectedScenarioId(options.scenarioId);
            setSelectedGenreId(options.genreId);
            setSelectedDifficultyId(options.difficultyId);
            setSelectedModeId(options.modeId);
          }
          // 게임 시작 처리
          else if (message.event === "game_start") {
            if (isStartingRef.current) return;
            isStartingRef.current = true;
            // ... (기존 게임 시작 카운트다운 로직은 변경 없음) ...
            setWsMsg("⏳ 게임 카운트다운...");
            setIsCountdownModalVisible(true);
            const gameOptions = {
              topic: message.topic,
              difficulty: message.difficulty,
              mode: message.mode,
              genre: message.genre,
            };

            let secondsLeft = 5;
            const countdownText = `주제: ${gameOptions.topic}\n난이도: ${gameOptions.difficulty}\n장르: ${gameOptions.genre}\n방식: ${gameOptions.mode}\n\n${secondsLeft}초 후 게임을 시작합니다...`;
            setCountdownModalContent(countdownText);
            
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

            const navParams = {
              id: roomId,
              topic: message.topic,
              difficulty: message.difficulty,
              mode: message.mode,
              genre: message.genre,
              characters: JSON.stringify(message.characters),
              participants: JSON.stringify(message.participants),
              isOwner: String(roomRef.current?.owner === user?.id),
              isLoaded: 'false', 
              loadedSessionData: undefined,
            };
            
            countdownIntervalRef.current = setInterval(() => {
              secondsLeft -= 1;
              if (secondsLeft > 0) {
                setCountdownModalContent(
                  `주제: ${gameOptions.topic}\n난이도: ${gameOptions.difficulty}\n장르: ${gameOptions.genre}\n방식: ${gameOptions.mode}\n\n${secondsLeft}초 후 게임을 시작합니다...`
                );
              } else {
                if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                
                router.push({
                    pathname: "/game/multi/play/[id]",
                    params: navParams,
                });
                          
                setIsCountdownModalVisible(false);
                setCountdownModalContent("");
              }
            }, 1000);
          }
          // 방 삭제 처리 (기존 코드의 버그 수정)
          else if (message.type === "room_deleted") {
            setNotificationModalContent({
              title: "알림",
              message: "방이 삭제되어 로비로 이동합니다.",
            });
            setNotificationModalCallback(() => () => router.replace("/game/multi"));
            setIsNotificationModalVisible(true);
          }
          return; // 처리가 끝났으므로 함수 종료
        }
      };
    } catch (error) {
      console.error("웹소켓 연결 실패:", error);
      setNotificationModalContent({
        title: "연결 실패",
        message: "안전한 웹소켓 연결에 실패했습니다.",
      });
      setIsNotificationModalVisible(true);
    }
  };

  const handleCloseNotificationModal = () => {
    setIsNotificationModalVisible(false);
    // 콜백 함수가 있으면 실행하고 초기화합니다.
    if (notificationModalCallback) {
        notificationModalCallback();
        setNotificationModalCallback(null);
    }
};

  const handleJoinPrivateRoom = async () => {
    if (room && room.selected_by_room.length >= room.max_players) {
      setToast({ visible: true, message: "방이 가득 찼습니다." });
      return; // 함수를 즉시 종료
    }
    
    if (!passwordInput) {
      setToast({ visible: true, message: "비밀번호를 입력해주세요." });
      return;
    }

    try {
      const res = await joinRoom(roomId, { password: passwordInput });
      setRoom(res.data);
      setIsPasswordModalVisible(false);
      setPasswordInput("");
      connectWebSocket();
    } catch (error: any) {
      setToast({ 
        visible: true, 
        message: error.response?.data?.detail || "비밀번호가 올바르지 않습니다." 
      });
    }
  };

  // ✅ [오류 수정 2] useMemo 선언들을 useEffect 위로 이동
  const isOwner = useMemo(() => room?.owner === user?.id && !!user?.id, [room, user]);
  const allReady = useMemo(() => room?.selected_by_room?.every((p) => p.is_ready) && (room?.selected_by_room?.length ?? 0) > 0, [room]);
  const selectedScenarioTitle = useMemo(() => scenarios.find(s => s.id === selectedScenarioId)?.title, [scenarios, selectedScenarioId]);
  const canStart = isOwner && allReady && room?.status === "waiting" && !!selectedScenarioTitle && !!selectedDifficultyId && !!selectedModeId && !!selectedGenreId && characters.length > 0;
  const myParticipant = room?.selected_by_room?.find((p) => p.id === user?.id);
  
  const selectedDifficultyName = useMemo(() => difficulties.find(d => d.id === selectedDifficultyId)?.name, [difficulties, selectedDifficultyId]);
  const selectedModeName = useMemo(() => modes.find(m => m.id === selectedModeId)?.name, [modes, selectedModeId]);
  const selectedGenreName = useMemo(() => genres.find(g => g.id === selectedGenreId)?.name, [genres, selectedGenreId]);

  const startGameDisabledReason = useMemo(() => {
    if (!isOwner) return null;
    if (room?.status !== 'waiting') return "게임이 이미 진행 중입니다.";
    if (!selectedScenarioId || !selectedDifficultyId || !selectedModeId || !selectedGenreId) {
      return "모든 게임 옵션을 선택해야 합니다.";
    }
    if (!allReady) return "모든 플레이어가 준비를 완료해야 합니다.";
    if (characters.length === 0) return "캐릭터 정보를 불러오는 중입니다...";
    return null;
  }, [isOwner, allReady, room?.status, selectedScenarioId, selectedDifficultyId, selectedModeId, selectedGenreId, characters.length]);

  useEffect(() => {
    const loadGameOptions = async () => {
      try {
        const [scenariosRes, difficultiesRes, modesRes, genresRes] = await Promise.all([
          fetchScenarios(),
          fetchDifficulties(),
          fetchModes(),
          fetchGenres(),
        ]);
        
        const scenariosData = scenariosRes.data.results || scenariosRes.data;
        const difficultiesData = difficultiesRes.data.results || difficultiesRes.data;
        const modesData = modesRes.data.results || modesRes.data;
        const genresData = genresRes.data.results || genresRes.data;

        setScenarios(scenariosData);
        setDifficulties(difficultiesData);
        setModes(modesData);
        setGenres(genresData);

        if (modesData.length > 0 && !selectedModeId) {
          setSelectedModeId(modesData[0].id);
        }
      } catch (error) {
        console.error("게임 옵션 로딩 실패:", error);
      }
    };

    
    const initialize = async () => {
      await loadGameOptions();
      if (!roomId || !user) return;

      try {
        // 1. 방 정보를 먼저 조회하여 비공개 방인지 확인합니다.
        const roomDetails = await fetchRoomDetail(roomId);
        
        if (roomDetails.data.room_type === 'private') {
          // 비공개 방이면, 비밀번호 모달을 띄웁니다.
          // setRoom은 비밀번호 입력 후 handleJoinPrivateRoom에서 처리됩니다.
          setRoom(roomDetails.data); // 모달에 방 정보를 표시하기 위해 먼저 설정
          setIsPasswordModalVisible(true);
        } else {
          // 2. ✨ 공개 방이면, 이전처럼 joinRoom의 응답을 직접 사용합니다.
          // 이 방식이 가장 안정적이고 확실합니다.
          const joinRes = await joinRoom(roomId);
          setRoom(joinRes.data);

          // 3. 방 상태가 성공적으로 설정된 후에 웹소켓을 연결합니다.
          connectWebSocket();
        }
      } catch (error) {
        setNotificationModalContent({
            title: "오류",
            message: "방 정보를 조회하는 데 실패했습니다. 로비로 돌아갑니다.",
        });
        // 모달이 닫힌 후 로비로 이동하도록 콜백 설정
        setNotificationModalCallback(() => () => router.replace("/game/multi"));
        setIsNotificationModalVisible(true);
      }
    };

    if (!authLoading && user) {
      initialize();
    }

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [roomId, user, authLoading]);
  
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { charactersRef.current = characters; }, [characters]);
  useEffect(() => {
    if (room) {
      const randomImage = backgroundImages[Math.floor(Math.random() * backgroundImages.length)];
      setSelectedBackgroundImage(randomImage);
    }
  }, [room?.id]);

  useEffect(() => {
    const loadCharacters = async () => {
      if (selectedScenarioTitle) {
        try {
          const allCharacterData = await fetchCharactersByTopic(selectedScenarioTitle);
          setCharacters(allCharacterData);
        } catch (error) {
          console.error("캐릭터 목록 사전 로딩 실패:", error);
        }
      }
    };
    loadCharacters();
  }, [selectedScenarioTitle]);

  const handleLeaveRoom = async () => {
    if (!roomId) return;
    try {
      await leaveRoom(roomId);
      setIsLeaveModalVisible(false);
      // Alert 없이 바로 페이지 이동
      router.replace("/game/multi");
    } catch (error) {
      console.error("방 나가기 실패:", error);
      setIsLeaveModalVisible(false);
      setNotificationModalContent({
        title: "오류",
        message: "방을 나가는 데 실패했습니다.",
      });
      setIsNotificationModalVisible(true);
    }
  };

  const handleGoHome = () => {
    router.replace('/'); 
  };

  const handleOptionSelect = () => { // 'async' 키워드 제거
    if (!isOwner) return;
    if (!selectedScenarioId || !selectedDifficultyId || !selectedModeId || !selectedGenreId) {
      setToast({ visible: true, message: "모든 게임 옵션을 선택해야 합니다." });
      return;
    }
    
    // 기존의 HTTP API 호출(saveRoomOptions) 대신 WebSocket으로 메시지를 전송합니다.
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        action: "set_options",
        options: {
          scenarioId: selectedScenarioId,
          difficultyId: selectedDifficultyId,
          modeId: selectedModeId,
          genreId: selectedGenreId,
        }
      }));
    }
    setIsTopicModalVisible(false);
  };

  const handleLoadGame = async () => {
    if (!roomId) return;
    setIsLoadingGame(true);
    try {
      const response = await fetchMySession(roomId);
      const sessionData = response.data;

      if (sessionData && sessionData.character_history && sessionData.choice_history) {
        setLoadedSession(sessionData);

        // 불러온 옵션 이름에 해당하는 ID를 찾습니다.
        const loadedScenario = scenarios.find(s => s.title === sessionData.scenario);
        const loadedDifficulty = difficulties.find(d => d.name === sessionData.difficulty);
        const loadedGenre = genres.find(g => g.name === sessionData.genre);
        const loadedMode = modes.find(m => m.name === sessionData.mode);
        
        // 모든 옵션 ID를 찾았는지 확인합니다.
        if (loadedScenario && loadedDifficulty && loadedGenre && loadedMode) {
          // 1. 프론트엔드 UI 상태를 업데이트합니다.
          setSelectedScenarioId(loadedScenario.id);
          setSelectedDifficultyId(loadedDifficulty.id);
          setSelectedGenreId(loadedGenre.id);
          setSelectedModeId(loadedMode.id);

          if (wsRef.current) {
            wsRef.current.send(JSON.stringify({
              action: "set_options",
              options: {
                scenarioId: loadedScenario.id,
                difficultyId: loadedDifficulty.id,
                modeId: loadedMode.id,
                genreId: loadedGenre.id,
              }
            }));
          }

          setNotificationModalContent({
            title: "불러오기 성공",
            message: "저장된 게임 설정이 적용되었습니다.\n모든 참가자가 '준비 완료'하면 게임을 시작할 수 있습니다.",
          });

          setIsGameLoaded(true);

        } else {
          setNotificationModalContent({
            title: "불러오기 오류",
            message: "저장된 게임 옵션 중 일부를 찾을 수 없습니다.",
          });
        }
      } else {
        setNotificationModalContent({
          title: "알림",
          message: "저장된 게임 기록이 없습니다.",
        });
        setLoadedSession(null);
      }
    } catch (error) {
      console.error("게임 불러오기 실패:", error);
      setNotificationModalContent({
        title: "오류",
        message: "저장된 게임을 불러오는 데 실패했거나 기록이 없습니다.",
      });
      setLoadedSession(null);
    } finally {
      setIsLoadingGame(false);
      setIsNotificationModalVisible(true);
    }
  };

  const onStartGame = () => {
      if (canStart && wsRef.current) {
        // 이 함수는 이제 '새 게임' 시작 전용입니다.
        wsRef.current.send(JSON.stringify({ action: "start_game" }));
      }
  };

  // ✅ [2단계] '불러온 게임 시작'을 위한 새 함수 추가
  const onStartLoadedGame = () => {
      if (!loadedSessionRef.current) {
          setNotificationModalContent({
            title: "오류",
            message: "불러온 게임 데이터가 없습니다.",
          });
          setIsNotificationModalVisible(true);
          return;
      }
      if (!canStart) {
          setNotificationModalContent({
            title: "알림",
            message: "모든 플레이어가 준비를 완료해야 시작할 수 있습니다.",
          });
          setIsNotificationModalVisible(true);
          return;
      }

      // WebSocket을 통하지 않고, 불러온 데이터를 가지고 바로 게임 화면으로 이동합니다.
      router.push({
          pathname: "/game/multi/play/[id]",
          params: {
              id: roomId,
              topic: selectedScenarioTitle || "",
              difficulty: selectedDifficultyName || "",
              // ✅ isLoaded 플래그를 'true'로 설정하는 것이 핵심입니다.
              isLoaded: 'true',
              // ✅ 불러온 세션 데이터를 문자열로 변환하여 전달합니다.
              loadedSessionData: JSON.stringify(loadedSessionRef.current),
              isOwner: String(isOwner),
          },
      });
  };

  const onEndGame = () => {
    if (!isOwner || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ action: "end_game" }));
  };

  const onToggleReady = () => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ action: "toggle_ready" }));
  };

  if (!fontsLoaded && !fontError) {
    return null;
  }
  
  if (authLoading || (!room && !isPasswordModalVisible)) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#E2C044" />
        <Text style={styles.text}>정보를 불러오는 중...</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.safeArea}>
      {room && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.container}
        >
          <View style={styles.mainContainer}>
            <View style={styles.leftPanel}>
              <View style={styles.infoBox}>
                <Text style={styles.title}>#{room.name}</Text>
                <Text style={styles.desc}>{room.description}</Text>
                <View style={styles.divider} />
                <Text style={styles.status}><Ionicons name="game-controller" size={14} color="#ccc" /> 상태: {room.status}</Text>
              </View>

              {/* 개선 사항: 게임 옵션을 별도의 그룹으로 묶어 가독성 향상 */}
              <View style={styles.optionsBox}>
                <Text style={styles.optionsBoxTitle}>게임 설정</Text>
                <Text style={styles.status}><Ionicons name="book" size={14} color="#ccc" /> 주제: {selectedScenarioTitle || "선택되지 않음"}</Text>
                {/* 개선 사항: 아이콘에 의미에 맞는 색상 부여 */}
                <Text style={styles.status}><Ionicons name="color-palette" size={14} color="#A78BFA" /> 장르: {selectedGenreName || "선택되지 않음"}</Text>
                <Text style={styles.status}><Ionicons name="star" size={14} color="#E2C044" /> 난이도: {selectedDifficultyName || "선택되지 않음"}</Text>
                <Text style={styles.status}><Ionicons name="swap-horizontal" size={14} color="#ccc" /> 방식: {selectedModeName || "선택되지 않음"}</Text>
              </View>

              {isOwner && (
                // ✅ [수정] 버튼들을 감싸는 View 추가
                <View style={styles.ownerButtonRow}>
                  <TouchableOpacity 
                    style={[styles.gameOptionButton, isGameLoaded && styles.btnDisabled]} 
                    onPress={() => setIsTopicModalVisible(true)}
                    disabled={isGameLoaded}
                  >
                    <Ionicons name="settings-sharp" size={20} color="#E2C044" />
                    <Text style={styles.gameOptionButtonText}>옵션 설정</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.gameOptionButton, isLoadingGame && styles.btnDisabled]} 
                    onPress={handleLoadGame}
                    disabled={isLoadingGame}
                  >
                    {/* 개선 사항: 불러오기 버튼에 로딩 인디케이터 적용 */}
                    {isLoadingGame ? (
                      <ActivityIndicator size="small" color="#E2C044" />
                    ) : (
                      <>
                        <Ionicons name="cloud-download" size={20} color="#E2C044" />
                        <Text style={styles.gameOptionButtonText}>불러오기</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
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
                  <View style={{ alignItems: 'center' }}>
                    <TouchableOpacity 
                      style={[styles.btn, styles.startBtn, !canStart && styles.btnDisabled]} 
                      onPress={isGameLoaded ? onStartLoadedGame : onStartGame} 
                      disabled={!canStart}
                    >
                      <Ionicons name="play-sharp" size={22} color="#fff" />
                      {/* 개선 사항: isGameLoaded 상태에 따라 버튼 텍스트 변경 */}
                      <Text style={styles.btnText}>{isGameLoaded ? '불러온 게임 시작' : '새 게임 시작'}</Text>
                    </TouchableOpacity>
                    {/* 개선 사항: 버튼이 비활성화된 경우, 그 이유를 텍스트로 표시 */}
                    {startGameDisabledReason && (
                      <Text style={styles.disabledReasonText}>{startGameDisabledReason}</Text>
                    )}
                  </View>
                )}
                {isOwner && room.status === 'play' && (
                  <TouchableOpacity style={[styles.btn, styles.endBtn]} onPress={onEndGame}>
                    <Ionicons name="stop-circle" size={22} color="#fff" />
                    <Text style={styles.btnText}>게임 종료</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.rightPanel}>
              <View style={styles.participantsHeader}>
                <Text style={styles.subTitle}>참가자 ({room.selected_by_room?.length || 0}/{room.max_players})</Text>
                <View style={styles.headerButtonContainer}>
                  <TouchableOpacity style={styles.headerIconBtn} onPress={handleGoHome}>
                    <Ionicons name="home-outline" size={20} color="#E0E0E0" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.headerIconBtn} onPress={() => setIsLeaveModalVisible(true)}>
                    <Ionicons name="exit-outline" size={24} color="#E0E0E0" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.headerIconBtn} onPress={() => setIsChatVisible(prev => !prev)}>
                    <Ionicons name="chatbubbles" size={20} color="#E2C044" />
                  </TouchableOpacity>
                </View>
              </View>
              <ImageBackground 
                source={selectedBackgroundImage}
                resizeMode="cover"
                style={styles.participantsBox}
                imageStyle={styles.participantsBoxImage}>
                {room.selected_by_room?.map((p) => (
                  <View key={p.id} style={styles.participantRow}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      {room.owner === p.id && <Ionicons name="key" size={16} color="#E2C044" style={{ marginRight: 8 }} />}
                      <Text style={styles.participantName}>{p.username}</Text>
                    </View>
                    {p.is_away ? (
                      <View style={styles.awayStatus}>
                        <Ionicons name="time-outline" size={16} color="#FFC107" />
                        <Text style={styles.awayText}>자리 비움</Text>
                      </View>
                    ) : (
                      <View style={p.is_ready ? styles.ready : styles.notReady}>
                        <Ionicons name={p.is_ready ? "checkmark-circle" : "hourglass-outline"} size={16} color={p.is_ready ? "#4CAF50" : "#aaa"} />
                        <Text style={p.is_ready ? styles.readyText : styles.notReadyText}>{p.is_ready ? "READY" : "WAITING"}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ImageBackground>
              <Text style={styles.wsMsg}>{wsMsg}</Text>
            </View>
          </View>
        </ScrollView>
      )}

      <Modal transparent={true} visible={isCountdownModalVisible} animationType="fade" onRequestClose={() => {}}>
        <View style={styles.countdownModalOverlay}><View style={styles.countdownModalContentBox}><Text style={styles.countdownModalText}>{countdownModalContent}</Text></View></View>
      </Modal>

      <Modal
        transparent={true}
        visible={isNotificationModalVisible}
        animationType="fade"
        onRequestClose={handleCloseNotificationModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.notificationModalBox}>
            <Text style={styles.modalTitle}>{notificationModalContent.title}</Text>
            <Text style={styles.notificationModalMessage}>{notificationModalContent.message}</Text>
            <TouchableOpacity
              style={styles.modalConfirmButton}
              onPress={handleCloseNotificationModal}
            >
              <Text style={styles.topicText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal transparent={true} visible={isTopicModalVisible} animationType="fade" onRequestClose={() => setIsTopicModalVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalBox}><Text style={styles.modalTitle}>게임 옵션</Text><ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}><Text style={styles.modalSubTitle}>주제 선택</Text>{scenarios.map((scenario)=><TouchableOpacity key={scenario.id} style={[styles.topicOption,selectedScenarioId===scenario.id&&styles.topicSelected]} onPress={()=>setSelectedScenarioId(scenario.id)}><Text style={styles.topicText}>{scenario.title}</Text></TouchableOpacity>)}<Text style={styles.modalSubTitle}>장르 선택</Text>{genres.map((genre)=><TouchableOpacity key={genre.id} style={[styles.topicOption,selectedGenreId===genre.id&&styles.topicSelected]} onPress={()=>setSelectedGenreId(genre.id)}><Text style={styles.topicText}>{genre.name}</Text></TouchableOpacity>)}<Text style={styles.modalSubTitle}>난이도 선택</Text>{difficulties.map((dif)=><TouchableOpacity key={dif.id} style={[styles.topicOption,selectedDifficultyId===dif.id&&styles.topicSelected]} onPress={()=>setSelectedDifficultyId(dif.id)}><Text style={styles.topicText}>{dif.name}</Text></TouchableOpacity>)}<Text style={styles.modalSubTitle}>게임 방식 선택</Text>{modes.map((mode)=><TouchableOpacity key={mode.id} style={[styles.topicOption,selectedModeId===mode.id&&styles.topicSelected]} onPress={()=>setSelectedModeId(mode.id)}><Text style={styles.topicText}>{mode.name}</Text></TouchableOpacity>)}</ScrollView><TouchableOpacity style={styles.modalCloseButton} onPress={handleOptionSelect}><Text style={styles.topicText}>선택 완료</Text></TouchableOpacity></View></View>
      </Modal>

      <Modal transparent={true} visible={isLeaveModalVisible} animationType="fade" onRequestClose={() => setIsLeaveModalVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.leaveModalBox}><Text style={styles.leaveModalText}>{isOwner?"방장이 나가면 방이 삭제됩니다.\n정말 나가시겠습니까?":"방에서 나가시겠습니까?"}</Text><View style={styles.modalButtonContainer}><TouchableOpacity style={[styles.modalButton,styles.cancelButton]} onPress={()=>setIsLeaveModalVisible(false)}><Text style={styles.topicText}>아니요</Text></TouchableOpacity><TouchableOpacity style={[styles.modalButton,styles.confirmButton]} onPress={handleLeaveRoom}><Text style={styles.topicText}>예</Text></TouchableOpacity></View></View></View>
      </Modal>
      
      <Modal transparent={true} visible={isPasswordModalVisible} animationType="fade" onRequestClose={() => setIsPasswordModalVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.passwordModalBox}><Text style={styles.modalTitle}>비밀번호를 입력하세요</Text><TextInput style={styles.input} value={passwordInput} onChangeText={setPasswordInput} secureTextEntry={true} placeholder="비밀번호" placeholderTextColor="#9CA3AF" /><View style={styles.modalButtonContainer}><TouchableOpacity style={[styles.modalButton,styles.cancelButton]} onPress={()=>{setIsPasswordModalVisible(false);router.replace("/game/multi");}}><Text style={styles.topicText}>취소</Text></TouchableOpacity><TouchableOpacity style={[styles.modalButton,styles.confirmButton]} onPress={handleJoinPrivateRoom}><Text style={styles.topicText}>입장</Text></TouchableOpacity></View></View></View>
      </Modal>

      {isChatVisible && <ChatBox roomId={roomId} chatSocketRef={chatSocketRef} />}
      <Toast
        message={toast.message}
        visible={toast.visible}
        onHide={() => setToast({ visible: false, message: "" })}
      />
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
  // 개선 사항: 옵션 그룹을 위한 새로운 스타일 추가
  optionsBox: {
    backgroundColor: "#161B2E",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2C344E",
    gap: 10,
    fontFamily: 'neodgm',
  },
  optionsBoxTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E0E0E0',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2C344E',
    paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#E0E0E0", marginBottom: 4, fontFamily: 'neodgm',},
  desc: { fontSize: 14, color: "#A0A0A0", marginBottom: 12, fontStyle: 'italic', fontFamily: 'neodgm', },
  divider: { height: 1, backgroundColor: '#2C344E', marginVertical: 8 },
  status: { fontSize: 15, color: "#ccc", alignItems: 'center', gap: 8, fontFamily: 'neodgm', }, // 개선 사항: 폰트 크기 및 gap 조정
  gameOptionButton: {
    flex: 1, // 개선 사항: ownerButtonRow 내에서 버튼이 공간을 균등하게 차지하도록 flex: 1 추가
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
    fontSize: 16,
    fontFamily: 'neodgm',
  },
  buttonContainer: { flex: 1, justifyContent: 'flex-end', gap: 12 },
  btn: {
    width: '100%',
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
  btnText: { color: "#fff", fontSize: 18, fontWeight: 'bold', fontFamily: 'neodgm', },
  readyBtn: { backgroundColor: "#1D7A50" },
  unreadyBtn: { backgroundColor: "#A0A0A0" },
  startBtn: { backgroundColor: "#7C3AED" },
  endBtn: { backgroundColor: '#E53E3E' },
  btnDisabled: { backgroundColor: "#4A5568", opacity: 0.7 },
  // 개선 사항: '게임 시작' 버튼 비활성화 이유 텍스트 스타일 추가
  disabledReasonText: {
    color: '#FBBF24', // 눈에 띄는 경고 색상
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
    fontFamily: 'neodgm',
  },
  participantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  subTitle: { fontSize: 20, fontWeight: "bold", color: "#E2C044", fontFamily: 'neodgm', },
  chatBtn: {
    padding: 8,
    backgroundColor: '#161B2E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2C344E'
  },
  participantsBox: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2C344E",
    gap: 8,
    overflow: "hidden",
    minHeight: 200,
  },
  participantsBoxImage: {
    opacity: 0.5,
    width: '100%',
    height: '100%',
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
  participantName: { color: "#E0E0E0", fontSize: 16, fontFamily: 'neodgm', },
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
  readyText: { fontWeight: "bold", color: "#4CAF50", fontSize: 14, fontFamily: 'neodgm', },
  notReadyText: { color: "#aaa", fontSize: 14, fontFamily: 'neodgm', },
  wsMsg: { fontSize: 12, color: "#aaa", textAlign: "center", marginTop: 10, fontFamily: 'neodgm', },
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
    fontFamily: 'neodgm',
  },
  modalSubTitle: { color: '#A0A0A0', marginBottom: 10, fontSize: 16, marginTop: 10, fontFamily: 'neodgm', },
  topicOption: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#2C344E",
    marginVertical: 6,
  },
  topicSelected: { backgroundColor: "#7C3AED", borderWidth: 0 },
  topicText: { color: "#fff", textAlign: "center", fontWeight: 'bold', fontFamily: 'neodgm', },
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
    fontFamily: 'neodgm',
  },
  text: { color: '#fff', fontFamily: 'neodgm', },
  headerButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(22, 27, 46, 0.8)',
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
    fontFamily: 'neodgm',
  },
  passwordModalBox: {
    width: "30%",
    backgroundColor: "#161B2E",
    borderRadius: 12,
    padding: 25,
    borderWidth: 1,
    borderColor: '#2C344E',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "white",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
    borderColor: "#131A33",
    borderWidth: 1,
    fontFamily: 'neodgm',
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
    backgroundColor: '#E53E3E',
  },
  cancelButton: {
    backgroundColor: '#4A5568',
  },
  ownerButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  notificationModalBox: {
    width: "30%",
    backgroundColor: "#161B2E",
    borderRadius: 12,
    padding: 25,
    borderWidth: 1,
    borderColor: '#2C344E',
    alignItems: 'center',
  },
  notificationModalMessage: {
    fontSize: 16,
    color: "#D4D4D4",
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 24,
    fontFamily: 'neodgm',
  },
  modalConfirmButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#7C3AED',
  },
  awayStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  awayText: {
    fontWeight: "bold",
    color: "#FFC107", // 주황색 계열로 강조
    fontSize: 14,
    fontStyle: 'italic',
    fontFamily: 'neodgm',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 25,
    elevation: 10,
    zIndex: 9999, // 다른 요소들 위에 보이도록 zIndex 추가
  },
  toastText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'neodgm',
    fontWeight: 'bold',
  },
});