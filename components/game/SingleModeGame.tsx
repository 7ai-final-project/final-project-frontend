import React, { useState, useEffect, useRef, ReactNode } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, ImageBackground, Pressable, Animated, LayoutChangeEvent, ViewStyle } from "react-native";
import api from "../../services/api";
import { Audio } from "expo-av";
import { Ionicons } from '@expo/vector-icons';
import OptionsModal from '../OptionsModal'; 
import { router } from 'expo-router';

interface GameProps {
  initialData: {
    scene: string;
    choices: string[];
    story_id: string;
    story_title: string;
    current_moment_id: string;
    current_moment_title: string;
    image_path: string;
  };
}

interface MedievalButtonProps {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  buttonStyle?: ViewStyle; // 동적인 스타일을 받을 수 있도록 추가
}

const TypingText = ({ text, onFinished }: { text: string, onFinished: () => void }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText('');
    
    // 마침표 뒤에 새 문장이 오면 줄바꿈 추가
    const processedText = text.replace(/\. ([가-힣A-Za-z])/g, '.\n$1');
    
    let i = 0;
      const intervalId = setInterval(() => {
      // 한 글자씩 추가하는 대신, substring을 사용하여 항상 올바른 길이의 텍스트를 보장합니다.
      // 이것이 상태 업데이트 지연으로 인한 문제를 방지합니다.
      setDisplayedText(text.substring(0, i + 1));
      i++;

      if (i > text.length) {
        clearInterval(intervalId);
        onFinished();
      }
    }, 40); // 타이핑 속도 (ms)

    // 컴포넌트가 업데이트되거나 사라질 때, 이전의 인터벌을 반드시 정리합니다.
    return () => clearInterval(intervalId);
  }, [text]); // text prop이 바뀔 때만 이 효과를 다시 실행합니다.

  return (
      <Text style={styles.sceneDescription}>
          {displayedText}
          {/* 타이핑이 끝났는지 여부는 onFinished 콜백으로 관리되므로, 커서는 displayedText 길이로 판단합니다. */}
          {displayedText.length < text.length && <Text style={{ opacity: 0.5 }}>|</Text>}
      </Text>
  );
};

const MedievalButton: React.FC<MedievalButtonProps> = ({
  children,
  onPress,
  disabled = false,
  buttonStyle = {}, // 기본값을 빈 객체로 설정
}) => {
    const scaleValue = useRef(new Animated.Value(1)).current;
    const [isPressed, setIsPressed] = useState(false);

    const onPressIn = () => {
        if (disabled) return;
        setIsPressed(true);
        Animated.spring(scaleValue, { toValue: 0.97, useNativeDriver: true }).start();
    };
    const onPressOut = () => {
        if (disabled) return;
        setIsPressed(false);
        Animated.spring(scaleValue, { toValue: 1, useNativeDriver: true }).start();
    };

    return (
        <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} disabled={disabled}>
            <Animated.View style={[styles.buttonContainer, styles.mediumButton, { transform: [{ scale: scaleValue }] }]}>
                <View style={styles.outerBorder} />
                <View style={styles.innerBorder} />
                <View style={[styles.buttonBody, isPressed && styles.pressed]}>
                    <Text style={[styles.buttonText, styles.mediumButtonText]}>{children}</Text>
                </View>
                <View style={[styles.chain, styles.chainTopLeft]}><View style={styles.chainPin} /></View>
                <View style={[styles.chain, styles.chainTopRight]}><View style={styles.chainPin} /></View>
                <View style={[styles.chain, styles.chainBottomLeft]}><View style={styles.chainPin} /></View>
                <View style={[styles.chain, styles.chainBottomRight]}><View style={styles.chainPin} /></View>
            </Animated.View>
        </Pressable>
    );
};

export default function SingleModeGame({ initialData }: GameProps) {
  // 텍스트 게임 진행 관련 상태 변수들
  const [sceneText, setSceneText] = useState<string | null>(initialData.scene);
  const [choices, setChoices] = useState<string[]>(initialData.choices);
  const [storyTitle] = useState<string>(initialData.story_title);
  const [currentMomentId, setCurrentMomentId] = useState<string>(initialData.current_moment_id);
  const [currentMomentTitle, setCurrentMomentTitle] = useState<string>(initialData.current_moment_title);
  const [currentMomentImage, setCurrentMomentImage] = useState<string>(initialData.image_path);
  const [error, setError] = useState("");

  const [scrollWidth, setScrollWidth] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [isBgmOn, setIsBgmOn] = useState(true);
  const [isSfxOn, setIsSfxOn] = useState(true);
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState(1);
  const [backgroundColor, setBackgroundColor] = useState('#20232a');
  

  // 이미지 생성 및 로딩 관련 상태 변수들
  const defaultImagePath = require('../../assets/images/game/multi_mode/background/scene_door.png');
  const [isImageLoading, setIsImageLoading] = useState(false); // 이미지 생성 중 로딩
  const [isChoiceLoading, setIsChoiceLoading] = useState(false); // 다음 장면 텍스트 로딩
  
  const [duration, setDuration] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | number | null>(null);

  // 효과음 관련 상태 변수들
  const [clickSound, setClickSound] = useState<Audio.Sound | null>(null);
  const [pageTurnSound, setPageTurnSound] = useState<Audio.Sound | null>(null);
  const [goodEndingMusic, setGoodEndingMusic] = useState<Audio.Sound | null>(null);
  const [badEndingMusic, setBadEndingMusic] = useState<Audio.Sound | null>(null);


  // 효과음 로딩을 위한 useEffect
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

        // 새로운 엔딩 음악 로드
        const { sound: loadedGoodEndingMusic } = await Audio.Sound.createAsync(
            require('../../assets/sounds/good_ending.mp3')
        );
        setGoodEndingMusic(loadedGoodEndingMusic)

        const { sound: loadedBadEndingMusic } = await Audio.Sound.createAsync(
            require('../../assets/sounds/bad_ending.mp3')
        );
        setBadEndingMusic(loadedBadEndingMusic);

      } catch (error) {
        console.error("사운드 로딩 실패:", error);
      }
    };
    loadSounds();
    console.log(initialData);

    // 컴포넌트가 사라질 때 모든 사운드 리소스 정리
    return () => {
      clickSound?.unloadAsync();
      pageTurnSound?.unloadAsync();
      goodEndingMusic?.unloadAsync();
      badEndingMusic?.unloadAsync();
    };
  }, []);

  // 타이머 정리를 위한 useEffect
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current as any);
    };
  }, []);

  useEffect(() => {
    if(currentMomentTitle.startsWith('ENDING_')) {
      const goodEndings = ['GOOD', 'FUNNY', 'HAPPY', 'SECRET'];
      const badEndings = ['BAD', 'GIVEUP'];
      
      if(goodEndings.some(pattern => currentMomentTitle.includes(pattern))) {
        goodEndingMusic?.playAsync();
      } else if (badEndings.some(pattern => currentMomentTitle.includes(pattern))) {
        badEndingMusic?.playAsync();
      }
    }
  }, [currentMomentId, currentMomentTitle]);

  // 사용자가 선택지를 눌렀을 때의 처리 (텍스트 업데이트 및 이미지 생성 트리거)
  const handleChoice = async (choiceIndex: number) => {
    goodEndingMusic?.stopAsync();
    badEndingMusic?.stopAsync();
 
    await clickSound?.replayAsync();
    setIsChoiceLoading(true);
    setError("");
    setChoices([]);
 
    try {
      const response = await api.post("game/story/choice/", {
        story_title: storyTitle,
        choice_index: choiceIndex,
        current_moment_id: currentMomentId,
      });
 
      await pageTurnSound?.replayAsync();
      const { scene, choices: newChoices, current_moment_id: nextMomentId, current_moment_title: nextMomentTitle, image_path: nextImagePath } = response.data;
 
      setIsTyping(true);
      setSceneText(scene);
      setChoices(newChoices || []);
      setCurrentMomentId(nextMomentId);
      setCurrentMomentTitle(nextMomentTitle);
      setCurrentMomentImage(nextImagePath);
    } catch (err) {
      setError("이야기를 이어가는 데 실패했습니다.");
      console.error(err);
    } finally {
      setIsChoiceLoading(false);
    }
  };

  const onScrollLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setScrollWidth(width);
  };
 
  return (
    <View style={{ flex: 1, backgroundColor: backgroundColor }}>
     <ScrollView contentContainerStyle={styles.container}>
        {/* --- 1. 헤더 --- */}
         <View style={styles.header}>
          {/* 1. 왼쪽: 뒤로가기 버튼 */}
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#F4E4BC" />
            {/* <Text style={styles.headerButtonText}>Back</Text> */}
          </TouchableOpacity>

          {/* 2. 가운데: 스토리 제목 */}
          <Text style={styles.storyTitle}>{storyTitle}</Text>

          {/* 3. 오른쪽: 저장 & 설정 버튼 그룹 */}
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="save-outline" size={28} color="#F4E4BC" />
              <Text style={styles.headerButtonText}>저장</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={() => setOptionsModalVisible(true)}>
              <Ionicons name="settings-outline" size={28} color="#F4E4BC" />
            </TouchableOpacity>
          </View>
          </View>

        {/* --- 2. 메인 콘텐츠 (좌우 분할) --- */}
        <View style={styles.mainContent}>
          {/* --- 2-1. 왼쪽 패널 (이미지) --- */}
          <View style={styles.leftPanel}>
            <View style={styles.imageContainer}>
              <Image 
                source={currentMomentImage ? { uri: currentMomentImage } : defaultImagePath} 
                style={styles.sceneImage} 
                resizeMode="cover" 
              />
            </View>
          </View>

          {/* --- 2-2. 오른쪽 패널 (스토리 & 선택지) --- */}
          <View style={styles.rightPanel}>
           {/*<ScrollView contentContainerStyle={styles.rightPanelContent}>*/}
          
          <View style={styles.topCell}>
            {/* 이제 ImageBackground 대신, 스타일로 꾸민 View를 사용합니다. */}
            <ScrollView contentContainerStyle={styles.sceneContainer}>
              <TypingText text={sceneText || ''} onFinished={() => setIsTyping(false)} />
            </ScrollView>
          </View>

              {/* MedievalButton 선택지 */}
            <View style={styles.bottomCell}>
            <ScrollView contentContainerStyle={styles.choiceGrid}>
                {!isTyping && !isChoiceLoading &&
                  choices.map((choiceText: string, index: number) => (
                  <MedievalButton
                    key={index}
                    onPress={() => handleChoice(index)}
                    disabled={isChoiceLoading}
                    // 측정된 두루마리 너비(scrollWidth)가 0보다 클 때만 적용합니다.
                    buttonStyle={scrollWidth > 0 ? { width: scrollWidth } : {}}
                  >
                    {choiceText}
                  </MedievalButton>
                  ))
                }
                {isChoiceLoading && <ActivityIndicator size="small" color="#fff" />}
              </ScrollView>
              </View>
            {error && <Text style={styles.errorMessage}>{error}</Text>}
          </View>
        </View>

        {/* 에러 메시지 (화면 하단에 고정) */}
        {error && <Text style={styles.errorMessage}>{error}</Text>}

        {/* 설정 모달 컴포넌트를 렌더링합니다. */}
        <OptionsModal
              visible={optionsModalVisible}
              onClose={() => setOptionsModalVisible(false)}
              isBgmOn={isBgmOn}
              setIsBgmOn={setIsBgmOn}
              isSfxOn={isSfxOn}
              setIsSfxOn={setIsSfxOn}
              fontSizeMultiplier={fontSizeMultiplier}
              setFontSizeMultiplier={setFontSizeMultiplier}
              backgroundColor={backgroundColor}
              setBackgroundColor={setBackgroundColor}
        />
      </ScrollView>
    </View>
  );
}


// 스타일 정의
const styles = StyleSheet.create({
    // 최상위 컨테이너
  outerContainer: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    padding: 15,
  },
  container: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginBottom: 15,
    flexShrink: 0, 
  },
  headerButton: {
    alignItems: 'center',
    padding: 5,
  },
  headerButtonText: {
    color: '#F4E4BC',
    fontSize: 16, // neodgm 폰트는 크기가 작으므로 키워줍니다.
    fontFamily: 'neodgm',
  },
    headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  storyTitle: {
    color: '#F4E4BC',
    fontSize: 28, // neodgm 폰트는 크기가 작으므로 키워줍니다.
    fontFamily: 'neodgm',
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1, // 헤더를 제외한 나머지 공간을 모두 차지
    flexDirection: 'row', // 자식 요소(leftPanel, rightPanel)를 가로로 배열
    gap: 15, // 왼쪽과 오른쪽 패널 사이의 간격
  },

  // 왼쪽 패널 (이미지)
  leftPanel: {
    flex: 1, // 가로 비율 1
    justifyContent: 'center',
    alignItems: 'center',
    color: '#1e1e1e', 
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
    overflow: 'hidden',
  },
  sceneImage: { 
    width: "100%", 
    height: "100%",
  },
 placeholderText: { 
    color: "#888", 
    fontSize: 16 
  },
  loadingContainer: { 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  timerText: { 
    color: '#aaa', 
    fontSize: 14, 
    marginTop: 15 
  },
  durationText: {
    color: "#aaa",
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 15,
  },
  // 오른쪽 패널 (스토리 & 선택지)
  rightPanel: {
    flex: 1, // 가로 비율 1
    flexDirection: 'column', 
    borderColor: 'black',
    borderRadius: 15, 
    backgroundColor: '#1e1e1e', 
    padding: 10, 
  },
  // 위쪽 셀 (흰색 종이)
  topCell: {
    flex: 1, // ★★★ 공간을 1의 비율 (50%)로 차지 ★★★
    justifyContent: 'center',
  },
  // 아래쪽 셀 (선택지)
  bottomCell: {
    flex: 1, // ★★★ 공간을 1의 비율 (50%)로 차지 ★★★
    justifyContent: 'center',
    paddingTop: 15, // 위쪽 셀과의 간격
  },
  sceneContainer: {
    backgroundColor: '#F4E4BC', 
    borderRadius: 10,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,

  },
  sceneDescription: { 
    color: "#000000ff",
    fontSize: 22, 
    lineHeight: 40,
    fontFamily: 'neodgm',
    textAlign: 'center',
  },
  choiceGrid: { 
    marginTop: 20, 
    gap: 10,
    alignItems: 'center',
  },
  choiceText: {
    color: "#282c34",
    fontSize: 4,
    fontWeight: "light",
    textAlign: "center",
  },
  errorMessage: {
    color: "#ff6b6b",
    textAlign: "center",
    marginTop: 20,
    fontWeight: "bold",
    fontFamily: 'neodgm',
  },

  // --- MedievalButton 관련 스타일을 index.tsx에서 복사해옵니다. ---
  buttonContainer: { justifyContent: 'center', alignItems: 'center', marginVertical: 12, height: 300 },
  mediumButton: { width: '100%', height: 70, },
  largeButton: { width: '150%', height: 80 },
  outerBorder: { position: 'absolute', width: '100%', height: '100%', backgroundColor: '#4a2c1a', borderRadius: 18, borderWidth: 2, borderColor: '#2a180e' },
  innerBorder: { position: 'absolute', width: '102%', height: '100%', backgroundColor: '#8B4513', borderRadius: 14, borderWidth: 2, borderColor: '#c88a5a' },
  buttonBody: { width: '100%', height: '80%', backgroundColor: '#6a381a', borderRadius: 10, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 2, elevation: 5 },
  pressed: { backgroundColor: '#4a2c1a' },
  buttonText: {
    fontFamily: 'neodgm',
    fontSize: 28, // 폰트 크기 약간 조정
    color: '#f0e6d2',
    fontWeight: 'regular',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    paddingHorizontal: 10,
  },
  mediumButtonText: { fontSize: 30 }, // neodgm 폰트에 맞게 크기 조정
  largeButtonText: { fontSize: 24 },
  chain: { position: 'absolute', width: 8, height: 16, backgroundColor: '#4a2c1a', borderWidth: 1, borderColor: '#2a180e' },
  chainTopLeft: { top: -8, left: 30, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  chainTopRight: { top: -8, right: 30, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  chainBottomLeft: { bottom: -8, left: 30, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  chainBottomRight: { bottom: -8, right: 30, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  chainPin: { position: 'absolute', top: -4, left: 0, right: 0, height: 8, backgroundColor: '#c88a5a', borderRadius: 4 },
});