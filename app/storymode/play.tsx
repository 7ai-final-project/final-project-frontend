import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet, useWindowDimensions, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import StoryModeGame from "../../components/game/StoryModeGame";
import api from "../../services/api";
import { useFonts } from "expo-font";

interface SceneData {
  scene: string;
  choices: string[];
  story_id: string;
  story_title: string;
  current_moment_id: string;
  current_moment_title: string;
  image_path: string;
}

export default function StorySelectorScreen() {
  const { width, height } = useWindowDimensions();
  const isMobile = width < 768;
  const isLandscape = width > height;

  const [fontsLoaded, fontError] = useFonts({
    neodgm: require("../../assets/fonts/neodgm.ttf"),
  });

  const { story, should_continue } = useLocalSearchParams();
  const [initialHistory, setInitialHistory] = useState<SceneData[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  const handleStartGame = useCallback(
    async (title: string, continueGame: string) => {
      try {
        const response = await api.post("storymode/story/start/", {
          story_title: title,
          should_continue: continueGame,
        });

        if (response.data.saved_history) {
          setInitialHistory(response.data.saved_history);
        } else if (response.data.initial_data) {
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

  useEffect(() => {
    if (story && should_continue) {
      handleStartGame(story as string, should_continue as string);
    }
  }, [story, should_continue, handleStartGame]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  // 가로 모드일 때 사용할 컨테이너 스타일
  const getContainerStyle = () => {
    if (isMobile && isLandscape) {
      return styles.containerMobileLandscape;
    }
    if (isMobile) {
      return styles.containerMobile;
    }
    return styles.container;
  };

  // 가로 모드일 때 사용할 텍스트 스타일
  const getLoadingTextStyle = () => {
    if (isMobile && isLandscape) {
      return styles.loadingTextMobileLandscape;
    }
    if (isMobile) {
      return styles.loadingTextMobile;
    }
    return styles.loadingText;
  };

  const getErrorTextStyle = () => {
    if (isMobile && isLandscape) {
      return styles.errorTextMobileLandscape;
    }
    if (isMobile) {
      return styles.errorTextMobile;
    }
    return styles.errorText;
  };

  return (
    <View style={getContainerStyle()}>
      {isLoading ? (
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#61dafb" />
          <Text style={getLoadingTextStyle()}>
            게임을 불러오는 중...
          </Text>
        </View>
      ) : initialHistory ? (
        <StoryModeGame
          initialData={initialHistory[0]}
          initialHistoryProp={initialHistory}
        />
      ) : (
        <View style={styles.content}>
          <Text style={getErrorTextStyle()}>
            서버 오류로 게임을 시작할 수 없습니다.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1021",
    padding: 15,
  },
  containerMobile: {
    flex: 1,
    backgroundColor: "#0B1021",
    padding: 10,
  },
  containerMobileLandscape: {
    flex: 1,
    backgroundColor: "#0B1021",
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    fontFamily: "neodgm",
    color: "#F4E1D2",
  },
  loadingTextMobile: {
    marginTop: 8,
    fontSize: 16,
    fontFamily: "neodgm",
    color: "#F4E1D2",
  },
  loadingTextMobileLandscape: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: "neodgm",
    color: "#F4E1D2",
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    fontFamily: "neodgm",
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 10,
  },
  errorTextMobile: {
    fontSize: 16,
    fontFamily: "neodgm",
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 8,
  },
  errorTextMobileLandscape: {
    fontSize: 14,
    fontFamily: "neodgm",
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 6,
  },
});