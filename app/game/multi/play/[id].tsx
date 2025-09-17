// frontend/app/game/multi/play/[id].tsx

import React, { useState, useEffect, useMemo } from "react";
import { SafeAreaView, StyleSheet, View, ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";
import GameSetup from "@/components/game/GameSetup";
import GameEngineRealtime from "@/components/game/GameEngineRealtime";
import { Character as ApiCharacter } from "@/services/api";
import { useAuth } from "@/hooks/useAuth"; // ✅ 1. Auth hook import

// --- 타입 정의 (기존과 동일) ---
interface GameStartPayload {
  myCharacter: ApiCharacter;
  aiCharacters: ApiCharacter[];
  allCharacters: ApiCharacter[];
}
// ✅ 2. 불러온 데이터의 원본 타입을 명확히 정의
interface LoadedCharacterHistory {
  assignments: { [userId: string]: ApiCharacter };
  aiCharacters: ApiCharacter[];
  allCharacters: ApiCharacter[];
}
interface LoadedSessionData {
<<<<<<< HEAD
  choice_history: { summary?: string };
  character_history: GameStartPayload;
=======
  choice_history: { summary?: string; };
  character_history: LoadedCharacterHistory; // ✅ 3. 타입 적용
>>>>>>> origin/develop
}
type GamePhase = "loading" | "summary" | "setup" | "playing";

export default function GameScreen() {
  const params = useLocalSearchParams<{
    id: string;
    topic: string;
    difficulty: string;
    mode: string;
    isLoaded: string;              // 'true' | 'false'
    characters?: string;           // JSON stringified Character[]
    participants?: string;         // JSON stringified participants
    isOwner: string;               // 'true' | 'false'
    loadedSessionData?: string;    // JSON stringified LoadedSessionData
  }>();

<<<<<<< HEAD
  const [gamePhase, setGamePhase] = useState<GamePhase>("loading");
  const [gameStartData, setGameStartData] = useState<GameStartPayload | null>(null);
  const [summary, setSummary] = useState<string>("");

  // (옵션) GameEngineRealtime에 세션 전체 메타도 넘겨주기
  const initialSessionData = useMemo<LoadedSessionData | null>(() => {
    if (params.isLoaded === "true" && params.loadedSessionData) {
      try {
        return JSON.parse(params.loadedSessionData as string) as LoadedSessionData;
      } catch {
        return null;
      }
    }
    return null;
  }, [params.isLoaded, params.loadedSessionData]);

  useEffect(() => {
    if (params.isLoaded === "true" && params.loadedSessionData) {
      try {
        const session: LoadedSessionData = JSON.parse(params.loadedSessionData);
        setGameStartData(session.character_history);
        setSummary(session.choice_history?.summary || "저장된 줄거리가 없습니다.");
        setGamePhase("summary");
      } catch (error) {
        console.error("세션 데이터 파싱 실패:", error);
        setGamePhase("setup");
=======
  const { user } = useAuth(); // ✅ 4. 현재 사용자 정보 가져오기
  const [gamePhase, setGamePhase] = useState<GamePhase>('loading');
  const [gameStartData, setGameStartData] = useState<GameStartPayload | null>(null);
  const [summary, setSummary] = useState<string>('');
  
  useEffect(() => {
    // '불러오기'이며, 세션 데이터와 사용자 정보가 모두 있을 때 실행
    if (params.isLoaded === 'true' && params.loadedSessionData && user) { // ✅ 5. user 로딩 확인
      try {
        const session: LoadedSessionData = JSON.parse(params.loadedSessionData);
        const loadedHistory = session.character_history;

        // ✅ 6. [핵심] assignments 맵에서 내 캐릭터 찾기
        const myCharacter = loadedHistory.assignments[user.id];

        if (myCharacter) {
          // ✅ 7. GameEngineRealtime이 요구하는 형태로 데이터 변환
          const transformedPayload: GameStartPayload = {
            myCharacter: myCharacter,
            aiCharacters: loadedHistory.aiCharacters,
            allCharacters: loadedHistory.allCharacters,
          };
          
          setGameStartData(transformedPayload); // 변환된 데이터로 상태 설정
          setSummary(session.choice_history?.summary || "저장된 줄거리가 없습니다.");
          setGamePhase('summary'); // 요약 화면으로 이동

        } else {
          console.error("저장된 데이터에서 현재 유저의 캐릭터를 찾을 수 없습니다.");
          setGamePhase('setup'); // 에러 발생 시 설정 화면으로 이동
        }

      } catch (error) {
        console.error("세션 데이터 파싱 또는 변환 실패:", error);
        setGamePhase('setup'); 
>>>>>>> origin/develop
      }
    } else if (params.isLoaded === "false") {
      setGamePhase("setup");
    }
  }, [params.isLoaded, params.loadedSessionData, user]); // ✅ 8. user를 의존성 배열에 추가

  const handleGameStartFromSetup = (payload: GameStartPayload) => {
    setGameStartData(payload);
    setGamePhase("playing");
  };

<<<<<<< HEAD
  const handleGameStartFromSummary = () => {
    setGamePhase("playing");
  };

  if (gamePhase === "loading" || !params.id || !params.topic) {
=======
  // ... 이하 렌더링 로직은 변경할 필요 없습니다 ...
  if (gamePhase === 'loading' || !params.id || !params.topic) {
>>>>>>> origin/develop
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#E2C044" />
        <Text style={styles.loadingText}>게임 데이터를 준비하는 중...</Text>
      </SafeAreaView>
    );
  }

<<<<<<< HEAD
  if (gamePhase === "summary") {
=======
  if (gamePhase === 'summary') {
>>>>>>> origin/develop
    return (
      <SafeAreaView style={styles.centerContainer}>
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>지난 줄거리</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>{summary}</Text>
          </View>
          <TouchableOpacity style={styles.startButton} onPress={handleGameStartFromSummary}>
            <Text style={styles.startButtonText}>이어서 시작하기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

<<<<<<< HEAD
  if (gamePhase === "setup" || gamePhase === "playing") {
=======
  if (gamePhase === 'setup' || gamePhase === 'playing') {
>>>>>>> origin/develop
    return (
      <SafeAreaView style={styles.fullContainer}>
        {gameStartData && gamePhase === "playing" ? (
          <GameEngineRealtime
            roomId={params.id}
            topic={params.topic}
            difficulty={params.difficulty}
            setupData={gameStartData}
            isLoadedGame={params.isLoaded === "true"}
            turnSeconds={20}
            initialSessionData={initialSessionData} // (옵션) 세션 메타 전달
           />  
        ) : params.characters && params.participants ? (
          <GameSetup
            roomId={params.id}
            topic={params.topic}
            characters={params.characters}
            participants={params.participants}
            isOwner={params.isOwner === "true"}
            onStart={handleGameStartFromSetup}
          />
        ) : (
<<<<<<< HEAD
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#E2C044" />
            <Text style={styles.loadingText}>캐릭터 설정 정보를 불러오는 중...</Text>
          </View>
=======
          (params.characters && params.participants) ? (
            <GameSetup
              roomId={params.id}
              topic={params.topic}
              characters={params.characters}
              participants={params.participants}
              isOwner={params.isOwner === 'true'}
              onStart={handleGameStartFromSetup}
            />
          ) : (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#E2C044" />
              <Text style={styles.loadingText}>캐릭터 설정 정보를 불러오는 중...</Text>
            </View>
          )
>>>>>>> origin/develop
        )}
      </SafeAreaView>
    );
  }
<<<<<<< HEAD

=======
>>>>>>> origin/develop
  return <SafeAreaView style={styles.fullContainer} />;
}

const styles = StyleSheet.create({
  // 1. 화면 전체를 채우는 기본 컨테이너
  fullContainer: {
    flex: 1,
    backgroundColor: "#0B1021",
  },
  // 2. 내용을 중앙 정렬할 때 사용할 컨테이너
  centerContainer: {
    flex: 1,
    backgroundColor: "#0B1021",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "white",
    marginTop: 10,
    fontSize: 16,
  },
  // (요약 화면 스타일)
  summaryContainer: {
    width: "60%",
    padding: 30,
    backgroundColor: "#161B2E",
    borderRadius: 20,
    alignItems: "center",
  },
  summaryTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#E2C044",
    marginBottom: 20,
  },
  summaryBox: {
    width: "100%",
    maxHeight: 200,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 10,
    padding: 20,
    marginBottom: 30,
  },
  summaryText: {
    fontSize: 16,
    color: "#D4D4D4",
    lineHeight: 24,
    textAlign: "center",
  },
  startButton: {
    backgroundColor: "#7C3AED",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 15,
  },
  startButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});
