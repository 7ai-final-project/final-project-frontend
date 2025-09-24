import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet, useWindowDimensions, Platform, Modal, TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";
import StoryModeGame from "../../components/game/StoryModeGame";
import api from "../../services/api";
import { useFonts } from "expo-font";
import { useSettings } from "../../components/context/SettingsContext";

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

  const { fontSizeMultiplier } = useSettings();

  const { story, should_continue } = useLocalSearchParams();
  const [initialHistory, setInitialHistory] = useState<SceneData[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorModalVisible, setErrorModalVisible] = useState(false); // 추가
  const [errorMessage, setErrorMessage] = useState("");

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
        setErrorMessage("게임을 시작할 수 없습니다. 서버 연결을 확인해주세요.");
        setErrorModalVisible(true);
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
      return [styles.loadingTextMobileLandscape, { fontSize: 14 * fontSizeMultiplier }];
    }
    if (isMobile) {
      return [styles.loadingTextMobile, { fontSize: 16 * fontSizeMultiplier }];
    }
    return [styles.loadingText, { fontSize: 18 * fontSizeMultiplier }];
  };

  const getErrorTextStyle = () => {
    if (isMobile && isLandscape) {
      return [styles.errorTextMobileLandscape, { fontSize: 14 * fontSizeMultiplier }];
    }
    if (isMobile) {
      return [styles.errorTextMobile, { fontSize: 16 * fontSizeMultiplier }];
    }
    return [styles.errorText, { fontSize: 18 * fontSizeMultiplier }];
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
      <Modal
        transparent={true}
        visible={errorModalVisible}
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {/* ▼▼▼ 4. 모달 내 텍스트에 동적 폰트 크기 적용 ▼▼▼ */}
            <Text style={[styles.modalTitle, { fontSize: 22 * fontSizeMultiplier }]}>오류</Text>
            <Text style={[styles.modalMessage, { fontSize: 16 * fontSizeMultiplier }]}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={[styles.modalButtonText, { fontSize: 16 * fontSizeMultiplier }]}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    // fontSize: 18, // 동적으로 적용되므로 주석 처리
    fontFamily: "neodgm",
    color: "#F4E1D2",
  },
  loadingTextMobile: {
    marginTop: 8,
    // fontSize: 16,
    fontFamily: "neodgm",
    color: "#F4E1D2",
  },
  loadingTextMobileLandscape: {
    marginTop: 6,
    // fontSize: 14,
    fontFamily: "neodgm",
    color: "#F4E1D2",
    textAlign: 'center',
  },
  errorText: {
    // fontSize: 18,
    fontFamily: "neodgm",
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 10,
  },
  errorTextMobile: {
    // fontSize: 16,
    fontFamily: "neodgm",
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 8,
  },
  errorTextMobileLandscape: {
    // fontSize: 14,
    fontFamily: "neodgm",
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 6,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalBox: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: "#2a2d47",
    borderRadius: 12,
    padding: 25,
    alignItems: "center",
  },
  modalTitle: {
    // fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "neodgm",
    marginBottom: 15,
  },
  modalMessage: {
    // fontSize: 16,
    color: "#FFFFFF",
    fontFamily: "neodgm",
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 24,
  },
  modalButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  modalButtonText: {
    color: "white",
    // fontSize: 16,
    fontFamily: "neodgm",
    fontWeight: "bold",
  },
});