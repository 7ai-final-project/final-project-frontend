import React, { useState } from "react";
import { SafeAreaView, StyleSheet, View, ActivityIndicator, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import GameSetup from "@/components/game/GameSetup";
import GameEngineRealtime from "@/components/game/GameEngineRealtime";
import GameEngineTurnBased from "@/components/game/GameEngineTurnBased";

// ✅ 두 가지 다른 Character 타입을 별칭(alias)으로 import하여 충돌을 방지합니다.
import { Character as ApiCharacter } from "@/services/api";
import { Character as EngineCharacter } from "@/data/characterData";

// GameSetup에서 onStart로 전달받을 데이터 타입은 API 타입을 기준으로 합니다.
interface GameStartPayload {
  myCharacter: ApiCharacter;
  aiCharacters: ApiCharacter[];
  allCharacters: ApiCharacter[];
}

export default function GameScreen() {
  // ✅ 대기실에서 보낸 모든 파라미터를 받도록 타입을 완벽하게 정의합니다.
  const params = useLocalSearchParams<{
    id: string;
    topic: string;
    difficulty: string;
    mode: string;
    genre: string;
    characters: string;
    participants: string;
    isOwner: string;
  }>();

  // 게임 시작에 필요한 모든 데이터를 저장할 state
  const [gameStartData, setGameStartData] = useState<GameStartPayload | null>(null);

  const normalizedMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;

  // 파라미터가 아직 로드되지 않았을 경우를 대비한 로딩 화면
  if (!params.characters || !params.participants) {
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
      {!gameStartData ? (
        // --- 1. 캐릭터 선택 단계 ---
        // GameSetup에 필요한 모든 props를 전달합니다.
        <GameSetup
          roomId={params.id}
          topic={params.topic}
          characters={params.characters}
          participants={params.participants}
          isOwner={params.isOwner === 'true'} // 문자열을 boolean으로 변환
          onStart={handleGameStart}
        />
      ) : (
        // --- 2. 실제 게임 플레이 단계 ---
        <>
          {normalizedMode === "턴제" ? (
            // ✅ GameEngineTurnBased는 기존 local 데이터 타입의 character를 받습니다.
            <GameEngineTurnBased
              roomId={params.id}
              topic={params.topic}
              difficulty={params.difficulty}
              selectedCharacter={gameStartData.myCharacter as unknown as EngineCharacter} 
              turnSeconds={20}
            />
          ) : (
            // ✅ GameEngineRealtime은 API 데이터 구조 전체를 받도록 수정되었습니다.
            <GameEngineRealtime
              roomId={params.id}
              topic={params.topic}
              difficulty={params.difficulty}
              setupData={gameStartData} // gameStartData 객체 전체를 전달
              turnSeconds={20}
            />
          )}
        </>
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