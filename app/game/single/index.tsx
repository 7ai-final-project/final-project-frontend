import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ImageBackground,
} from 'react-native';
import { Audio } from "expo-av";
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { router, useFocusEffect } from 'expo-router'; // This part is correct
import {
  fetchScenarios,
  fetchDifficulties,
  fetchModes,
  fetchGenres,
  fetchCharactersByTopic,
  Character as ApiCharacter,
  checkSingleGameSession,
} from '../../../services/api';
import { useSettings } from '../../../components/context/SettingsContext';

// --- 인터페이스 정의 ---
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
interface LoadedSessionData {
  id: string;
  scenario: string;
  difficulty: string;
  genre: string;
  mode: string;
  character: string;
  choice_history: any;
  character_history: any;
  status: string;
}


// --- 색상 및 공통 스타일 변수 정의 ---
const COLORS = {
  primary: '#E2C044', // 강조 색상
  background: '#0B1021', // 전체 배경
  cardBackground: '#161B2E', // 카드 및 모달 배경
  border: '#2C344E', // 경계선
  text: '#E0E0E0', // 일반 텍스트
  subText: '#A0A0A0', // 서브 텍스트
  selected: '#7C3AED', // 선택된 항목
  button: '#4A5568', // 버튼
  cancelButton: '#E53E3E', // 취소 버튼
};

const FONT_SIZES = {
  title: 28,
  subTitle: 16,
  cardTitle: 20,
  cardDescription: 14,
};

const scenarioImages = [
  require('../../../assets/images/game/single/back_1.jpg'),
  require('../../../assets/images/game/single/back_2.jpg'),
  require('../../../assets/images/game/single/back_3.jpg'),
  require('../../../assets/images/game/single/back_4.jpg'),
  require('../../../assets/images/game/single/back_5.jpg'),
];

// --- 컴포넌트 시작 ---
export default function GameStarterScreen() {
  const [fontsLoaded, fontError] = useFonts({
    'neodgm': require('../../../assets/fonts/neodgm.ttf'),
  });

  const [isNotificationModalVisible, setNotificationModalVisible] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState({ title: '', body: '' });

  const {
    isBgmOn,
    setIsBgmOn,
    isSfxOn,
    setIsSfxOn,
    fontSizeMultiplier,
    setFontSizeMultiplier,
    language,
    setLanguage,
    isLoading: isSettingsLoading,
  } = useSettings();

  const [isLoading, setIsLoading] = useState(true);
  const [isScenarioModalVisible, setScenarioModalVisible] = useState(false);
  const [isGameStartModalVisible, setGameStartModalVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const countdownIntervalRef = useRef<number | null>(null);

  const [isContinueModalVisible, setContinueModalVisible] = useState(false);
  const [loadedSession, setLoadedSession] = useState<LoadedSessionData | null>(null);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);

  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [characters, setCharacters] = useState<ApiCharacter[]>([]);

  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [selectedDifficultyId, setSelectedDifficultyId] = useState<string | null>(null);
  const [selectedGenreId, setSelectedGenreId] = useState<string | null>(null);

  const [selectedOptions, setSelectedOptions] = useState({
    difficulty: '',
    mode: '',
    genre: '',
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const showNotification = (title: string, body: string) => {
    setNotificationMessage({ title, body });
    setNotificationModalVisible(true);
  };

  // --- useEffect Hooks ---
  const musicRef = useRef<Audio.Sound | null>(null);
  
    // ★★★ 3. 로비 화면이 나타날 때 배경 음악을 로드하고 재생합니다. ★★★
    useFocusEffect(
      useCallback(() => {
        const manageMusic = async () => {
            // BGM 설정이 켜져있을 때
            if (isBgmOn) {
            // 아직 음악이 로드되지 않았다면, 새로 로드하고 재생합니다.
            if (!musicRef.current) {
                try {
                await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
                const { sound } = await Audio.Sound.createAsync(
                    require('../../../assets/sounds/single_music.mp3'),
                    { isLooping: true }
                );
                await sound.playAsync();
                musicRef.current = sound; // 재생된 sound 객체를 state에 저장
                } catch (error) {
                console.error("배경 음악 로딩 실패:", error);
                }
            }
            // BGM 설정이 꺼졌다가 다시 켜진 경우, 기존 음악을 재생합니다.
            else {
                await musicRef.current.playAsync();
            }
            } 
            // BGM 설정이 꺼져있을 때
            else {
            // 재생 중인 음악이 있다면 정지합니다.
            if (musicRef.current) {
                await musicRef.current.stopAsync();
            }
            }
        };
  
        manageMusic();
  
        // 클린업 함수: 화면을 떠날 때 음악을 언로드합니다.
        return () => {
            if (musicRef.current) {
            musicRef.current.unloadAsync();
            musicRef.current = null; // state 초기화
            }
        };
        // 👇 중요: isBgmOn이 바뀔 때마다 이 로직이 다시 실행됩니다.
        }, [isBgmOn]) 
    );

  useEffect(() => {
    const loadGameOptions = async () => {
      try {
        setIsLoading(true);
        const [scenariosRes, difficultiesRes, genresRes] = await Promise.all([
          fetchScenarios(),
          fetchDifficulties(),
          fetchGenres(),
        ]);

        setScenarios(scenariosRes.data.results || scenariosRes.data);
        setDifficulties(difficultiesRes.data.results || difficultiesRes.data);
        setGenres(genresRes.data.results || genresRes.data);
        
      } catch (error) {
        console.error("게임 옵션 로딩 실패:", error);
        showNotification("오류", "게임 옵션 정보를 불러오는 데 실패했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    loadGameOptions();
  }, []);

  useEffect(() => {
    const loadCharacters = async () => {
      if (selectedScenario?.title) {
        console.log(`[index.tsx] 시나리오 변경 감지: ${selectedScenario.title}`);
        try {
          // fetchCharactersByTopic 함수를 사용하여 시나리오 주제에 맞는 캐릭터 목록을 가져옵니다.
          const chars = await fetchCharactersByTopic(selectedScenario.title);
          setCharacters(chars);
          console.log(`[index.tsx] 캐릭터 ${chars.length}명 로딩 완료`);
        } catch (error) {
          console.error("캐릭터 목록 로딩 실패:", error);
          showNotification("오류", "캐릭터 정보를 불러오는 데 실패했습니다.");
        }
      }
    };

    loadCharacters();
  }, [selectedScenario]);

  useEffect(() => {
    if (isGameStartModalVisible && countdown > 0) {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setGameStartModalVisible(false);
    }
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isGameStartModalVisible, countdown]);

  // --- 이벤트 핸들러 ---
  const handleOpenScenarioModal = async (scenario: Scenario) => {
    setSelectedScenario(scenario); // 먼저 현재 시나리오를 상태에 저장
    try {
      // API 호출하여 저장된 세션 확인
      const response = await checkSingleGameSession(scenario.id);
      if (response.status === 200 && response.data) {
        setLoadedSession(response.data); // 세션 데이터 저장
        setContinueModalVisible(true); // '이어서 하기' 모달 열기
      }
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        // 저장된 게임이 없으면 '새 게임' 설정 모달 열기
        handleStartNewGame();
      } else {
        console.error("세션 확인 중 오류:", error);
        showNotification("오류", "저장된 게임 정보를 확인하는 중 문제가 발생했습니다.");
      }
    }
  };

  const handleStartNewGame = () => {
    setContinueModalVisible(false); // '이어서 하기' 모달 닫기
    setSelectedDifficultyId(null);
    setSelectedGenreId(null);
    setScenarioModalVisible(true); // 옵션 설정 모달 열기
  };

  const handleContinueGame = () => {
    if (!loadedSession) return;
    setContinueModalVisible(false);
    
    router.push({
      pathname: '/game/single/play',
      params: {
        topic: loadedSession.scenario,
        difficulty: loadedSession.difficulty,
        mode: loadedSession.mode,
        genre: loadedSession.genre,
        isLoaded: 'true',
        loadedSessionData: JSON.stringify(loadedSession), // ✅ session ID 대신 전체 데이터 전달
      },
    });
  };

  const handleConfirmScenarioOptions = () => {
    if (!selectedScenario || !selectedDifficultyId || !selectedGenreId) {
      showNotification("알림", "모든 옵션을 선택해야 합니다.");
      return;
    }
    
    // ✅ [핵심 수정] 캐릭터가 아직 로딩되지 않았다면, 여기서 로딩 상태를 확인하고 대기합니다.
    if (characters.length === 0) {
      showNotification("알림", "캐릭터 정보를 불러오는 중입니다. 잠시만 기다려주세요.");
      return;
    }

    const difficultyName = difficulties.find(d => d.id === selectedDifficultyId)?.name || '';
    const genreName = genres.find(g => g.id === selectedGenreId)?.name || '';

    // 모든 준비가 완료되면 바로 라우터 이동
    setScenarioModalVisible(false);
    
    // 이 부분이 핵심입니다. 타이머 모달을 스킵하고 바로 게임 화면으로 이동합니다.
    router.push({
      pathname: '/game/single/play',
      params: {
        topic: selectedScenario?.title, 
        difficulty: difficultyName,
        genre: genreName,
        isLoaded: 'false',
        characters: JSON.stringify(characters),
      },
    });
  };

  const handleCancelGameStart = () => {
    setGameStartModalVisible(false);
    setSelectedScenario(null);
    setSelectedDifficultyId(null);
    setSelectedGenreId(null);
  };

  // ⚠️ `handleGoBack`와 `isGameLoading` 관련 코드를 제거합니다.
  // const handleGoBack = () => { setGameLoading(false); };

  const handlePrevScenario = () => {
    setCurrentScenarioIndex((prevIndex) => Math.max(0, prevIndex - 1));
  };

  const handleNextScenario = () => {
    setCurrentScenarioIndex((prevIndex) => Math.min(scenarios.length - 1, prevIndex + 1));
  };
  
  const handleGoBackToScenario = () => {
    setScenarioModalVisible(false);
  };

  const handleGoHome = () => {
    setScenarioModalVisible(false);
    setGameStartModalVisible(false);
    setSelectedScenario(null);
    setSelectedDifficultyId(null);
    setSelectedGenreId(null);
    setCurrentScenarioIndex(0);
    
    // 이 부분이 핵심입니다.
    router.push('/');
  };

  // --- UI 렌더링 ---
  // ⚠️ `isGameLoading` 조건부 렌더링 블록을 제거합니다.

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        {/* 홈 버튼 추가 */}
        <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
          <Ionicons name="home" size={24} color={COLORS.subText} />
        </TouchableOpacity>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>게임 옵션을 불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  const currentScenario = scenarios[currentScenarioIndex];
  const canGoPrev = currentScenarioIndex > 0;
  const canGoNext = currentScenarioIndex < scenarios.length - 1;

  const currentBackgroundImage = scenarioImages[currentScenarioIndex] || null;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 홈 버튼 추가 */}
      <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
        <Ionicons name="home" size={24} color={COLORS.subText} />
      </TouchableOpacity>
      <ImageBackground
        source={currentBackgroundImage}
        style={styles.backgroundImage}
        imageStyle={styles.imageStyle} // 모서리를 둥글게 하기 위한 스타일
        resizeMode="cover" // 이미지가 컨테이너를 꽉 채우도록 설정
      >
        <View style={styles.container}>
          <Text style={styles.mainTitle}>시나리오 선택</Text>
          <Text style={styles.subText}>원하는 시나리오를 선택하여 게임 옵션을 설정하세요.</Text>

          <View style={styles.scenarioCarousel}>
            {canGoPrev && (
              <TouchableOpacity style={styles.arrowButton} onPress={handlePrevScenario}>
                <Ionicons name="chevron-back" size={40} color={COLORS.primary} />
              </TouchableOpacity>
            )}
            {currentScenario && (
              <TouchableOpacity
                style={styles.scenarioCard}
                onPress={() => handleOpenScenarioModal(currentScenario)}
              >
                <Text style={styles.scenarioTitle}>{currentScenario.title}</Text>
                <Text style={styles.scenarioDescription}>{currentScenario.description}</Text>
              </TouchableOpacity>
            )}
            {canGoNext && (
              <TouchableOpacity style={styles.arrowButton} onPress={handleNextScenario}>
                <Ionicons name="chevron-forward" size={40} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ImageBackground>

      {/* 시나리오 옵션 선택 모달 */}
      <Modal
        transparent={true}
        visible={isContinueModalVisible}
        animationType="fade"
        onRequestClose={() => setContinueModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{loadedSession?.scenario}</Text>
            <Text style={styles.modalSubTitle}>지난 줄거리</Text>
            {/* 줄거리 요약 표시 */}
            <ScrollView style={styles.summaryBox}>
              <Text style={styles.summaryText}>
                {loadedSession?.choice_history?.summary || "저장된 줄거리가 없습니다."}
              </Text>
            </ScrollView>
            <Text style={styles.modalSubTitle}>어떻게 하시겠습니까?</Text>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.backButton]}
                onPress={handleStartNewGame}
              >
                <Text style={styles.buttonText}>새 게임</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleContinueGame}
              >
                <Text style={styles.buttonText}>이어서 하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        transparent={true}
        visible={isScenarioModalVisible}
        animationType="fade"
        onRequestClose={handleGoBackToScenario}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{selectedScenario?.title}</Text>
            
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
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
            </ScrollView>
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.backButton]}
                onPress={handleGoBackToScenario}
              >
                <Text style={styles.buttonText}>돌아가기</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleConfirmScenarioOptions}
              >
                <Text style={styles.buttonText}>선택 완료</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        transparent={true}
        visible={isNotificationModalVisible}
        animationType="fade"
        onRequestClose={() => setNotificationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{notificationMessage.title}</Text>
            <Text style={styles.notificationBodyText}>
              {notificationMessage.body}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton, { width: '100%', marginLeft: 0, marginTop: 10 }]}
              onPress={() => setNotificationModalVisible(false)}
            >
              <Text style={styles.buttonText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// --- 스타일 정의 ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  backgroundImage: {
    width: '90%',
    height: '85%',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#47555fff',
    borderRadius: 50
  },
  imageStyle: {
    borderRadius: 50,
    opacity: 0.3,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  mainTitle: {
    fontSize: FONT_SIZES.title,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 5,
    fontFamily: 'neodgm',
  },
  subText: {
    fontSize: FONT_SIZES.subTitle,
    color: COLORS.subText,
    marginBottom: 20,
    fontFamily: 'neodgm',
  },
  scenarioCarousel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  arrowButton: {
    padding: 10,
  },
  scenarioCard: {
    backgroundColor: COLORS.cardBackground,
    padding: 25,
    borderRadius: 12,
    marginHorizontal: 15,
    width: "60%",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  scenarioTitle: {
    fontSize: FONT_SIZES.cardTitle,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 5,
    fontFamily: 'neodgm',
  },
  scenarioDescription: {
    fontSize: FONT_SIZES.cardDescription,
    color: COLORS.subText,
    textAlign: 'center',
    fontFamily: 'neodgm',
  },
  loadingText: { color: COLORS.text, marginTop: 10, fontFamily: 'neodgm', },

  // 모달 공통 스타일
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalBox: {
    width: "40%",
    maxHeight: "80%",
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 25,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalScrollView: {
    flexGrow: 0,
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 22,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: "center",
    fontFamily: 'neodgm',
  },
  modalSubTitle: { color: COLORS.subText, marginBottom: 10, fontSize: 16, fontFamily: 'neodgm', },
  topicOption: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.border,
    marginVertical: 6,
  },
  topicSelected: {
    backgroundColor: COLORS.selected,
    borderWidth: 0,
  },
  topicText: { color: '#fff', textAlign: 'center', fontWeight: 'bold', fontFamily: 'neodgm', },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    backgroundColor: COLORS.subText,
    marginRight: 10,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    marginLeft: 10,
  },
  buttonText: {
    color: COLORS.background,
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'neodgm',
  },

  // 카운트다운 모달
  countdownModalBox: {
    width: '40%',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 15,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countdownTitle: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    fontFamily: 'neodgm',
  },
  selectedOptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionLabel: {
    color: COLORS.subText,
    fontSize: 16,
    marginRight: 10,
    fontFamily: 'neodgm',
  },
  optionValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'neodgm',
  },
  countdownText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 25,
    fontFamily: 'neodgm',
  },
  cancelButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.cancelButton,
    width: '50%',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'neodgm',
  },
  summaryBox: {
    width: '100%',
    maxHeight: 150,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    },
  summaryText: {
    fontSize: 14,
    color: '#D4D4D4',
    lineHeight: 22,
    fontFamily: 'neodgm',
  },
  notificationBodyText: {
    fontSize: FONT_SIZES.subTitle,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'neodgm',
    lineHeight: 24,
  },
});