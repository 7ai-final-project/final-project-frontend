// final-project/frontend/app/image_gen/index.tsx (실시간 로딩 타이머 추가)

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import api from "../../services/api"; // Axios 인스턴스 경로. 실제 프로젝트에 맞게 조정하세요.

// 이 화면에서 테스트하기 위한 샘플 데이터입니다.
// 통합 테스트용 (JSON 파일 사용)
const SAMPLE_STORY_ID = "해와달";
const arr = [
  {
    name: "MOM_INTRO",
    desc: "이야기의 시작. 엄마를 기다리다 신비로운 빛을 마주하는 장면을 묘사한다.",
  },
  {
    name: "MOM_TIGER_KNOCK",
    desc: "엄마를 흉내 낸 호랑이가 문을 열어달라고 하는 긴장감 넘치는 상황을 묘사한다. 아이들이 위기감을 느끼게 만든다.",
  },
  {
    name: "MOM_ESCAPE_TREE",
    desc: "아이들이 호랑이를 피해 뒷마당으로 도망쳐 큰 나무 위로 올라가는 장면을 묘사한다. 호랑이가 나무 아래에서 아이들을 올려다보게 만든다.",
  },
  {
    name: "MOM_PRAY_ROPE",
    desc: "호랑이가 나무를 거의 다 올라오자, 아이들이 하늘에 기도를 드리는 절박한 장면을 묘사한다. 하늘에서 동아줄이 내려오는 기적적인 상황을 연출한다.",
  },
];

// 이 화면에서 테스트하기 위한 샘플 데이터입니다.
// const SAMPLE_STORY_ID = "sun_and_moon";
// const SAMPLE_SCENE_NAME = "escape_tree";
const SAMPLE_SCENE_DESC =
  '오누이는 호랑이라는 것을 깨닫고 뒷문으로 몰래 빠져나와 마당의 커다란 나무 위로 올라갔다. 아래에서 호랑이가 나무를 흔들며 울부짖는다. "내려오지 못할까!"';

export default function ImageGeneratorScreen() {
  // 통합 테스트용 (JSON 파일 사용)
  const [sceneIndex, setSceneIndex] = useState(0);
  const [sceneName, setSceneName] = useState(arr[0].name);
  const [sceneDesc, setSceneDesc] = useState(arr[0].desc);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState<string | null>(null);

  // ★★★ 1. 실시간 타이머를 위한 state와 ref 추가 ★★★
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 컴포넌트가 언마운트될 때 타이머 정리
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleGenerateImageWithScene = async (scene: string) => {
    setIsLoading(true);
    setImageUrl(null);
    setDuration(null);
    setElapsedTime(0); // 타이머 초기화

    // ★★★ 2. 타이머 시작 ★★★
    // 이전 타이머가 남아있을 경우를 대비해 먼저 정리
    if (intervalRef.current) clearInterval(intervalRef.current);
    // 0.1초마다 elapsedTime을 0.1씩 증가시키는 타이머 설정
    intervalRef.current = setInterval(() => {
      setElapsedTime((prevTime) => prevTime + 0.1);
    }, 100);

    try {
      const response = await api.post("/image-gen/api/generate-scene-image/", {
        story_id: SAMPLE_STORY_ID,
        // scene_name: SAMPLE_SCENE_NAME,
        scene_name: scene,
      });

      if (response.data) {
        setImageUrl(response.data.image_url);
        setDuration(response.data.duration);
      } else {
        Alert.alert("오류", "이미지 데이터를 받아오지 못했습니다.");
      }
    } catch (error: any) {
      console.error("이미지 생성 실패:", error);
      const errorMessage =
        error.response?.data?.error || "알 수 없는 오류가 발생했습니다.";
      Alert.alert("이미지 생성 실패", errorMessage);
    } finally {
      setIsLoading(false);
      // ★★★ 3. API 요청 완료 시 타이머 중지 ★★★
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  // 통합 테스트용 (JSON 파일 사용)
  const handleGenerateImage = () => {
    handleGenerateImageWithScene(sceneName); // 기본 버튼은 현재 sceneName 사용
  };

  // 다음으로 이동
  const handleNextScene = () => {
    const nextIndex = (sceneIndex + 1) % arr.length;
    setSceneIndex(nextIndex);
    setSceneName(arr[nextIndex].name);
    setSceneDesc(arr[nextIndex].desc);

    // 바로 다음 장면 이미지 생성
    handleGenerateImageWithScene(arr[nextIndex].name);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>스토리 기반 이미지 생성</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>현재 장면 (테스트용)</Text>
        {/* <Text style={styles.cardDesc}>{SAMPLE_SCENE_DESC}</Text> */}
        <Text style={styles.cardDesc}>{sceneDesc}</Text>
      </View>

      <View style={styles.imageContainer}>
        {isLoading ? (
          // ★★★ 4. 로딩 중에 로딩 아이콘과 실시간 타이머를 함께 표시 ★★★
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
            버튼을 눌러 이미지를 생성하세요.
          </Text>
        )}
      </View>

      {/* 최종 소요 시간은 이미지가 생성된 후에 표시 */}
      {imageUrl && duration && (
        <Text style={styles.durationText}>(실제 생성 시간: {duration}초)</Text>
      )}

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleGenerateImage}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? "픽셀 아트 생성 중..." : "DALL-E 3로 이미지 생성하기"}
        </Text>
      </TouchableOpacity>

      {/* 다음으로 이동 */}
      <TouchableOpacity
        style={[styles.button, { marginTop: 10 }]}
        onPress={handleNextScene}
      >
        <Text style={styles.buttonText}>다음 장면으로 이동</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#282c34",
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "white",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    padding: 20,
    width: "100%",
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#61dafb",
  },
  cardDesc: {
    fontSize: 16,
    color: "white",
    marginTop: 10,
  },
  imageContainer: {
    width: "100%",
    height: 300,
    backgroundColor: "#20232a",
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444",
  },
  sceneImage: {
    width: "100%",
    height: "100%",
    borderRadius: 15,
  },
  placeholderText: {
    color: "#888",
    fontSize: 16,
  },
  // ★★★ 5. 로딩 컨테이너와 타이머 텍스트 스타일 추가 ★★★
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
    marginTop: 10,
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#61dafb",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#555",
  },
  buttonText: {
    color: "#20232a",
    fontSize: 18,
    fontWeight: "bold",
  },
});
