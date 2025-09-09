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
// [수정] API 서비스와 새로운 Character 타입을 import 합니다.
import { fetchCharactersByTopic, Character } from "@/services/api";
import { useWebSocket } from "@/components/context/WebSocketContext";

// --- 상수 정의 ---
// [추가] 백엔드 서버의 기본 URL입니다. 실제 앱에서는 환경 변수로 관리하는 것이 좋습니다.
const API_BASE_URL = "http://127.0.0.1:8000";

interface GameSetupProps {
  topic: string | string[];
  difficulty: string | string[];
  roomId: string | string[];
  onStart: (character: Character) => void;
}

// --- 자식 컴포넌트들 ---

// [수정 없음] stats 객체를 표시하는 컴포넌트
const CharacterStats = ({ stats }: { stats: Record<string, number> }) => (
  <View style={styles.statsContainer}>
    <Text style={styles.listTitle}>능력치</Text>
    {Object.entries(stats).map(([label, value]) => (
      <Text key={label} style={styles.statText}>
        {label}: {value}
      </Text>
    ))}
  </View>
);

// [추가] skills와 items 배열을 표시하는 새로운 컴포넌트
const CharacterSkillsAndItems = ({ skills, items }: { skills: string[]; items: string[] }) => (
  <View style={styles.listContainer}>
    {skills.length > 0 && (
      <View style={styles.subListContainer}>
        <Text style={styles.listTitle}>스킬</Text>
        {skills.map((skill) => (
          <Text key={skill} style={styles.listItemText}>- {skill}</Text>
        ))}
      </View>
    )}
    {items.length > 0 && (
      <View style={styles.subListContainer}>
        <Text style={styles.listTitle}>아이템</Text>
        {items.map((item) => (
          <Text key={item} style={styles.listItemText}>- {item}</Text>
        ))}
      </View>
    )}
  </View>
);


// --- 메인 컴포넌트 ---

export default function GameSetup({ topic, difficulty, roomId, onStart }: GameSetupProps) {
  // [수정] DB에서 캐릭터를 비동기로 가져오므로 로딩/에러 상태 추가
  const [activeCharacters, setActiveCharacters] = useState<Character[]>([]);
  const [isCharacterLoading, setIsCharacterLoading] = useState(true);
  const [characterError, setCharacterError] = useState<string | null>(null);

  const [username, setUsername] = useState<string>("플레이어");
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(null);
  const [takenCharacters, setTakenCharacters] = useState<string[]>([]);
  const [phase, setPhase] = useState<"loading" | "character" | "loadingSteps" | "confirm">("loading");
  const [loadingMessage, setLoadingMessage] = useState("캐릭터를 생성 중입니다...");
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [hasShownCharacterModal, setHasShownCharacterModal] = useState(false);
  const [loadingImage, setLoadingImage] = useState<any>(null);

  const { wsRef } = useWebSocket();

  // [수정] topic이 바뀔 때마다 API를 호출하여 캐릭터 목록을 가져옵니다.
  useEffect(() => {
    const loadCharacters = async () => {
      setIsCharacterLoading(true);
      setCharacterError(null);
      const currentTopic = Array.isArray(topic) ? topic[0] : topic;
      if (!currentTopic) return;

      try {
        // 1. API 응답 전체를 responseData 변수에 받습니다.
        const responseData = await fetchCharactersByTopic(currentTopic);
        
        // 2. responseData에서 .results 배열을 추출하여 상태에 저장합니다.
        if (responseData && Array.isArray(responseData.results)) {
          setActiveCharacters(responseData.results);
        } else if (Array.isArray(responseData)) {
          // 페이지네이션이 없는 경우를 대비한 코드
          setActiveCharacters(responseData);
        } else {
          // 예상치 못한 데이터 구조일 경우 에러 처리
          throw new Error("API 응답 형식이 올바르지 않습니다.");
        }

      } catch (error) {
        console.error("캐릭터 정보 로딩 실패:", error);
        setCharacterError("캐릭터를 불러오는 데 실패했습니다.");
      } finally {
        setIsCharacterLoading(false);
      }
    };

    loadCharacters();
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

  useEffect(() => {
    (async () => {
      const storedUsername = await storage.getItem("username");
      if (storedUsername) setUsername(storedUsername);
    })();
  }, []);

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
    return () => { if (ws) ws.onmessage = null; };
  }, [wsRef]);

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
        const steps = ["스토리를 준비하는 중입니다...", "분기점을 설정하는 중입니다...", "캐릭터 관계를 설정하는 중입니다...", "게임 환경을 불러오는 중입니다..."];
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
      {(phase === "loading" || phase === "loadingSteps") && (
        <ImageBackground source={loadingImage} style={styles.loadingBackground} imageStyle={{ opacity: 0.2 }}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#E2C044" />
            {selectedCharacter !== null && activeCharacters.length > 0 && (
              <Text style={styles.selectedInfo}>
                {topic}에서 당신은 {activeCharacters[selectedCharacter].name}입니다!
              </Text>
            )}
            <Text style={styles.loadingText}>{loadingMessage}</Text>
          </View>
        </ImageBackground>
      )}

      <Modal transparent visible={showCharacterModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>캐릭터 선택</Text>
            {/* [수정] 로딩 및 에러 상태에 따른 UI 분기 처리 */}
            {isCharacterLoading ? (
              <View style={styles.centeredContent}>
                <ActivityIndicator size="large" color="#E2C044" />
                <Text style={styles.loadingText}>캐릭터 목록을 불러오는 중...</Text>
              </View>
            ) : characterError ? (
              <View style={styles.centeredContent}>
                <Text style={styles.errorText}>{characterError}</Text>
              </View>
            ) : (
              <>
                <ScrollView contentContainerStyle={styles.characterGridContainer} showsVerticalScrollIndicator={false}>
                  <View style={styles.characterGrid}>
                    {activeCharacters.map((char, idx) => (
                      <TouchableOpacity
                        key={char.id} // [수정] key를 index 대신 고유 id로 변경
                        style={[
                          styles.characterCard,
                          selectedCharacter === idx && styles.characterSelected,
                          takenCharacters.includes(char.name) && styles.characterTaken,
                        ]}
                        disabled={takenCharacters.includes(char.name)}
                        onPress={() => setSelectedCharacter(idx)}
                      >
                        {/* [수정] Image source를 API에서 받은 URL로 변경 */}
                        <Image
                          source={char.image ? { uri: `${API_BASE_URL}${char.image}` } : require("@/assets/images/game/multi_mode/character/knight.png")}
                          style={styles.characterImage}
                          resizeMode="contain"
                        />
                        <Text style={styles.characterName}>{char.name}</Text>
                        <Text style={styles.characterDescription}>{char.description}</Text>
                        
                        {/* [수정] stats, skills, items 데이터를 각각의 컴포넌트로 표시 */}
                        <CharacterStats stats={char.stats} />
                        <CharacterSkillsAndItems skills={char.skills} items={char.items} />

                        {takenCharacters.includes(char.name) && (
                          <View style={styles.takenOverlay}>
                            <Text style={styles.takenText}>선택됨</Text>
                          </View>
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
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showConfirmModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>게임 준비가 모두 완료되었습니다. 시작하시겠습니까?</Text>
            <TouchableOpacity style={styles.selectBtn} onPress={() => {
              if (selectedCharacter !== null) {
                onStart(activeCharacters[selectedCharacter]);
              }
            }}>
              <Text style={styles.selectBtnText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// [수정] 새로운 컴포넌트들을 위한 스타일 추가
const styles = StyleSheet.create({
  loadingBackground: { flex: 1, width: "100%", justifyContent: "center", alignItems: "center" },
  loadingBox: { alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 16, color: "#fff", fontSize: 16 },
  selectedInfo: { marginTop: 12, color: "#E2C044", fontSize: 16, fontWeight: "bold", textAlign: "center" },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" },
  modalBox: { width: "90%", maxHeight: "80%", backgroundColor: "#222", borderRadius: 12, padding: 20, alignItems: "center" },
  modalTitle: { fontSize: 20, color: "#fff", marginBottom: 16, textAlign: "center", fontWeight: "bold" },
  centeredContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: 'red', fontSize: 16 },
  characterGridContainer: { paddingBottom: 16 },
  characterGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around" },
  characterCard: { width: "45%", backgroundColor: "#333", borderRadius: 10, padding: 12, marginVertical: 8, alignItems: "center", borderWidth: 2, borderColor: 'transparent' },
  characterSelected: { borderColor: "#4CAF50", transform: [{ scale: 1.05 }] },
  characterTaken: { backgroundColor: "#555", opacity: 0.7 },
  takenOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  takenText: { color: "red", fontWeight: "bold", fontSize: 18 },
  characterImage: { width: 80, height: 80, marginBottom: 8, borderRadius: 40 },
  characterName: { fontSize: 16, fontWeight: "bold", color: "#fff", marginBottom: 6, textAlign: "center" },
  characterDescription: { fontSize: 13, color: "#ccc", textAlign: "center", marginBottom: 10 },
  statsContainer: { alignItems: 'flex-start', width: '100%', marginTop: 4, borderTopWidth: 1, borderTopColor: '#444', paddingTop: 8 },
  statText: { color: "#ddd", fontSize: 14, lineHeight: 20 },
  listContainer: { width: '100%', marginTop: 10 },
  subListContainer: { alignItems: 'flex-start', width: '100%', marginTop: 6 },
  listTitle: { fontSize: 14, fontWeight: 'bold', color: '#E2C044', marginBottom: 4 },
  listItemText: { color: "#ddd", fontSize: 13, lineHeight: 18 },
  selectBtn: { backgroundColor: "#7C3AED", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 16 },
  selectBtnText: { color: "#fff", fontWeight: "bold" },
});