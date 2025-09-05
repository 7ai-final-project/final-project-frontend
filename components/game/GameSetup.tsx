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
import { storage } from "../../services/storage";
import { useAuth } from '../../hooks/useAuth';
import { characters, Character } from "@/data/characters";
import { useWebSocket } from "@/components/context/WebSocketContext";

interface GameSetupProps {
  topic: string | string[];
  difficulty: string | string[];
  roomId: string | string[];
  onStart: (character: Character) => void;
}

const StatText = ({ label, value }: { label: string; value: number }) => (
  <Text style={styles.statText}>
    {label}: {value}
  </Text>
);

export default function GameSetup({ topic, difficulty, roomId, onStart }: GameSetupProps) {
  const [username, setUsername] = useState<string>("");
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(null);
  const [takenCharacters, setTakenCharacters] = useState<string[]>([]);
  const [phase, setPhase] = useState<"loading" | "character" | "loadingSteps" | "confirm">("loading");
  const [loadingMessage, setLoadingMessage] = useState("캐릭터를 생성 중입니다...");
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [hasShownCharacterModal, setHasShownCharacterModal] = useState(false);
  const [loadingImage, setLoadingImage] = useState<any>(null);

  const { wsRef } = useWebSocket();
  const { user } = useAuth();

  useEffect(() => {
    setUsername(user?.name || "플레이어");
    const images = [
      require("@/assets/images/game/multi_mode/background/loading.png"),
      require("@/assets/images/game/multi_mode/background/loading1.png"),
    ];
    const randomIndex = Math.floor(Math.random() * images.length);
    setLoadingImage(images[randomIndex]);
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
    const chosenChar = characters[selectedCharacter].name;
    if (takenCharacters.includes(chosenChar)) {
      alert("이미 선택된 캐릭터입니다!");
      return;
    }
    
    // WebSocket으로 캐릭터 선택 전송
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
              {selectedCharacter !== null && (
                <Text style={styles.selectedInfo}>
                  {topic}에서 당신은 {characters[selectedCharacter].name}입니다!
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
            <ScrollView contentContainerStyle={styles.characterGridContainer}>
              <View style={styles.characterGrid}>
                {characters.map((char, idx) => (
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
                    {/* 👇 이 부분을 수정했습니다 */}
                    <StatText label="체력" value={char.stats.체력} />
                    <StatText label="지혜" value={char.stats.지혜} />
                    <StatText label="행운" value={char.stats.행운} />
                    {/* 👆 수정 끝 */}
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
                  onStart(characters[selectedCharacter]);
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
  modalBox: { width: "90%", backgroundColor: "#222", borderRadius: 12, padding: 20, alignItems: "center" },
  modalTitle: { fontSize: 20, color: "#fff", marginBottom: 16, textAlign: "center", fontWeight: "bold" },

  characterGridContainer: { flexGrow: 1, },
  characterGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 16 },
  characterCard: { width: "45%", backgroundColor: "#333", borderRadius: 10, padding: 12, marginVertical: 8, alignItems: "center" },
  characterSelected: { backgroundColor: "#4CAF50" },
  characterImage: { width: 80, height: 80, marginBottom: 8 },
  characterName: { fontSize: 16, fontWeight: "bold", color: "#fff", marginBottom: 6, textAlign: "center" },
  statText: { color: "#ddd", fontSize: 14 },

  selectBtn: { backgroundColor: "#7C3AED", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  selectBtnText: { color: "#fff", fontWeight: "bold" },
});