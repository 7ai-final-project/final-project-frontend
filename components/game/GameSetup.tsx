// components/game/GameSetup.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
  ScrollView,
} from "react-native";
import { storage } from "@/util/util";
// [수정] 타입 정의를 포함한 통합 캐릭터 데이터 파일을 import 합니다.
import { charactersByTopic, Character } from "@/data/characterData";
import { useWebSocket } from "@/components/context/WebSocketContext";

interface GameSetupProps {
  topic: string | string[];
  difficulty: string | string[];
  roomId: string | string[];
  // [수정] onStart 함수는 이제 명확한 Character 타입을 전달받습니다.
  onStart: (character: Character) => void;
}

// [수정] 어떤 능력치든 유연하게 표시할 수 있는 컴포넌트입니다.
// Record<string, number> 타입을 사용해 어떤 형태의 stats 객체든 처리할 수 있음을 명시합니다.
const CharacterStats = ({ stats }: { stats: Record<string, number> }) => (
  <View style={styles.statsContainer}>
    {Object.entries(stats).map(([label, value]) => (
      <Text key={label} style={styles.statText}>
        {label}: {value}
      </Text>
    ))}
  </View>
);

export default function GameSetup({ topic, difficulty, roomId, onStart }: GameSetupProps) {
  // [추가] 주제에 맞는 캐릭터 목록을 담을 상태
  const [activeCharacters, setActiveCharacters] = useState<Character[]>([]);

  const [username, setUsername] = useState<string>("플레이어");
  // [수정] 선택된 캐릭터의 인덱스만 관리합니다.
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(null);
  const [takenCharacters, setTakenCharacters] = useState<string[]>([]);
  const [phase, setPhase] = useState<"loading" | "character" | "loadingSteps" | "confirm">("loading");
  const [loadingMessage, setLoadingMessage] = useState("캐릭터를 생성 중입니다...");
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [hasShownCharacterModal, setHasShownCharacterModal] = useState(false);
  const [loadingImage, setLoadingImage] = useState<any>(null);

  const { wsRef } = useWebSocket();

  // [추가] topic prop이 바뀔 때마다 그에 맞는 캐릭터 목록을 activeCharacters 상태에 설정합니다.
  useEffect(() => {
    const currentTopic = Array.isArray(topic) ? topic[0] : topic;
    // '해와달' 또는 '판타지의 어느 세계'에 맞는 캐릭터 목록을 가져옵니다.
    const characterList = charactersByTopic[currentTopic] || [];
    setActiveCharacters(characterList);
    // 주제가 바뀌면 캐릭터 선택을 초기화합니다.
    setSelectedCharacter(null);
  }, [topic]);

  useEffect(() => {
    const images = [
      require("@/assets/images/game/multi_mode/background/loading.png"),
      require("@/assets/images/game/multi_mode/background/loading1.png"),
    ];
    const randomIndex = Math.floor(Math.random() * images.length);
    setLoadingImage(images[randomIndex]);
  }, []);

  // storage에서 username 가져오기
  useEffect(() => {
    (async () => {
      const storedUsername = await storage.getItem("username");
      if (storedUsername) setUsername(storedUsername);
    })();
  }, []);

  // WebSocket 이벤트 처리
  useEffect(() => {
    const ws = wsRef?.current;
    if (!ws) return;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "character_selected") {
        setTakenCharacters((prev) =>
          prev.includes(data.character) ? prev : [...prev, data.character]
        );
      }
    };

    return () => {
      if (ws) ws.onmessage = null;
    };
  }, [wsRef]);

  // 초기 로딩 → 캐릭터 선택 모달
  useEffect(() => {
    if (phase === "loading" && !hasShownCharacterModal) {
      const timer = setTimeout(() => {
        setShowCharacterModal(true);
        setPhase("character");
        setHasShownCharacterModal(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase, hasShownCharacterModal]);

  const handleCharacterSelect = () => {
    if (selectedCharacter === null) return;
    // [수정] activeCharacters를 기준으로 선택된 캐릭터를 찾습니다.
    const chosenChar = activeCharacters[selectedCharacter].name;
    if (takenCharacters.includes(chosenChar)) {
      alert("이미 선택된 캐릭터입니다!");
      return;
    }

    if (wsRef?.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "character_select", character: chosenChar }));
    }

    setShowCharacterModal(false);
    setLoadingMessage("캐릭터 선택을 확인 중입니다...");
    setPhase("loadingSteps");

    setTimeout(() => {
      setLoadingMessage("캐릭터 선택이 모두 완료되었습니다!");
      setTimeout(() => {
        let step = 0;
        const steps = [
          "스토리를 준비하는 중입니다...",
          "분기점을 설정하는 중입니다...",
          "캐릭터 관계를 설정하는 중입니다...",
          "게임 환경을 불러오는 중입니다...",
        ];
        const interval = setInterval(() => {
          setLoadingMessage(steps[step % steps.length]);
          step++;
          if (step > 4) {
            clearInterval(interval);
            setShowConfirmModal(true);
          }
        }, 2000);
      }, 2000);
    }, 2000);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* 1) 로딩 + 단계별 메시지 */}
      {(phase === "loading" || phase === "loadingSteps") && (
        <ScrollView contentContainerStyle={styles.scrollViewContent}>
          <ImageBackground
            source={loadingImage}
            style={styles.loadingBackground}
            imageStyle={{ opacity: 0.2 }}
          >
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#E2C044" />
              {selectedCharacter !== null && activeCharacters.length > 0 && (
                <Text style={styles.selectedInfo}>
                  {/* [수정] activeCharacters를 기준으로 정보를 표시합니다. */}
                  {topic}에서 당신은 {activeCharacters[selectedCharacter].name}입니다!
                </Text>
              )}
              <Text style={styles.loadingText}>{loadingMessage}</Text>
            </View>
          </ImageBackground>
        </ScrollView>
      )}

      {/* 2) 캐릭터 선택 모달 */}
      <Modal transparent visible={showCharacterModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>캐릭터 선택</Text>
            <ScrollView contentContainerStyle={styles.characterGridContainer} showsVerticalScrollIndicator={false}>
              <View style={styles.characterGrid}>
                {/* [수정] activeCharacters 배열을 순회하여 캐릭터 카드를 렌더링합니다. */}
                {activeCharacters.map((char, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.characterCard,
                      selectedCharacter === idx && styles.characterSelected,
                      takenCharacters.includes(char.name) && { backgroundColor: "#555" },
                    ]}
                    disabled={takenCharacters.includes(char.name)}
                    onPress={() => setSelectedCharacter(idx)}
                  >
                    <Image source={char.image} style={styles.characterImage} resizeMode="contain" />
                    <Text style={styles.characterName}>{char.name}</Text>
                    <Text style={styles.characterDescription}>{char.description}</Text>
                    {/* [수정] 새로 만든 CharacterStats 컴포넌트를 사용해 능력치를 표시합니다. */}
                    <CharacterStats stats={char.stats} />
                    {takenCharacters.includes(char.name) && (
                      <Text style={{ color: "red", marginTop: 4, fontWeight: "bold" }}>선택됨</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.selectBtn, { opacity: selectedCharacter !== null ? 1 : 0.5 }]}
              disabled={selectedCharacter === null}
              onPress={handleCharacterSelect}
            >
              <Text style={styles.selectBtnText}>선택</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3) 최종 확인 모달 */}
      <Modal transparent visible={showConfirmModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              게임 준비가 모두 완료되었습니다. 시작하시겠습니까?
            </Text>
            <TouchableOpacity style={styles.selectBtn} onPress={() => {
              if (selectedCharacter !== null) {
                // [수정] onStart 함수에 activeCharacters의 캐릭터 정보를 전달합니다.
                onStart(activeCharacters[selectedCharacter]);
              }
            }}
            >
              <Text style={styles.selectBtnText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollViewContent: { flexGrow: 1, justifyContent: "center", alignItems: "center", },
  loadingBackground: { flex: 1, width: "100%", justifyContent: "center", alignItems: "center" },
  loadingBox: { alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 16, color: "#fff", fontSize: 16 },
  selectedInfo: { marginTop: 12, color: "#E2C044", fontSize: 16, fontWeight: "bold", textAlign: "center" },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" },
  modalBox: { width: "90%", maxHeight: "80%", backgroundColor: "#222", borderRadius: 12, padding: 20, alignItems: "center" },
  modalTitle: { fontSize: 20, color: "#fff", marginBottom: 16, textAlign: "center", fontWeight: "bold" },
  characterGridContainer: { flexGrow: 1, },
  characterGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", marginBottom: 16 },
  characterCard: { width: "45%", backgroundColor: "#333", borderRadius: 10, padding: 12, marginVertical: 8, alignItems: "center" },
  characterSelected: { backgroundColor: "#4CAF50", transform: [{ scale: 1.05 }] },
  characterImage: { width: 80, height: 80, marginBottom: 8 },
  characterName: { fontSize: 16, fontWeight: "bold", color: "#fff", marginBottom: 6, textAlign: "center" },
  characterDescription: {
    fontSize: 13,
    color: "#ccc",
    textAlign: "center",
    marginBottom: 6,
  },
  // [추가] 능력치들을 감싸는 컨테이너 스타일
  statsContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  statText: { color: "#ddd", fontSize: 14, lineHeight: 20 },
  selectBtn: { backgroundColor: "#7C3AED", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  selectBtnText: { color: "#fff", fontWeight: "bold" },
});