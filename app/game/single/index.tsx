import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';

import {
  fetchScenarios,
  fetchDifficulties,
  fetchModes,
  fetchGenres,
} from '../../../services/api'; 

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

// --- 컴포넌트 시작 ---
export default function GameStarterScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isScenarioModalVisible, setScenarioModalVisible] = useState(false);
  const [isGameStartModalVisible, setGameStartModalVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isGameLoading, setGameLoading] = useState(false);
  const countdownIntervalRef = useRef<number | null>(null);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [modes, setModes] = useState<Mode[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);

  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [selectedDifficultyId, setSelectedDifficultyId] = useState<string | null>(null);
  const [selectedModeId, setSelectedModeId] = useState<string | null>(null);
  const [selectedGenreId, setSelectedGenreId] = useState<string | null>(null);
  
  // 선택된 옵션의 이름들을 저장할 상태
  const [selectedOptions, setSelectedOptions] = useState({
    difficulty: '',
    mode: '',
    genre: '',
  });

  // --- useEffect Hooks ---
  useEffect(() => {
    const loadGameOptions = async () => {
      try {
        setIsLoading(true);
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
      } catch (error) {
        console.error("게임 옵션 로딩 실패:", error);
        Alert.alert("오류", "게임 옵션 정보를 불러오는 데 실패했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    loadGameOptions();
  }, []);

  useEffect(() => {
    if (isGameStartModalVisible && countdown > 0) {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setGameStartModalVisible(false);
      setGameLoading(true);
    }
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isGameStartModalVisible, countdown]);

  // --- 이벤트 핸들러 ---
  const handleOpenScenarioModal = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    // 모달을 열 때 선택 상태 초기화
    setSelectedDifficultyId(null);
    setSelectedModeId(null);
    setSelectedGenreId(null);
    setScenarioModalVisible(true);
  };
  
  const handleConfirmScenarioOptions = () => {
    if (!selectedScenario || !selectedDifficultyId || !selectedModeId || !selectedGenreId) {
      Alert.alert("알림", "모든 옵션을 선택해야 합니다.");
      return;
    }

    // 선택된 옵션의 이름을 찾아 상태에 저장
    const difficultyName = difficulties.find(d => d.id === selectedDifficultyId)?.name || '';
    const modeName = modes.find(m => m.id === selectedModeId)?.name || '';
    const genreName = genres.find(g => g.id === selectedGenreId)?.name || '';

    setSelectedOptions({
      difficulty: difficultyName,
      mode: modeName,
      genre: genreName,
    });

    setScenarioModalVisible(false);
    setGameStartModalVisible(true);
    setCountdown(5); // 카운트다운 초기화
  };

  const handleCancelGameStart = () => {
    setGameStartModalVisible(false);
    // 선택 상태 초기화
    setSelectedScenario(null);
    setSelectedDifficultyId(null);
    setSelectedModeId(null);
    setSelectedGenreId(null);
  };
  
  const handleGoBack = () => {
    setGameLoading(false);
  };
  
  // --- UI 렌더링 ---

  // 게임 로딩 화면
  if (isGameLoading) {
    return (
      <SafeAreaView style={styles.gameLoadingContainer}>
        <Text style={styles.gameLoadingText}>게임은 아직 구현 중입니다.</Text>
        <Text style={styles.gameLoadingSubText}>최대한 빨리 완성해서 돌아오겠습니다!</Text>
        <TouchableOpacity style={styles.goBackButton} onPress={handleGoBack}>
          <Text style={styles.goBackText}>돌아가기</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // 로딩 인디케이터
  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>게임 옵션을 불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.mainTitle}>시나리오 선택</Text>
        <Text style={styles.subText}>원하는 시나리오를 선택하여 게임 옵션을 설정하세요.</Text>

        <ScrollView contentContainerStyle={styles.scenarioListContainer}>
          {scenarios.map((scenario) => (
            <TouchableOpacity
              key={scenario.id}
              style={styles.scenarioCard}
              onPress={() => handleOpenScenarioModal(scenario)}
            >
              <Text style={styles.scenarioTitle}>{scenario.title}</Text>
              <Text style={styles.scenarioDescription}>{scenario.description}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 시나리오 옵션 선택 모달 */}
      <Modal
        transparent={true}
        visible={isScenarioModalVisible}
        animationType="fade"
        onRequestClose={() => setScenarioModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{selectedScenario?.title}</Text>
            
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.modalScenarioInfo}>
                <Text style={styles.scenarioDescription}>{selectedScenario?.description}</Text>
              </View>

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
              style={styles.modalConfirmButton}
              onPress={handleConfirmScenarioOptions}
            >
              <Text style={styles.confirmText}>선택 완료</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 게임 시작 확인 모달 (타이머) */}
      <Modal
        transparent={true}
        visible={isGameStartModalVisible}
        animationType="fade"
        onRequestClose={() => handleCancelGameStart()}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.countdownModalBox}>
            <Text style={styles.countdownTitle}>게임 시작</Text>
            <View style={styles.selectedOptionContainer}>
              <Text style={styles.optionLabel}>선택 시나리오:</Text>
              <Text style={styles.optionValue}>{selectedScenario?.title}</Text>
            </View>
            <View style={styles.selectedOptionContainer}>
              <Text style={styles.optionLabel}>장르:</Text>
              <Text style={styles.optionValue}>{selectedOptions.genre}</Text>
            </View>
            <View style={styles.selectedOptionContainer}>
              <Text style={styles.optionLabel}>난이도:</Text>
              <Text style={styles.optionValue}>{selectedOptions.difficulty}</Text>
            </View>
            <View style={styles.selectedOptionContainer}>
              <Text style={styles.optionLabel}>게임 방식:</Text>
              <Text style={styles.optionValue}>{selectedOptions.mode}</Text>
            </View>
            
            <Text style={styles.countdownText}>{countdown}초 뒤 게임이 시작됩니다.</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelGameStart}>
              <Text style={styles.cancelButtonText}>취소</Text>
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
  },
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  subText: {
    fontSize: FONT_SIZES.subTitle,
    color: COLORS.subText,
    marginBottom: 20,
  },
  scenarioListContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  scenarioCard: {
    backgroundColor: COLORS.cardBackground,
    padding: 25,
    borderRadius: 12,
    marginBottom: 15,
    width: "80%",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  scenarioTitle: {
    fontSize: FONT_SIZES.cardTitle,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 5,
  },
  scenarioDescription: {
    fontSize: FONT_SIZES.cardDescription,
    color: COLORS.subText,
    textAlign: 'center',
  },
  loadingText: { color: COLORS.text, marginTop: 10 },

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
    color: COLORS.primary, // 시나리오 제목을 강조
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: "center",
  },
  modalScenarioInfo: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 8,
    backgroundColor: COLORS.border,
  },
  modalSubTitle: { color: COLORS.subText, marginBottom: 10, fontSize: 16 },
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
  topicText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
  modalConfirmButton: {
    padding: 15,
    borderRadius: 8,
    backgroundColor: COLORS.button,
    marginTop: 20,
    alignItems: 'center',
  },
  confirmText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
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
  },
  optionValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  countdownText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 25,
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
  },

  // 게임 구현 중 화면
  gameLoadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  gameLoadingText: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  gameLoadingSubText: {
    fontSize: 16,
    color: COLORS.subText,
    marginBottom: 20,
    textAlign: 'center',
  },
  goBackButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.button,
    marginTop: 20,
    width: '50%',
    alignItems: 'center',
  },
  goBackText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});