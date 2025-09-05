// final-project/frontend/components/game/SingleModeGame.tsx (통합 최종본)

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import api from "../../services/api";
import { Audio } from "expo-av";

// 컴포넌트가 받을 초기 데이터의 타입을 정의합니다.
interface GameProps {
  initialData: {
    scene: string;
    choices: string[];
    story_id: string;
    current_moment_id: string;
  };
}

export default function SingleModeGame({ initialData }: GameProps) {
  // 텍스트 게임 진행 관련 상태 변수들
  const [sceneText, setSceneText] = useState<string | null>(initialData.scene);
  const [choices, setChoices] = useState<string[]>(initialData.choices);
  const [storyId] = useState<string>(initialData.story_id);
  const [currentMomentId, setCurrentMomentId] = useState<string>(
    initialData.current_moment_id
  );
  const [error, setError] = useState("");

  // 이미지 생성 및 로딩 관련 상태 변수들
  const [isImageLoading, setIsImageLoading] = useState(false); // 이미지 생성 중 로딩
  const [isChoiceLoading, setIsChoiceLoading] = useState(false); // 다음 장면 텍스트 로딩
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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

  // ★★★ 여기가 핵심 기능입니다! ★★★
  // `currentMomentId`가 변경될 때마다 자동으로 해당 장면에 대한 이미지를 생성합니다.
  useEffect(() => {
        // `currentMomentId`가 문자열이고, 'END_'로 시작하는지 확인합니다.
    if (typeof currentMomentId === 'string' && currentMomentId.startsWith('END_')) {
        
        // 사용자님의 JSON 구조에 따라 엔딩 ID를 확인합니다.
        if (currentMomentId === 'END_GOOD_SUN_MOON') {
            goodEndingMusic?.playAsync();
        } else if (currentMomentId === 'END_BAD_OPEN_DOOR' || currentMomentId === 'END_BAD_TELL_SECRET') {
            badEndingMusic?.playAsync();
        }
    }
    const generateImageForCurrentScene = async () => {
      // `currentMomentId`가 없으면 (예: 게임 시작 전) 실행하지 않습니다.
      if (!currentMomentId) return;

      // 이미지 로딩 상태 초기화
      setIsImageLoading(true);
      setImageUrl(null);
      setDuration(null);
      setElapsedTime(0);

      // 실시간 타이머 시작
      if (intervalRef.current) clearInterval(intervalRef.current as any);
      intervalRef.current = setInterval(() => {
        setElapsedTime((prevTime) => prevTime + 0.1);
      }, 100);

      try {
        // 백엔드의 이미지 생성 API를 호출합니다.
        const response = await api.post(
          "/image-gen/api/generate-scene-image/",
          {
            story_id: storyId,
            scene_name: currentMomentId, // 현재 장면 ID를 전달
          }
        );

        if (response.data) {
          setImageUrl(response.data.image_url);
          setDuration(response.data.duration);
        } else {
          Alert.alert("오류", "이미지 데이터를 받아오지 못했습니다.");
        }
      } catch (error: any) {
        console.error("이미지 생성 실패:", error);
        // (선택사항) 사용자에게 에러 알림
        // Alert.alert("이미지 생성 실패", error.response?.data?.error || "알 수 없는 오류");
      } finally {
        // 이미지 로딩이 성공하든 실패하든 로딩 상태를 종료하고 타이머를 멈춥니다.
        setIsImageLoading(false);
        if (intervalRef.current) clearInterval(intervalRef.current as any);
      }
    };

    // 컴포넌트가 처음 렌더링될 때, 그리고 `currentMomentId`가 바뀔 때마다 이 함수가 실행됩니다.
    generateImageForCurrentScene();
  }, [currentMomentId]); // `currentMomentId`의 변화를 감지합니다.

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
        story_id: storyId,
        choice_index: choiceIndex,
        current_moment_id: currentMomentId,
      });
 
      await pageTurnSound?.replayAsync();
      const {
        scene,
        choices: newChoices,
        current_moment_id: nextMomentId,
      } = response.data;
 
      setSceneText(scene);
      setChoices(newChoices || []);
      setCurrentMomentId(nextMomentId);
    } catch (err) {
      setError("이야기를 이어가는 데 실패했습니다.");
      console.error(err);
    } finally {
      setIsChoiceLoading(false);
    }
  };

  // 화면 렌더링
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.sceneContainer}>
        <Text style={styles.sceneDescription}>{sceneText}</Text>
      </View>

      <View style={styles.imageContainer}>
        {isImageLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#61dafb" />
            <Text style={styles.timerText}>
              {elapsedTime.toFixed(1)}초 경과...
            </Text>
          </View>
        ) : imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.sceneImage}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.placeholderText}>
            장면 이미지를 불러오는 중...
          </Text>
        )}
      </View>

      {imageUrl && !isImageLoading && duration && (
        <Text style={styles.durationText}>(실제 생성 시간: {duration}초)</Text>
      )}

      <View style={styles.choiceGrid}>
        {isChoiceLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          choices.map((choiceText: string, index: number) => (
            <TouchableOpacity
              key={index}
              style={styles.choiceCard}
              onPress={() => handleChoice(index)}
              disabled={isChoiceLoading}
            >
              <Text style={styles.choiceText}>{choiceText}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {error && <Text style={styles.errorMessage}>{error}</Text>}
    </ScrollView>
  );
}

// 스타일 정의
const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 10, backgroundColor: "#1e1e1e" },
  sceneContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    padding: 20,
    borderRadius: 15,
    minHeight: "30%",
    justifyContent: "center",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#333",
  },
  sceneDescription: { color: "white", fontSize: 18, lineHeight: 28 },
  imageContainer: {
    width: "100%",
    height: 250,
    backgroundColor: "#20232a",
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444",
    marginBottom: 10,
  },
  sceneImage: { width: "100%", height: "100%", borderRadius: 15 },
  placeholderText: { color: "#888", fontSize: 16 },
  loadingContainer: { justifyContent: "center", alignItems: "center" },
  timerText: { color: "#aaa", fontSize: 14, marginTop: 15 },
  durationText: {
    color: "#aaa",
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 15,
  },
  choiceGrid: { marginTop: 10, gap: 15, minHeight: 50 },
  choiceCard: {
    backgroundColor: "#61dafb",
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderRadius: 12,
    opacity: 1, // isChoiceLoading일 때 비활성화 스타일을 줄 수도 있음
  },
  choiceText: {
    color: "#282c34",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  errorMessage: {
    color: "#ff6b6b",
    textAlign: "center",
    marginTop: 20,
    fontWeight: "bold",
  },
});