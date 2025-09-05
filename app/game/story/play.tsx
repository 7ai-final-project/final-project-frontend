import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import SingleModeGame from "../../../components/game/SingleModeGame";
import api from "../../../services/api";

export default function CharacterScreen() {
  const { storyId } = useLocalSearchParams<{ storyId: string }>();

  const [gameData, setGameData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // storyId가 있을 때 바로 게임 시작
  useEffect(() => {
    if (storyId) {
      handleStartGame(storyId);
    }
  }, [storyId]);

  const handleStartGame = async (selectedStoryId: string) => {
    setIsLoading(true);
    try {
      const response = await api.post('game/story/start/', {
        story_id: selectedStoryId,
      });
      setGameData(response.data);
    } catch (error: any) {
      console.error("게임 시작 에러:", error);
      console.error(error.response?.config.url);
      alert("게임을 시작할 수 없습니다. 서버 연결을 확인해주세요.");
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{storyId}</Text>
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
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#61dafb",
    textAlign: "center",
    paddingBottom: 15,
    borderBottomColor: "#61dafb",
    borderBottomWidth: 1,
    marginBottom: 15,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    color: "white",
  },
  errorText: {
    fontSize: 18,
    color: "red",
    textAlign: "center",
    marginBottom: 10,
  },
});