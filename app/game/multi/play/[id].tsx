import React, { useState, useEffect } from "react";
import { SafeAreaView, StyleSheet, View, ActivityIndicator, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import GameSetup from "@/components/game/GameSetup";
import GameEngineRealtime from "@/components/game/GameEngineRealtime";
import GameEngineTurnBased from "@/components/game/GameEngineTurnBased";

// ✅ 두 가지 다른 Character 타입을 별칭(alias)으로 import하여 충돌을 방지합니다.
import { Character as ApiCharacter, fetchMySession } from "@/services/api";
import { Character as EngineCharacter } from "@/data/characterData";

// GameSetup에서 onStart로 전달받을 데이터 타입은 API 타입을 기준으로 합니다.
interface GameStartPayload {
  myCharacter: ApiCharacter;
  aiCharacters: ApiCharacter[];
  allCharacters: ApiCharacter[];
}

interface LoadedSessionData {
  choice_history: any;
  character_history: GameStartPayload; // GameStartPayload와 구조가 동일합니다.
}

export default function GameScreen() {
  // ✅ 대기실에서 보낸 모든 파라미터를 받도록 타입을 완벽하게 정의합니다.
  const params = useLocalSearchParams<{
    id: string;
    topic: string;
    difficulty: string;
    mode: string;
    genre: string;
    isLoaded: string;
    // '새 게임' 시에만 값이 존재하므로 optional (?) 처리
    characters?: string; 
    participants?: string;
    isOwner: string;
    // '불러오기' 시에만 값이 존재하므로 optional (?) 처리
    loadedCharacterHistory?: string; 
  }>();

  const [gameStartData, setGameStartData] = useState<GameStartPayload | null>(null);
  const [loadedSession, setLoadedSession] = useState<LoadedSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const normalizedMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;

  // --- ⬇️ 2. useEffect 로직 수정 ⬇️ ---
  useEffect(() => {
    const initializeGame = () => { // async 키워드 제거
      // 1. '불러오기'로 진입한 경우
      if (params.isLoaded === 'true' && params.loadedCharacterHistory) {
        try {
          // 파라미터로 받은 데이터를 파싱하여 즉시 state를 업데이트합니다.
          const characterHistory: GameStartPayload = JSON.parse(params.loadedCharacterHistory);
          setGameStartData(characterHistory);
          // character_history 외 다른 세션 데이터가 필요하면 별도 state에 저장할 수 있습니다.
          // 예: setLoadedSession({ choice_history: ..., character_history: characterHistory });
        } catch (error) {
          console.error("전달된 세션 데이터 파싱 실패:", error);
          setGameStartData(null); // 실패 시 GameSetup으로 fallback
        }
      } else {
        // 2. '새 게임'으로 진입한 경우
        setGameStartData(null); // GameSetup을 렌더링하도록 설정
      }
      setIsLoading(false);
    };

    initializeGame();
  }, [params.isLoaded, params.loadedCharacterHistory]);


  // 로딩 중이거나 필수 파라미터가 없으면 로딩 화면 표시
  if (isLoading || !params.id) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#E2C044" />
        <Text style={styles.loadingText}>게임 데이터를 불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  // GameSetup에서 "게임 시작!" 버튼을 누르면 이 함수가 호출됩니다.
  const handleGameStart = (payload: GameStartPayload) => {
    setGameStartData(payload);
  };

  return (
    <SafeAreaView style={styles.container}>
      {gameStartData ? (
        // --- 1. 게임 데이터가 존재할 경우 ---
        <>
          {normalizedMode === "턴제" ? (
            <GameEngineTurnBased
              roomId={params.id}
              topic={params.topic}
              difficulty={params.difficulty}
              // 타입 오류 해결: 이 블록에서는 gameStartData가 null이 아님
              selectedCharacter={gameStartData.myCharacter as unknown as EngineCharacter}
              turnSeconds={20}
            />
          ) : (
            <GameEngineRealtime
              roomId={params.id}
              topic={params.topic}
              difficulty={params.difficulty}
              // 타입 오류 해결: 이 블록에서는 gameStartData가 null이 아님
              setupData={gameStartData} 
              initialSessionData={loadedSession}
              turnSeconds={20}
            />
          )}
        </>
      ) : (
        // --- 2. 게임 데이터가 아직 없을 경우 ---
        !gameStartData && params.characters && params.participants ? (
          // '새 게임'에 필요한 파라미터가 있다면 GameSetup 렌더링
          <GameSetup
            roomId={params.id}
            topic={params.topic}
            characters={params.characters}
            participants={params.participants}
            isOwner={params.isOwner === 'true'}
            onStart={handleGameStart}
          />
        ) : (
          // '불러오기' 중이거나, 파라미터가 없는 초기 로딩 상태
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#E2C044" />
          </View>
        )
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1021" },
  loadingText: {
    color: "white",
    marginTop: 10,
    fontSize: 16,
  },
});