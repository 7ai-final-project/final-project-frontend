// ✨ 이 코드로 play.tsx 파일 전체를 교체하세요 ✨

import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import SingleModeGame from "../../components/game/SingleModeGame";
import api from "../../services/api";

// SceneData 타입을 여기서도 정의해줍니다. (SingleModeGame과 타입을 맞추기 위함)
interface SceneData {
  scene: string;
  choices: string[];
  story_id: string;
  story_title: string;
  current_moment_id: string;
  current_moment_title: string;
  image_path: string;
}

export default function CharacterScreen() {
  // 1. useLocalSearchParams에서 story와 함께 should_continue를 받습니다.
  const { story, should_continue } = useLocalSearchParams();

  // 2. gameData 대신 initialHistory 라는 이름으로 바꾸고, 타입을 SceneData 배열로 지정합니다.
  const [initialHistory, setInitialHistory] = useState<SceneData[] | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true); // 로딩 상태는 항상 true로 시작

  // 3. handleStartGame 함수가 should_continue 값을 받도록 수정합니다.
  const handleStartGame = useCallback(
    async (title: string, continueGame: string) => {
      try {
        const response = await api.post("storymode/story/start/", {
          story_title: title,
          should_continue: continueGame, // 👈 백엔드로 '이어하기' 여부를 전달합니다.
        });

        // 4. 백엔드의 응답에 따라 initialHistory 상태를 설정합니다.
        if (response.data.saved_history) {
          // '이어하기' 데이터가 온 경우
          setInitialHistory(response.data.saved_history);
        } else if (response.data.initial_data) {
          // '새로 시작' 데이터가 온 경우 (배열 형태로 만들어줍니다)
          setInitialHistory([response.data.initial_data]);
        }
      } catch (error: any) {
        console.error("게임 시작 에러:", error);
        alert("게임을 시작할 수 없습니다. 서버 연결을 확인해주세요.");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // 5. useEffect에서 should_continue 값도 확인하고 handleStartGame에 전달합니다.
  useEffect(() => {
    if (story && should_continue) {
      handleStartGame(story as string, should_continue as string);
    }
  }, [story, should_continue, handleStartGame]);

  // 6. 렌더링 부분을 initialHistory 기준으로 수정합니다.
  return (
    <View style={styles.container}>
      {isLoading ? ( // isLoading이 true일 때 먼저 로딩 화면을 보여줍니다.
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#61dafb" />
          <Text style={styles.loadingText}>게임을 불러오는 중...</Text>
        </View>
      ) : initialHistory ? ( // 로딩이 끝나고 initialHistory 데이터가 있으면 게임을 렌더링합니다.
        <SingleModeGame
          initialData={initialHistory[0]}
          initialHistoryProp={initialHistory}
        />
      ) : (
        // 로딩이 끝났는데 데이터가 없으면 에러를 표시합니다.
        <View style={styles.content}>
          <Text style={styles.errorText}>
            서버 오류로 게임을 시작할 수 없습니다.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#3c414e", padding: 15 },
  content: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    fontFamily: "neodgm",
    color: "white",
  },
  errorText: {
    fontSize: 18,
    fontFamily: "neodgm",
    color: "red",
    textAlign: "center",
    marginBottom: 10,
  },
});
