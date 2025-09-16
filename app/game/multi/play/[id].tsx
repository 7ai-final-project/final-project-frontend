// frontend/app/game/multi/play/[id].tsx

import React, { useState, useEffect, useMemo } from "react";
import { SafeAreaView, StyleSheet, View, ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";
import GameSetup from "@/components/game/GameSetup";
import GameEngineRealtime from "@/components/game/GameEngineRealtime";
import { Character as ApiCharacter } from "@/services/api";

// --- 타입 정의 (기존과 동일) ---
interface GameStartPayload {
  myCharacter: ApiCharacter;
  aiCharacters: ApiCharacter[];
  allCharacters: ApiCharacter[];
}
interface LoadedSessionData {
  choice_history: { summary?: string };
  character_history: GameStartPayload;
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
      }
    } else if (params.isLoaded === "false") {
      setGamePhase("setup");
    }
  }, [params.isLoaded, params.loadedSessionData]);

  const handleGameStartFromSetup = (payload: GameStartPayload) => {
    setGameStartData(payload);
    setGamePhase("playing");
  };

  const handleGameStartFromSummary = () => {
    setGamePhase("playing");
  };

  if (gamePhase === "loading" || !params.id || !params.topic) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#E2C044" />
        <Text style={styles.loadingText}>게임 데이터를 준비하는 중...</Text>
      </SafeAreaView>
    );
  }

  if (gamePhase === "summary") {
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

  if (gamePhase === "setup" || gamePhase === "playing") {
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
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#E2C044" />
            <Text style={styles.loadingText}>캐릭터 설정 정보를 불러오는 중...</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

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
