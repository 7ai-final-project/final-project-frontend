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
import { useSettings } from "../../../../components/context/SettingsContext";
import OptionsModal from "../../../../components/OptionsModal"; // 옵션 모달 컴포넌트 임포트

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

const Toast: React.FC<{ message: string; visible: boolean; onHide: () => void; fontSizeMultiplier: number; }> = ({ message, visible, onHide, fontSizeMultiplier }) => {
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
            <Text style={[styles.toastText, { fontSize: 15 * fontSizeMultiplier }]}>{message}</Text>
        </Animated.View>
    );
};

// --- 컴포넌트 시작 ---
export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roomId = id as string;

  const { fontSizeMultiplier } = useSettings();

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
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false); // 옵션 모달 상태 추가

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

      ws.onmessage = (ev: MessageEvent) => {
        const data = JSON.parse(ev.data);

        if (data.type === "room_state") {
          if (roomRef.current?.status === 'play') {
            fetchRoomDetail(roomId).then((res) => setRoom(res.data));
          } else {
            setRoom((prevRoom) => {
              if (!prevRoom) return null;
              return { ...prevRoom, selected_by_room: data.selected_by_room };
            });
          }
          return;
        }

        if (data.type === "room_broadcast") {
          const message = data.message;
          if (!message) return;

          if (message.type === "options_update") {
            const { options } = message;
            setSelectedScenarioId(options.scenarioId);
            setSelectedGenreId(options.genreId);
            setSelectedDifficultyId(options.difficultyId);
            setSelectedModeId(options.modeId);
          }
          else if (message.event === "game_start") {
            if (isStartingRef.current) return;
            isStartingRef.current = true;
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
          else if (message.type === "room_deleted") {
            setNotificationModalContent({
              title: "알림",
              message: "방이 삭제되어 로비로 이동합니다.",
            });
            setNotificationModalCallback(() => () => router.replace("/game/multi"));
            setIsNotificationModalVisible(true);
          }
          return;
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
    if (notificationModalCallback) {
        notificationModalCallback();
        setNotificationModalCallback(null);
    }
};

  const handleJoinPrivateRoom = async () => {
    if (room && room.selected_by_room.length >= room.max_players) {
      setToast({ visible: true, message: "방이 가득 찼습니다." });
      return;
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
        const roomDetails = await fetchRoomDetail(roomId);
        
        if (roomDetails.data.room_type === 'private') {
          setRoom(roomDetails.data);
          setIsPasswordModalVisible(true);
        } else {
          const joinRes = await joinRoom(roomId);
          setRoom(joinRes.data);
          connectWebSocket();
        }
      } catch (error) {
        setNotificationModalContent({
            title: "오류",
            message: "방 정보를 조회하는 데 실패했습니다. 로비로 돌아갑니다.",
        });
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

  const handleOptionSelect = () => {
    if (!isOwner) return;
    if (!selectedScenarioId || !selectedDifficultyId || !selectedModeId || !selectedGenreId) {
      setToast({ visible: true, message: "모든 게임 옵션을 선택해야 합니다." });
      return;
    }
    
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

        const loadedScenario = scenarios.find(s => s.title === sessionData.scenario);
        const loadedDifficulty = difficulties.find(d => d.name === sessionData.difficulty);
        const loadedGenre = genres.find(g => g.name === sessionData.genre);
        const loadedMode = modes.find(m => m.name === sessionData.mode);
        
        if (loadedScenario && loadedDifficulty && loadedGenre && loadedMode) {
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
        wsRef.current.send(JSON.stringify({ action: "start_game" }));
      }
  };

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

      router.push({
          pathname: "/game/multi/play/[id]",
          params: {
              id: roomId,
              topic: selectedScenarioTitle || "",
              difficulty: selectedDifficultyName || "",
              isLoaded: 'true',
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
        <Text style={[styles.text, { fontSize: 16 * fontSizeMultiplier }]}>정보를 불러오는 중...</Text>
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
                <Text style={[styles.title, { fontSize: 24 * fontSizeMultiplier }]}>#{room.name}</Text>
                <Text style={[styles.desc, { fontSize: 14 * fontSizeMultiplier }]}>{room.description}</Text>
                <View style={styles.divider} />
                <View style={styles.status}>
                    <Ionicons name="game-controller" size={14 * fontSizeMultiplier} color="#ccc" />
                    <Text style={[styles.statusText, { fontSize: 15 * fontSizeMultiplier }]}>상태: {room.status}</Text>
                </View>
              </View>

              <View style={styles.optionsBox}>
                <Text style={[styles.optionsBoxTitle, { fontSize: 18 * fontSizeMultiplier }]}>게임 설정</Text>
                <View style={styles.status}>
                    <Ionicons name="book" size={14 * fontSizeMultiplier} color="#ccc" />
                    <Text style={[styles.statusText, { fontSize: 15 * fontSizeMultiplier }]}>주제: {selectedScenarioTitle || "선택되지 않음"}</Text>
                </View>
                <View style={styles.status}>
                    <Ionicons name="color-palette" size={14 * fontSizeMultiplier} color="#A78BFA" />
                    <Text style={[styles.statusText, { fontSize: 15 * fontSizeMultiplier }]}>장르: {selectedGenreName || "선택되지 않음"}</Text>
                </View>
                <View style={styles.status}>
                    <Ionicons name="star" size={14 * fontSizeMultiplier} color="#E2C044" />
                    <Text style={[styles.statusText, { fontSize: 15 * fontSizeMultiplier }]}>난이도: {selectedDifficultyName || "선택되지 않음"}</Text>
                </View>
                <View style={styles.status}>
                    <Ionicons name="swap-horizontal" size={14 * fontSizeMultiplier} color="#ccc" />
                    <Text style={[styles.statusText, { fontSize: 15 * fontSizeMultiplier }]}>방식: {selectedModeName || "선택되지 않음"}</Text>
                </View>
              </View>

              {isOwner && (
                <View style={styles.ownerButtonRow}>
                  <TouchableOpacity 
                    style={[styles.gameOptionButton, isGameLoaded && styles.btnDisabled]} 
                    onPress={() => setIsTopicModalVisible(true)}
                    disabled={isGameLoaded}
                  >
                    <Ionicons name="settings-sharp" size={20} color="#E2C044" />
                    <Text style={[styles.gameOptionButtonText, { fontSize: 16 * fontSizeMultiplier }]}>옵션 설정</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.gameOptionButton, isLoadingGame && styles.btnDisabled]} 
                    onPress={handleLoadGame}
                    disabled={isLoadingGame}
                  >
                    {isLoadingGame ? (
                      <ActivityIndicator size="small" color="#E2C044" />
                    ) : (
                      <>
                        <Ionicons name="cloud-download" size={20} color="#E2C044" />
                        <Text style={[styles.gameOptionButtonText, { fontSize: 16 * fontSizeMultiplier }]}>불러오기</Text>
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
                  <Text style={[styles.btnText, { fontSize: 18 * fontSizeMultiplier }]}>{myParticipant?.is_ready ? "준비 해제" : "준비 완료"}</Text>
                </TouchableOpacity>
                
                {isOwner && room.status === 'waiting' && (
                  <View style={{ alignItems: 'center' }}>
                    <TouchableOpacity 
                      style={[styles.btn, styles.startBtn, !canStart && styles.btnDisabled]} 
                      onPress={isGameLoaded ? onStartLoadedGame : onStartGame} 
                      disabled={!canStart}
                    >
                      <Ionicons name="play-sharp" size={22} color="#fff" />
                      <Text style={[styles.btnText, { fontSize: 18 * fontSizeMultiplier }]}>{isGameLoaded ? '불러온 게임 시작' : '새 게임 시작'}</Text>
                    </TouchableOpacity>
                    {startGameDisabledReason && (
                      <Text style={[styles.disabledReasonText, { fontSize: 13 * fontSizeMultiplier }]}>{startGameDisabledReason}</Text>
                    )}
                  </View>
                )}
                {isOwner && room.status === 'play' && (
                  <TouchableOpacity style={[styles.btn, styles.endBtn]} onPress={onEndGame}>
                    <Ionicons name="stop-circle" size={22} color="#fff" />
                    <Text style={[styles.btnText, { fontSize: 18 * fontSizeMultiplier }]}>게임 종료</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.rightPanel}>
              <View style={styles.participantsHeader}>
                <Text style={[styles.subTitle, { fontSize: 20 * fontSizeMultiplier }]}>참가자 ({room.selected_by_room?.length || 0}/{room.max_players})</Text>
                <View style={styles.headerButtonContainer}>
                  {/* 설정 버튼 추가 */}
                  <TouchableOpacity style={styles.headerIconBtn} onPress={() => setIsOptionsModalVisible(true)}>
                    <Ionicons name="settings-outline" size={20} color="#E0E0E0" />
                  </TouchableOpacity>
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
                      {room.owner === p.id && <Ionicons name="key" size={16 * fontSizeMultiplier} color="#E2C044" style={{ marginRight: 8 }} />}
                      <Text style={[styles.participantName, { fontSize: 16 * fontSizeMultiplier }]}>{p.username}</Text>
                    </View>
                    {p.is_away ? (
                      <View style={styles.awayStatus}>
                        <Ionicons name="time-outline" size={16 * fontSizeMultiplier} color="#FFC107" />
                        <Text style={[styles.awayText, { fontSize: 14 * fontSizeMultiplier }]}>자리 비움</Text>
                      </View>
                    ) : (
                      <View style={p.is_ready ? styles.ready : styles.notReady}>
                        <Ionicons name={p.is_ready ? "checkmark-circle" : "hourglass-outline"} size={16 * fontSizeMultiplier} color={p.is_ready ? "#4CAF50" : "#aaa"} />
                        <Text style={p.is_ready ? [styles.readyText, { fontSize: 14 * fontSizeMultiplier }] : [styles.notReadyText, { fontSize: 14 * fontSizeMultiplier }]}>{p.is_ready ? "READY" : "WAITING"}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ImageBackground>
              <Text style={[styles.wsMsg, { fontSize: 12 * fontSizeMultiplier }]}>{wsMsg}</Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* 옵션 모달 렌더링 */}
      <OptionsModal 
        visible={isOptionsModalVisible} 
        onClose={() => setIsOptionsModalVisible(false)} 
      />

      <Modal transparent={true} visible={isCountdownModalVisible} animationType="fade" onRequestClose={() => {}}>
        <View style={styles.countdownModalOverlay}><View style={styles.countdownModalContentBox}><Text style={[styles.countdownModalText, { fontSize: 22 * fontSizeMultiplier }]}>{countdownModalContent}</Text></View></View>
      </Modal>

      <Modal
        transparent={true}
        visible={isNotificationModalVisible}
        animationType="fade"
        onRequestClose={handleCloseNotificationModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.notificationModalBox}>
            <Text style={[styles.modalTitle, { fontSize: 20 * fontSizeMultiplier }]}>{notificationModalContent.title}</Text>
            <Text style={[styles.notificationModalMessage, { fontSize: 16 * fontSizeMultiplier }]}>{notificationModalContent.message}</Text>
            <TouchableOpacity
              style={styles.modalConfirmButton}
              onPress={handleCloseNotificationModal}
            >
              <Text style={[styles.topicText, { fontSize: 16 * fontSizeMultiplier }]}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal transparent={true} visible={isTopicModalVisible} animationType="fade" onRequestClose={() => setIsTopicModalVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalBox}><Text style={[styles.modalTitle, { fontSize: 20 * fontSizeMultiplier }]}>게임 옵션</Text><ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}><Text style={[styles.modalSubTitle, { fontSize: 16 * fontSizeMultiplier }]}>주제 선택</Text>{scenarios.map((scenario)=><TouchableOpacity key={scenario.id} style={[styles.topicOption,selectedScenarioId===scenario.id&&styles.topicSelected]} onPress={()=>setSelectedScenarioId(scenario.id)}><Text style={[styles.topicText, { fontSize: 16 * fontSizeMultiplier }]}>{scenario.title}</Text></TouchableOpacity>)}<Text style={[styles.modalSubTitle, { fontSize: 16 * fontSizeMultiplier }]}>장르 선택</Text>{genres.map((genre)=><TouchableOpacity key={genre.id} style={[styles.topicOption,selectedGenreId===genre.id&&styles.topicSelected]} onPress={()=>setSelectedGenreId(genre.id)}><Text style={[styles.topicText, { fontSize: 16 * fontSizeMultiplier }]}>{genre.name}</Text></TouchableOpacity>)}<Text style={[styles.modalSubTitle, { fontSize: 16 * fontSizeMultiplier }]}>난이도 선택</Text>{difficulties.map((dif)=><TouchableOpacity key={dif.id} style={[styles.topicOption,selectedDifficultyId===dif.id&&styles.topicSelected]} onPress={()=>setSelectedDifficultyId(dif.id)}><Text style={[styles.topicText, { fontSize: 16 * fontSizeMultiplier }]}>{dif.name}</Text></TouchableOpacity>)}<Text style={[styles.modalSubTitle, { fontSize: 16 * fontSizeMultiplier }]}>게임 방식 선택</Text>{modes.map((mode)=><TouchableOpacity key={mode.id} style={[styles.topicOption,selectedModeId===mode.id&&styles.topicSelected]} onPress={()=>setSelectedModeId(mode.id)}><Text style={[styles.topicText, { fontSize: 16 * fontSizeMultiplier }]}>{mode.name}</Text></TouchableOpacity>)}</ScrollView> <View style={[styles.modalButtonContainer, { marginTop: 15 }]}>
                    <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsTopicModalVisible(false)}>
                        <Text style={[styles.topicText, { fontSize: 16 * fontSizeMultiplier }]}>돌아가기</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalButton, styles.optionsConfirmButton]} onPress={handleOptionSelect}>
                        <Text style={[styles.topicText, { fontSize: 16 * fontSizeMultiplier }]}>선택 완료</Text>
                    </TouchableOpacity>
                </View>
                </View></View>
      </Modal>

      <Modal transparent={true} visible={isLeaveModalVisible} animationType="fade" onRequestClose={() => setIsLeaveModalVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.leaveModalBox}><Text style={[styles.leaveModalText, { fontSize: 18 * fontSizeMultiplier }]}>{isOwner?"방장이 나가면 방이 삭제됩니다.\n정말 나가시겠습니까?":"방에서 나가시겠습니까?"}</Text><View style={styles.modalButtonContainer}><TouchableOpacity style={[styles.modalButton,styles.cancelButton]} onPress={()=>setIsLeaveModalVisible(false)}><Text style={[styles.topicText, { fontSize: 16 * fontSizeMultiplier }]}>아니요</Text></TouchableOpacity><TouchableOpacity style={[styles.modalButton,styles.confirmButton]} onPress={handleLeaveRoom}><Text style={[styles.topicText, { fontSize: 16 * fontSizeMultiplier }]}>예</Text></TouchableOpacity></View></View></View>
      </Modal>
      
      <Modal transparent={true} visible={isPasswordModalVisible} animationType="fade" onRequestClose={() => setIsPasswordModalVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.passwordModalBox}><Text style={[styles.modalTitle, { fontSize: 20 * fontSizeMultiplier }]}>비밀번호를 입력하세요</Text><TextInput style={[styles.input, { fontSize: 16 * fontSizeMultiplier }]} value={passwordInput} onChangeText={setPasswordInput} secureTextEntry={true} placeholder="비밀번호" placeholderTextColor="#9CA3AF" /><View style={styles.modalButtonContainer}><TouchableOpacity style={[styles.modalButton,styles.cancelButton]} onPress={()=>{setIsPasswordModalVisible(false);router.replace("/game/multi");}}><Text style={[styles.topicText, { fontSize: 16 * fontSizeMultiplier }]}>취소</Text></TouchableOpacity><TouchableOpacity style={[styles.modalButton,styles.confirmButton]} onPress={handleJoinPrivateRoom}><Text style={[styles.topicText, { fontSize: 16 * fontSizeMultiplier }]}>입장</Text></TouchableOpacity></View></View></View>
      </Modal>

      {isChatVisible && <ChatBox roomId={roomId} chatSocketRef={chatSocketRef} />}
      <Toast
        message={toast.message}
        visible={toast.visible}
        onHide={() => setToast({ visible: false, message: "" })}
        fontSizeMultiplier={fontSizeMultiplier}
      />
    </SafeAreaView>
  );
}

// Styles...
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
    /* fontSize: 18, */ // 동적 적용
    fontWeight: 'bold',
    color: '#E0E0E0',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2C344E',
    paddingBottom: 8,
  },
  title: { /* fontSize: 24, */ fontWeight: "bold", color: "#E0E0E0", marginBottom: 4, fontFamily: 'neodgm',},
  desc: { /* fontSize: 14, */ color: "#A0A0A0", marginBottom: 12, fontStyle: 'italic', fontFamily: 'neodgm', },
  divider: { height: 1, backgroundColor: '#2C344E', marginVertical: 8 },
  status: { 
    flexDirection: 'row', // 아이콘과 텍스트를 가로로 배열
    alignItems: 'center', 
    gap: 8, 
  },
  statusText: { // 텍스트 전용 스타일 추가
    /* fontSize: 15, */ // 동적 적용
    color: "#ccc",
    fontFamily: 'neodgm',
  },
  gameOptionButton: {
    flex: 1,
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
    /* fontSize: 16, */ // 동적 적용
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
  btnText: { color: "#fff", /* fontSize: 18, */ fontWeight: 'bold', fontFamily: 'neodgm', },
  readyBtn: { backgroundColor: "#1D7A50" },
  unreadyBtn: { backgroundColor: "#A0A0A0" },
  startBtn: { backgroundColor: "#7C3AED" },
  endBtn: { backgroundColor: '#E53E3E' },
  btnDisabled: { backgroundColor: "#4A5568", opacity: 0.7 },
  disabledReasonText: {
    color: '#FBBF24',
    /* fontSize: 13, */ // 동적 적용
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
  subTitle: { /* fontSize: 20, */ fontWeight: "bold", color: "#E2C044", fontFamily: 'neodgm', },
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
  participantName: { color: "#E0E0E0", /* fontSize: 16, */ fontFamily: 'neodgm', },
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
  readyText: { fontWeight: "bold", color: "#4CAF50", /* fontSize: 14, */ fontFamily: 'neodgm', },
  notReadyText: { color: "#aaa", /* fontSize: 14, */ fontFamily: 'neodgm', },
  wsMsg: { /* fontSize: 12, */ color: "#aaa", textAlign: "center", marginTop: 10, fontFamily: 'neodgm', },
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
    /* fontSize: 20, */ // 동적 적용
    color: "#E0E0E0",
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: "center",
    fontFamily: 'neodgm',
  },
  modalSubTitle: { color: '#A0A0A0', marginBottom: 10, /* fontSize: 16, */ marginTop: 10, fontFamily: 'neodgm', },
  topicOption: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#2C344E",
    marginVertical: 6,
  },
  topicSelected: { backgroundColor: "#7C3AED", borderWidth: 0 },
  topicText: { color: "#fff", textAlign: "center", fontWeight: 'bold', fontFamily: 'neodgm', /* fontSize: 16 */ },
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
    /* fontSize: 22, */ // 동적 적용
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 32,
    fontFamily: 'neodgm',
  },
  text: { color: '#fff', fontFamily: 'neodgm', /* fontSize: 16 */ },
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
    /* fontSize: 18, */ // 동적 적용
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
    /* fontSize: 16, */ // 동적 적용
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
    /* fontSize: 16, */ // 동적 적용
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
    color: "#FFC107",
    /* fontSize: 14, */ // 동적 적용
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
    zIndex: 9999,
  },
  toastText: {
    color: '#fff',
    /* fontSize: 15, */ // 동적 적용
    fontFamily: 'neodgm',
    fontWeight: 'bold',
  },
  optionsConfirmButton: {
    backgroundColor: '#7C3AED',
  },
});