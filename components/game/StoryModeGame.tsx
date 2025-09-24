import React, { useState, useEffect, useRef, ReactNode, FunctionComponent } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, Pressable, Animated, LayoutChangeEvent, ViewStyle, useWindowDimensions, Modal } from "react-native";
import api from "../../services/api";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import OptionsModal from "../../components/OptionsModal";
import { useSettings } from '../../components/context/SettingsContext';
import { router } from "expo-router";
import { useFonts } from 'expo-font';


interface SceneData {
  scene: string;
  choices: string[];
  story_id: string;
  story_title: string;
  current_moment_id: string;
  current_moment_title: string;
  image_path: string;
}

interface GameProps {
  initialData: SceneData;
  initialHistoryProp: SceneData[];
}

interface MedievalButtonProps {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  buttonStyle?: ViewStyle;
  isMobile: boolean;
  fontSizeMultiplier: number;
}

interface TypingTextProps {
  text: string;
  onFinished: () => void;
  isMobile: boolean;
  fontSizeMultiplier: number;
}

const TypingText: FunctionComponent<TypingTextProps> = ({
  text,
  onFinished,
  isMobile,
  fontSizeMultiplier,
}) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setDisplayedText("");

    const processedText = text.replace(/\. ([가-힣A-Za-z])/g, ".\n$1");

    let i = 0;
    const intervalId = setInterval(() => {
      setDisplayedText(text.substring(0, i + 1));
      i++;

      if (i > text.length) {
        clearInterval(intervalId);
        onFinished();
      }
    }, 40);

    return () => clearInterval(intervalId);
  }, [text]);

  return (
    <Text style={[
        isMobile ? styles.sceneDescriptionMobile : styles.sceneDescription,
        { fontSize: (isMobile ? 16 : 22) * fontSizeMultiplier }
    ]}>
      {displayedText}
      {displayedText.length < text.length && (
        <Text style={{ opacity: 0.5 }}>|</Text>
      )}
    </Text>
  );
};

const MedievalButton: FunctionComponent<MedievalButtonProps> = ({
  children,
  onPress,
  disabled = false,
  buttonStyle = {},
  isMobile,
  fontSizeMultiplier,
}) => {
  const scaleValue = useRef(new Animated.Value(1)).current;
  const [isPressed, setIsPressed] = useState(false);

  const onPressIn = () => {
    if (disabled) return;
    setIsPressed(true);
    Animated.spring(scaleValue, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };
  const onPressOut = () => {
    if (disabled) return;
    setIsPressed(false);
    Animated.spring(scaleValue, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
    >
      <Animated.View
        style={[
          isMobile ? styles.mediumButtonMobile : styles.buttonContainer,
          isMobile ? {} : styles.mediumButton,
          { transform: [{ scale: scaleValue }] },
          buttonStyle,
        ]}
      >
        <View style={styles.outerBorder} />
        <View style={styles.innerBorder} />
        <View style={[isMobile ? styles.buttonBodyMobile : styles.buttonBody, isPressed && styles.pressed]}>
          <Text style={[
              isMobile ? styles.mediumButtonTextMobile : styles.buttonText, 
              {
                fontFamily: "neodgm", 
                color: "#f0e6d2",
                fontSize: (isMobile ? 20 : 28) * fontSizeMultiplier
              }
          ]}>
            {children}
          </Text>
        </View>
        <View style={[styles.chain, styles.chainTopLeft]}>
          <View style={styles.chainPin} />
        </View>
        <View style={[styles.chain, styles.chainTopRight]}>
          <View style={styles.chainPin} />
        </View>
        <View style={[styles.chain, styles.chainBottomLeft]}>
          <View style={styles.chainPin} />
        </View>
        <View style={[styles.chain, styles.chainBottomRight]}>
          <View style={styles.chainPin} />
        </View>
      </Animated.View>
    </Pressable>
  );
};

export default function StoryModeGame({ initialData, initialHistoryProp }: GameProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [fontsLoaded, fontError] = useFonts({'neodgm': require('../../assets/fonts/neodgm.ttf'),});

  const [history, setHistory] = useState<SceneData[]>(initialHistoryProp);
  const currentScene = history[history.length - 1];

  const [error, setError] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);

  const [scrollWidth, setScrollWidth] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  
  const {
        isBgmOn,
        setIsBgmOn,
        isSfxOn,
        setIsSfxOn,
        fontSizeMultiplier,
        setFontSizeMultiplier,
        language,
        setLanguage,
        isLoading: isSettingsLoading,
      } = useSettings();

  const [defaultImagePath] = useState(() => {
    const images = [
      require("../../assets/images/game/story/default_image_1.jpg"),
      require("../../assets/images/game/story/default_image_2.png"),
      require("../../assets/images/game/story/default_image_3.jpg"),
    ];
    const randomIndex = Math.floor(Math.random() * images.length);
    return images[randomIndex];
  });
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isChoiceLoading, setIsChoiceLoading] = useState(false);

  const [duration, setDuration] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | number | null>(null);

  const [clickSound, setClickSound] = useState<Audio.Sound | null>(null);
  const [pageTurnSound, setPageTurnSound] = useState<Audio.Sound | null>(null);
  const [goodEndingMusic, setGoodEndingMusic] = useState<Audio.Sound | null>(null);
  const [badEndingMusic, setBadEndingMusic] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    const loadSounds = async () => {
      try {
        const { sound: loadedClickSound } = await Audio.Sound.createAsync(
          require("../../assets/sounds/click.mp3")
        );
        setClickSound(loadedClickSound);

        const { sound: loadedPageTurnSound } = await Audio.Sound.createAsync(
          require("../../assets/sounds/page_turn.mp3")
        );
        setPageTurnSound(loadedPageTurnSound);

        const { sound: loadedGoodEndingMusic } = await Audio.Sound.createAsync(
          require("../../assets/sounds/good_ending.mp3")
        );
        setGoodEndingMusic(loadedGoodEndingMusic);

        const { sound: loadedBadEndingMusic } = await Audio.Sound.createAsync(
          require("../../assets/sounds/bad_ending.mp3")
        );
        setBadEndingMusic(loadedBadEndingMusic);
      } catch (error) {
        console.error("사운드 로딩 실패:", error);
      }
    };
    loadSounds();
    console.log(initialData);

    return () => {
      clickSound?.unloadAsync();
      pageTurnSound?.unloadAsync();
      goodEndingMusic?.unloadAsync();
      badEndingMusic?.unloadAsync();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current as any);
    };
  }, []);

  // ▼▼▼ 이 부분이 수정되었습니다 ▼▼▼
  useEffect(() => {
    const isEndingScene = currentScene.current_moment_title.startsWith("ENDING_");

    if (!isBgmOn || !isEndingScene) {
      // BGM이 꺼져 있거나 엔딩 장면이 아니면 모든 엔딩 음악을 중지합니다.
      goodEndingMusic?.stopAsync();
      badEndingMusic?.stopAsync();
      return; // 더 이상 진행하지 않습니다.
    }

    // BGM이 켜져 있고, 엔딩 장면일 경우에만 음악을 재생합니다.
    const goodEndings = ["GOOD", "FUNNY", "HAPPY", "SECRET"];
    const badEndings = ["BAD", "GIVEUP"];

    if (goodEndings.some((pattern) => currentScene.current_moment_title.includes(pattern))) {
      goodEndingMusic?.playAsync();
    } else if (badEndings.some((pattern) => currentScene.current_moment_title.includes(pattern))) {
      badEndingMusic?.playAsync();
    }

    // 클린업 함수: 장면이 바뀌거나 BGM 설정이 변경될 때 음악을 중지합니다.
    return () => {
      goodEndingMusic?.stopAsync();
      badEndingMusic?.stopAsync();
    };
  }, [currentScene.current_moment_id, currentScene.current_moment_title, isBgmOn, goodEndingMusic, badEndingMusic]);


  const handleChoice = async (choiceIndex: number) => {
    goodEndingMusic?.stopAsync();
    badEndingMusic?.stopAsync();

    if (isSfxOn) await clickSound?.replayAsync();
    setIsChoiceLoading(true);
    setError("");

    try {
      const response = await api.post("storymode/story/choice/", {
        story_title: currentScene.story_title,
        choice_index: choiceIndex,
        current_moment_id: currentScene.current_moment_id,
      });

      if (isSfxOn) await pageTurnSound?.replayAsync();

      const nextScene: SceneData = response.data;

      setIsTyping(true);

      setHistory((prevHistory) => [...prevHistory, nextScene]);
    } catch (err) {
      setError("이야기를 이어가는 데 실패했습니다.");
      console.error(err);
    } finally {
      setIsChoiceLoading(false);
    }
  };

  const handleGoBack = () => {
    if (history.length > 1) {
      if (isSfxOn) pageTurnSound?.replayAsync();
      setIsTyping(true);
      setHistory((prevHistory) => prevHistory.slice(0, -1));
    }
  };

  const handleSave = async () => {
    try {
      await api.post("/storymode/story/save/", {
        story_id: history[0].story_id,
        history: history,
      });

      setModalMessage("지금까지의 이야기가 저장되었습니다.");
      setSuccessModalVisible(true);
    } catch (error) {
      console.error("저장 실패:", error);
      setModalMessage("저장에 실패했습니다. 서버 연결을 확인해주세요.");
      setErrorModalVisible(true);
    }
  };

  const onScrollLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setScrollWidth(width);
  };

  if(!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#20232a' }}>
      <ScrollView contentContainerStyle={isMobile ? styles.containerMobile : styles.container}>
        {/* --- 1. 헤더 --- */}
        <View style={isMobile ? styles.headerMobile : styles.header}>
          {/* 1. 왼쪽: 뒤로가기 버튼 */}
          <View style={isMobile ? styles.headerLeftMobile : styles.headerLeft}>
            <TouchableOpacity
              style={isMobile ? styles.headerButtonMobile : styles.headerButton}
              onPress={() => {
                if (history.length > 1) {
                  handleGoBack();
                } else {
                  router.back();
                }
              }}
            >
              <Ionicons name="arrow-back" size={isMobile ? 24 : 28} color="#F4E4BC" />
            </TouchableOpacity>
            {/* 홈 버튼을 스토리 제목 옆으로 옮깁니다 */}
            <TouchableOpacity
              style={isMobile ? styles.headerButtonMobile : styles.headerButton}
              onPress={() => router.replace('/storymode')}
            >
              <Ionicons name="home-outline" size={isMobile ? 24 : 28} color="#F4E4BC" />
            </TouchableOpacity>
          </View>

          {/* 2. 가운데: 스토리 제목 (양쪽 버튼과 겹치지 않도록 flex 추가) */}
          <View style={styles.headerTitleContainer}>
            <Text style={[isMobile ? styles.storyTitleMobile : styles.storyTitle, { fontSize: (isMobile ? 20 : 28) * fontSizeMultiplier }]}>{currentScene.story_title}</Text>
          </View>
          
          {/* 3. 오른쪽: 저장 & 설정 버튼 그룹 */}
          <View style={isMobile ? styles.headerRightMobile : styles.headerRight}>
            <TouchableOpacity style={isMobile ? styles.headerButtonMobile : styles.headerButton} onPress={handleSave}>
              <Ionicons name="save-outline" size={isMobile ? 24 : 28} color="#F4E4BC" />
              { !isMobile && <Text style={[styles.headerButtonText, { fontSize: 16 * fontSizeMultiplier }]}>저장</Text> }
            </TouchableOpacity>
            <TouchableOpacity
              style={isMobile ? styles.headerButtonMobile : styles.headerButton}
              onPress={() => setOptionsModalVisible(true)}
            >
              <Ionicons name="settings-outline" size={isMobile ? 24 : 28} color="#F4E4BC" />
            </TouchableOpacity>
          </View>
        </View>

        {/* --- 2. 메인 콘텐츠 (좌우 분할) --- */}
        <View style={isMobile ? styles.mainContentMobile : styles.mainContent}>
          {/* --- 2-1. 왼쪽 패널 (이미지) --- */}
          <View style={isMobile ? styles.leftPanelMobile : styles.leftPanel}>
            <View style={isMobile ? styles.imageContainerMobile : styles.imageContainer}>
              <Image
                source={
                  currentScene.image_path
                    ? { uri: currentScene.image_path }
                    : defaultImagePath
                }
                style={styles.sceneImage}
                resizeMode="cover"
              />
            </View>
          </View>

          {/* --- 2-2. 오른쪽 패널 (스토리 & 선택지) --- */}
          <View style={isMobile ? styles.rightPanelMobile : styles.rightPanel}>
            <View style={isMobile ? styles.topCellMobile : styles.topCell}>
              <ScrollView contentContainerStyle={isMobile ? styles.sceneContainerMobile : styles.sceneContainer}>
                <TypingText
                  text={currentScene.scene || ""}
                  onFinished={() => setIsTyping(false)}
                  isMobile={isMobile}
                  fontSizeMultiplier={fontSizeMultiplier}
                />
              </ScrollView>
            </View>

            {/* MedievalButton 선택지 */}
            <View style={isMobile ? styles.bottomCellMobile : styles.bottomCell}>
              <ScrollView contentContainerStyle={styles.choiceGrid}>
                {!isTyping &&
                  !isChoiceLoading &&
                  currentScene.choices.length > 0 &&
                  currentScene.choices.map(
                    (choiceText: string, index: number) => (
                      <MedievalButton
                        key={index}
                        onPress={() => handleChoice(index)}
                        disabled={isChoiceLoading}
                        isMobile={isMobile}
                        fontSizeMultiplier={fontSizeMultiplier}
                        buttonStyle={
                          scrollWidth > 0 ? { width: scrollWidth } : { width: isMobile ? "90%" : "100%" }
                        }
                      >
                        {choiceText}
                      </MedievalButton>
                    )
                  )}
                {!isTyping &&
                  !isChoiceLoading &&
                  currentScene.choices.length === 0 && (
                    <TouchableOpacity
                      style={[isMobile ? styles.actionButtonMobile : styles.actionButton, styles.startButton]}
                      onPress={() => router.replace('/storymode')}
                    >
                      <Text style={[isMobile ? styles.actionButtonTextMobile : styles.actionButtonText, { fontSize: (isMobile ? 16 : 18) * fontSizeMultiplier }]}>
                        이야기 목록으로 돌아가기
                      </Text>
                    </TouchableOpacity>
                  )}

                {isChoiceLoading && (
                  <ActivityIndicator size="small" color="#fff" />
                )}
              </ScrollView>
            </View>
            
            {error && <Text style={[styles.errorMessage, { fontSize: 14 * fontSizeMultiplier }]}>{error}</Text>}
          </View>
        </View>

        {/* 에러 메시지 (화면 하단에 고정) */}
        {error && <Text style={[styles.errorMessage, { fontSize: 14 * fontSizeMultiplier }]}>{error}</Text>}

        {/* 설정 모달 컴포넌트를 렌더링합니다. */}
        <OptionsModal
          visible={optionsModalVisible}
          onClose={() => setOptionsModalVisible(false)}
        />
      </ScrollView>
      <Modal
        transparent={true}
        visible={successModalVisible}
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={[styles.modalTitle, { fontSize: 22 * fontSizeMultiplier }]}>알림</Text>
            <Text style={[styles.modalMessage, { fontSize: 16 * fontSizeMultiplier }]}>{modalMessage}</Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSuccess]}
              onPress={() => setSuccessModalVisible(false)}
            >
              <Text style={[styles.modalButtonText, { fontSize: 16 * fontSizeMultiplier }]}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent={true}
        visible={errorModalVisible}
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={[styles.modalTitle, { fontSize: 22 * fontSizeMultiplier }]}>오류</Text>
            <Text style={[styles.modalMessage, { fontSize: 16 * fontSizeMultiplier }]}>{modalMessage}</Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonError]}
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

// 스타일 정의
const styles = StyleSheet.create({
  headerButtonText: {
    color: "#F4E4BC",
    fontFamily: "neodgm",
  },
  storyTitle: {
    color: "#F4E4BC",
    fontFamily: "neodgm",
    fontWeight: "bold",
    textAlign: 'center',
  },
  storyTitleMobile: {
    color: "#F4E4BC",
    fontFamily: "neodgm",
    fontWeight: "bold",
    textAlign: 'center',
  },
  sceneDescription: {
    color: "#000000ff",
    lineHeight: 40,
    fontFamily: "neodgm",
    textAlign: "center",
  },
  sceneDescriptionMobile: {
    color: "#000000ff",
    lineHeight: 28,
    fontFamily: "neodgm",
    textAlign: "center",
  },
  errorMessage: {
    color: "#ff6b6b",
    textAlign: "center",
    marginTop: 20,
    fontWeight: "bold",
    fontFamily: "neodgm",
  },
  buttonText: {
    fontFamily: "neodgm",
    color: "#f0e6d2",
    fontWeight: "normal", // 'regular' 대신 'normal' 사용
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    paddingHorizontal: 10,
  },
  mediumButtonTextMobile: { 
    fontFamily: "neodgm",
    color: "#f0e6d2"
  },
  actionButtonText: {
    color: "white",
    fontFamily: "neodgm",
    fontWeight: "600",
  },
  actionButtonTextMobile: {
    color: "white",
    fontFamily: "neodgm",
    fontWeight: "600",
  },
  modalTitle: {
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "neodgm",
    marginBottom: 15,
  },
  modalMessage: {
    color: "#FFFFFF",
    fontFamily: "neodgm",
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 24,
  },
  modalButtonText: {
    color: "white",
    fontFamily: "neodgm",
    fontWeight: "bold",
  },
  outerContainer: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    padding: 15,
  },
  container: {
    flexGrow: 1,
    padding: 15,
  },
  containerMobile: {
    flexGrow: 1,
    padding: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    marginBottom: 15,
    flexShrink: 0,
  },
  headerMobile: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 5,
    marginBottom: 10,
    flexShrink: 0,
  },
  headerLeft: {
    flex: 1, 
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 10,
  },
  headerLeftMobile: {
    flex: 1, 
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 5,
  },
  headerTitleContainer: {
    flex: 2, 
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButton: {
    alignItems: "center",
    padding: 8,
    flexDirection: "row",
    gap: 5,
  },
  headerButtonMobile: {
    alignItems: "center",
    padding: 5,
  },
  headerButtonTextMobile: {
    color: "#F4E4BC",
    fontFamily: "neodgm",
  },
  headerRight: {
    flex: 1,
    flexDirection: "row",
    justifyContent: 'flex-end',
    alignItems: "center",
    gap: 10,
  },
  headerRightMobile: {
    flex: 1,
    flexDirection: "row",
    justifyContent: 'flex-end',
    alignItems: "center",
    gap: 5,
  },
  mainContent: {
    flex: 1,
    flexDirection: "row",
    gap: 15,
  },
  mainContentMobile: {
    flex: 1,
    flexDirection: "column",
    gap: 10,
  },
  leftPanel: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    color: "#1e1e1e",
  },
  leftPanelMobile: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    color: "#1e1e1e",
  },
  imageContainer: {
    width: "100%",
    height: 700,
    backgroundColor: "#20232a",
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444",
    marginBottom: 10,
    overflow: "hidden",
  },
  imageContainerMobile: {
    width: "100%",
    height: 300,
    backgroundColor: "#20232a",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444",
    marginBottom: 5,
    overflow: "hidden",
  },
  sceneImage: {
    width: "100%",
    height: "100%",
  },
  placeholderText: {
    color: "#888",
    fontSize: 16,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  timerText: {
    color: "#aaa",
    fontSize: 14,
    marginTop: 15,
  },
  durationText: {
    color: "#aaa",
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 15,
  },
  rightPanel: {
    flex: 1,
    flexDirection: "column",
    borderColor: "black",
    borderRadius: 15,
    backgroundColor: "#1e1e1e",
    padding: 10,
  },
  rightPanelMobile: {
    flex: 1,
    flexDirection: "column",
    borderColor: "black",
    borderRadius: 10,
    backgroundColor: "#1e1e1e",
    padding: 8,
  },
  topCell: {
    flex: 1,
    justifyContent: "center",
  },
  topCellMobile: {
    flex: 1,
    justifyContent: "center",
    minHeight: 200,
  },
  bottomCell: {
    flex: 1,
    justifyContent: "center",
    paddingTop: 15,
  },
  bottomCellMobile: {
    flex: 1,
    justifyContent: "center",
    paddingTop: 10,
  },
  sceneContainer: {
    backgroundColor: "#F4E4BC",
    borderRadius: 10,
    padding: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sceneContainerMobile: {
    backgroundColor: "#F4E4BC",
    borderRadius: 8,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  choiceGrid: {
    marginTop: 20,
    gap: 10,
    alignItems: "center",
  },
  choiceText: {
    color: "#282c34",
    fontSize: 4,
    fontWeight: "normal", // 'light' 대신 'normal' 사용
    textAlign: "center",
  },
  buttonContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 12,
    height: 300,
  },
  mediumButton: { width: "100%", height: 70 },
  mediumButtonMobile: { width: "100%", height: 60, marginVertical: 8, },
  largeButton: { width: "150%", height: 80 },

  outerBorder: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backgroundColor: "#4a2c1a",
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#2a180e",
  },
  innerBorder: {
    position: "absolute",
    width: "102%",
    height: "100%",
    backgroundColor: "#8B4513",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#c88a5a",
  },
  buttonBody: {
    width: "100%",
    height: "80%",
    backgroundColor: "#6a381a",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 5,
  },
  buttonBodyMobile: {
    width: "100%",
    height: "80%",
    backgroundColor: "#6a381a",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 5,
  },
  pressed: { backgroundColor: "#4a2c1a" },
  mediumButtonText: { 
    fontFamily: "neodgm",
    color: "#f0e6d2"
  },
  largeButtonText: { fontSize: 24 },
  chain: {
    position: "absolute",
    width: 8,
    height: 16,
    backgroundColor: "#4a2c1a",
    borderWidth: 1,
    borderColor: "#2a180e",
  },
  chainTopLeft: {
    top: -8,
    left: 30,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  chainTopRight: {
    top: -8,
    right: 30,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  chainBottomLeft: {
    bottom: -8,
    left: 30,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  chainBottomRight: {
    bottom: -8,
    right: 30,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  chainPin: {
    position: "absolute",
    top: -4,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: "#c88a5a",
    borderRadius: 4,
  },
  actionButton: {
    alignItems: "center",
    width: 250,
    paddingVertical: 18,
    borderRadius: 10,
  },
  actionButtonMobile: {
    alignItems: "center",
    width: "90%",
    paddingVertical: 14,
    borderRadius: 8,
  },
  startButton: {
    backgroundColor: "#7C3AED",
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
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    width: '50%',
    alignItems: 'center',
  },
  modalButtonSuccess: {
    backgroundColor: '#7C3AED',
  },
  modalButtonError: {
    backgroundColor: '#EF4444',
  },
});