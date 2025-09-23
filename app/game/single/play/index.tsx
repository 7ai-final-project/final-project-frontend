// frontend/app/game/single/play/index.tsx (전체 코드 교체)

import React, { useState, useEffect } from "react";
import { SafeAreaView, StyleSheet, View, ScrollView, ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import GameSetup from "@/components/game/SingleGameSetup";
import GameEngineRealtime from "@/components/game/SingleGameEngineRealtime";
import { Character as ApiCharacter, continueGame } from "@/services/api"; // ✅ continueGame 임포트
import { useFonts } from 'expo-font';


// --- 타입 정의 ---
interface GameStartPayload {
  myCharacter: ApiCharacter;
  aiCharacters: ApiCharacter[];
  allCharacters: ApiCharacter[];
}
interface PlayerState {
  usedItems: string[];
  skillCooldowns: Record<string, number>;
}
// ✅ [수정] 불러온 세션 데이터의 타입을 더 명확하게 정의
interface LoadedSessionData {
  id: string; // 세션의 고유 ID
  choice_history: { summary?: string; };
  character_history: GameStartPayload; 
}
type GamePhase = 'loading' | 'summary' | 'setup' | 'playing';

export default function GameScreen() {
  const [fontsLoaded, fontError] = useFonts({
    'neodgm': require('../../../../assets/fonts/neodgm.ttf'),
  });
  const params = useLocalSearchParams<{
    topic: string; 
    difficulty: string; 
    mode: string;
    genre: string;
    isLoaded: string;
    loadedSessionData?: string;
    characters?: string;
  }>();

  const [gamePhase, setGamePhase] = useState<GamePhase>('loading');
  const [gameStartData, setGameStartData] = useState<GameStartPayload | null>(null);
  const [summary, setSummary] = useState<string>('');
  
  // ✅ [추가] '이어하기' 시 불러온 데이터를 GameEngine에 전달하기 위한 상태
  const [initialScene, setInitialScene] = useState(null);
  const [initialGameState, setInitialGameState] = useState(null);
  const [initialPlayerState, setInitialPlayerState] = useState<PlayerState | null>(null);

  const [loadedSession, setLoadedSession] = useState<LoadedSessionData | null>(null);

  // ✅ [수정] useEffect 로직을 단순화하여 무한 루프 방지
  useEffect(() => {
    // '불러오기' 게임일 경우
    if (params.isLoaded === 'true' && params.loadedSessionData) {
      try {
        const session: LoadedSessionData = JSON.parse(params.loadedSessionData);
        setLoadedSession(session); // API 호출을 위해 세션 정보 저장
        setSummary(session.choice_history?.summary || "저장된 줄거리가 없습니다.");
        setGamePhase('summary'); // 요약 화면으로 이동
      } catch (error) {
        console.error("저장된 세션 데이터 처리 실패:", error);
        router.replace('/game/single');
      }
    } 
    // '새 게임'일 경우
    else if (params.isLoaded === 'false' && params.characters) {
      setGamePhase('setup');
    }
  }, []); // 의존성 배열을 비워 최초 1회만 실행되도록 함

  const handleGameStartFromSetup = (payload: GameStartPayload) => {
    setGameStartData(payload);
    setGamePhase('playing');
  };
  
  // ✅ [수정] '이어서 시작하기' 버튼을 누르면 API를 호출하여 실제 게임 데이터를 불러옴
  const handleGameStartFromSummary = async () => {
    if (!loadedSession) return;
    setGamePhase('loading'); // 로딩 시작
    
    try {
        // API를 호출하여 다음 씬과 전체 게임 상태를 받아옴
        const response = await continueGame(loadedSession.id);
        const { scene, loadedGameState, loadedCharacterHistory } = response.data;
        
        setInitialScene(scene); // 불러온 첫 씬
        setInitialGameState(loadedGameState); // 불러온 게임 상태 (대화 기록 포함)
        setGameStartData(loadedCharacterHistory); // 캐릭터 정보
        setInitialPlayerState(loadedGameState.playerState || null); // 아이템/스킬 상태

        setGamePhase('playing'); // 모든 데이터가 준비되면 게임 시작

    } catch (error) {
        console.error("게임 이어하기 실패:", error);
        alert("게임을 이어하는 데 실패했습니다.");
        setGamePhase('summary');
    }
  };

  if ((!fontsLoaded && !fontError) || gamePhase === 'loading') {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#E2C044" />
        <Text style={styles.loadingText}>게임 데이터를 준비하는 중...</Text>
      </SafeAreaView>
    );
  }
  
  if (gamePhase === 'summary') {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>지난 줄거리</Text>
          <ScrollView style={styles.summaryBox}>
             <Text style={styles.summaryText}>{summary}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.startButton} onPress={handleGameStartFromSummary}>
            <Text style={styles.startButtonText}>이어서 시작하기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  if (gamePhase === 'setup') {
    return (
      <SafeAreaView style={styles.fullContainer}>
        <GameSetup
          topic={params.topic!}
          characters={params.characters!}
          onStart={handleGameStartFromSetup}
        />
      </SafeAreaView>
    );
  }

  if (gamePhase === 'playing' && gameStartData) {
    return (
      <SafeAreaView style={styles.fullContainer}>
        <GameEngineRealtime
          topic={params.topic!}
          difficulty={params.difficulty}
          mode={params.mode}
          genre={params.genre}
          setupData={gameStartData}
          isLoadedGame={params.isLoaded === 'true'}
          // ✅ [추가] 불러온 게임 데이터를 GameEngine으로 전달
          initialScene={initialScene}
          initialGameState={initialGameState}
          initialPlayerState={initialPlayerState}
          turnSeconds={20}
        />
      </SafeAreaView>
    );
  }

  return <SafeAreaView style={styles.fullContainer} />;
}

const styles = StyleSheet.create({
  fullContainer: { flex: 1, backgroundColor: "#0B1021" },
  centerContainer: { flex: 1, backgroundColor: "#0B1021", justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: "white", marginTop: 10, fontSize: 16, fontFamily: 'neodgm', },
  summaryContainer: { width: '60%', padding: 30, backgroundColor: '#161B2E', borderRadius: 20, alignItems: 'center' },
  summaryTitle: { fontSize: 28, fontWeight: 'bold', color: '#E2C044', marginBottom: 20, fontFamily: 'neodgm', },
  summaryBox: { width: '100%', maxHeight: 200, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 20, marginBottom: 30 },
  summaryText: { fontSize: 16, color: '#D4D4D4', lineHeight: 24, textAlign: 'center', fontFamily: 'neodgm', },
  startButton: { backgroundColor: '#7C3AED', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 15 },
  startButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold', fontFamily: 'neodgm', },
});