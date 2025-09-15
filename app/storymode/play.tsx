import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import SingleModeGame from "../../components/game/SingleModeGame";
import api from "../../services/api";

export default function CharacterScreen() {
  const { story } = useLocalSearchParams();
  const [gameData, setGameData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // storymode 데이터 조회
  const handleStartGame = useCallback(async (title: string) => {
    setIsLoading(true);
    try {
      const response = await api.post('storymode/story/start/', {
        story_title: story,
      });
      // console.log(response);
      setGameData(response.data);
    } catch (error: any) {
      console.error("게임 시작 에러:", error);
      console.error(error.response?.config.url);
      alert("게임을 시작할 수 없습니다. 서버 연결을 확인해주세요.");
      setIsLoading(false);
    }
  }, []);

  // story가 있을때 바로 게임 시작
  useEffect(() => {
    if(story) {
      handleStartGame(story as string);
    }
  }, [story, handleStartGame]);

  return (
    <View style={styles.container}>
      {isLoading && !gameData ? (
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#61dafb" />
          <Text style={styles.loadingText}>게임을 불러오는 중...</Text>
        </View>
      ) : gameData ? (
        <SingleModeGame initialData={gameData} />
      ) : (
        <View style={styles.content}>
          <Text style={styles.errorText}>서버 오류로 게임을 시작할 수 없습니다.</Text>
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
    fontFamily: 'neodgm',
    color: "white",
  },
  errorText: {
    fontSize: 18,
    fontFamily: 'neodgm',
    color: "red",
    textAlign: "center",
    marginBottom: 10,
  },
});