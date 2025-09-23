import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
  ScrollView,
  Modal,
} from "react-native";
import { Character } from "@/services/api";
import { useWebSocket } from "@/components/context/WebSocketContext";
import { useAuth } from "@/hooks/useAuth";
import { useFonts } from 'expo-font';

const API_BASE_URL = "http://127.0.0.1:8000";

// --- 타입 정의 ---
interface Participant {
  id: string;
  username: string;
}

interface SelectedRoomParticipant {
  id: string;
  username: string;
  is_ready: boolean;
  selected_character: {
    id: string;
    name: string;
    user_id: string;
  } | null;
}

interface GameSetupProps {
  topic: string;
  roomId: string;
  characters: string;
  participants: string;
  isOwner: boolean;
  onStart: (payload: {
    myCharacter: Character;
    aiCharacters: Character[];
    allCharacters: Character[];
  }) => void;
}

// --- 자식 컴포넌트: 상세 정보 표시용 ---
const CharacterDetails = ({ char }: { char: Character }) => (
  <>
    <Text style={styles.characterDescription}>{char.description}</Text>
    <View style={styles.statsContainer}>
        <Text style={styles.listTitle}>능력치</Text>
      {Object.entries(char.stats).map(([stat, value]) => (
        <Text key={stat} style={styles.statText}>
          {stat}: {value}
        </Text>
      ))}
    </View>
    {char.skills?.length > 0 && (
      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>스킬</Text>
        {char.skills.map(skill => <Text key={skill.name} style={styles.listItemText}>- {skill.name}</Text>)}
      </View>
    )}
    {char.items?.length > 0 && (
      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>아이템</Text>
        {char.items.map(item => <Text key={item.name} style={styles.listItemText}>- {item.name}</Text>)}
      </View>
    )}
  </>
);

// --- 메인 컴포넌트 ---
export default function GameSetup({
  topic,
  roomId,
  characters: initialCharacters,
  participants: initialParticipants,
  isOwner,
  onStart,
}: GameSetupProps) {
  const { user } = useAuth();
  const { wsRef } = useWebSocket();
  const [fontsLoaded, fontError] = useFonts({
    'neodgm': require('@/assets/fonts/neodgm.ttf'),
  });

  const allCharacters: Character[] = useMemo(() => {
    try {
      const chars = JSON.parse(initialCharacters);
      // ✅ [추가] 이 console.log로 터미널이나 개발자 도구에서 데이터 확인
      console.log("서버로부터 받은 캐릭터 데이터:", JSON.stringify(chars, null, 2));
      return chars;
    } 
    catch (e) { console.error("캐릭터 데이터 파싱 실패:", e); return []; }
  }, [initialCharacters]);
  
  // ✅ [수정] Stale한 prop 대신 실시간으로 업데이트될 참가자 state를 만듭니다.
  const [realtimeParticipants, setRealtimeParticipants] = useState<Participant[]>(() => {
    try { return JSON.parse(initialParticipants); }
    catch (e) { return []; }
  });

  const [phase, setPhase] = useState<"loading" | "character_select" | "loading_steps" | "confirm">("loading");
  const [characterSelections, setCharacterSelections] = useState<Record<string, string>>({});
  const [loadingMessage, setLoadingMessage] = useState("다른 플레이어들의 선택을 기다리는 중...");
  const [loadingImage, setLoadingImage] = useState<any>(null);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [remainingTime, setRemainingTime] = useState(30);

  const mySelectedCharacterId = useMemo(() => 
    Object.keys(characterSelections).find(charId => characterSelections[charId] === user?.id)
  , [characterSelections, user]);
  
  const allPlayersSelected = useMemo(() => {
    const participantCount = realtimeParticipants.length;
    // ✅ [수정] 선택한 '사람의 수'를 중복 없이 계산합니다.
    const selectionCount = new Set(Object.values(characterSelections)).size;

    if (participantCount === 0 || selectionCount < participantCount) {
        return false;
    }
    
    // ✅ [수정] 선택된 userId 목록과 전체 참가자의 id 목록을 비교합니다.
    const selectedUserIds = new Set(Object.values(characterSelections));
    return realtimeParticipants.every(p => selectedUserIds.has(p.id));

  }, [realtimeParticipants, characterSelections]);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
      const ws = wsRef?.current;
      if (!ws) return;
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // ✅ [로그 1] 서버로부터 받은 모든 메시지를 그대로 출력합니다.
        console.log("--- 📥 [1] WebSocket 메시지 수신 ---", data);

        if (data.type === "room_state") {
          // ✅ [수정] 이제 Record<charId, userId> 형태가 됩니다.
          const newSelections: Record<string, string> = {}; 
          const updatedParticipants: Participant[] = [];

          if (Array.isArray(data.selected_by_room)) {
              data.selected_by_room.forEach((p: SelectedRoomParticipant) => {
                  updatedParticipants.push({ id: p.id, username: p.username });
                  // ✅ [수정] username 대신 user_id를 newSelections에 저장합니다.
                  if (p.selected_character && p.selected_character.id && p.selected_character.user_id) {
                      newSelections[p.selected_character.id] = p.selected_character.user_id;
                  }
              });
          }
          
          // ✅ [로그 3] 가공 후 state에 저장될 최종 데이터를 확인합니다.
          console.log("--- [3] State에 반영될 참가자/선택 정보 ---", { updatedParticipants, newSelections });
          setRealtimeParticipants(updatedParticipants);
          setCharacterSelections(newSelections);
        }
        
        if (data.type === "selections_confirmed") {
          console.log(
            "✅ [DEBUG] 'selections_confirmed' 메시지 수신, payload 전체 데이터:", 
            JSON.stringify(data.payload, null, 2)
          );
          const { assignments, aiCharacters, allCharacters } = data.payload;
          const currentUser = userRef.current; 

          if (!currentUser) {
            console.error("인증 오류: 캐릭터 배정 단계에서 user 정보를 찾을 수 없습니다.");
            alert("사용자 정보를 찾을 수 없어 게임을 시작할 수 없습니다.");
            return;
          }
          
          const myCharacter = assignments[currentUser.id];

          if (myCharacter) {
            onStart({ myCharacter, aiCharacters, allCharacters });
          } else {
            console.error("오류: 서버로부터 내 캐릭터 정보를 배정받지 못했습니다.", assignments);
            alert("오류가 발생하여 게임을 시작할 수 없습니다.");
          }
        }
      };

      ws.send(JSON.stringify({ action: "request_selection_state" }));
      return () => { if (ws) ws.onmessage = null; };
  }, [wsRef, onStart]);

  useEffect(() => {
    if (phase === "loading") {
      const timer = setTimeout(() => {
        setPhase("character_select");
        setShowCharacterModal(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "character_select" || allPlayersSelected) return;

    if (mySelectedCharacterId) {
      setRemainingTime(0);
      return;
    }

    const timer = setInterval(() => {
      setRemainingTime((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timer);
          if (!Object.values(characterSelections).includes(user?.name ?? '')) {
            const availableChars = allCharacters.filter(char => !characterSelections[char.id]);
            if (availableChars.length > 0) {
              const randomChar = availableChars[Math.floor(Math.random() * availableChars.length)];
              handleCharacterSelect(randomChar.id);
            }
          }
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, mySelectedCharacterId, characterSelections, allCharacters, user, allPlayersSelected]);

  useEffect(() => {
    // allPlayersSelected가 true가 되는 순간 딱 한 번만 실행되도록 수정합니다.
    if (allPlayersSelected) {
      setShowCharacterModal(false);
      setPhase("loading_steps");
      let step = 0;
      const steps = ["스토리를 준비하는 중입니다...", "분기점을 설정하는 중입니다...", "게임 환경을 불러오는 중입니다..."];
      
      const interval = setInterval(() => {
        if (step < steps.length) {
          setLoadingMessage(steps[step]);
          step++;
        } else {
          clearInterval(interval);
          setPhase("confirm"); // 이제 이 코드가 정상적으로 실행됩니다.
        }
      }, 1500);

      return () => clearInterval(interval);
    }
  }, [allPlayersSelected]);
  
  useEffect(() => {
    const images = [
      require("@/assets/images/game/multi_mode/background/loading.png"),
      require("@/assets/images/game/multi_mode/background/loading1.png"),
    ];
    setLoadingImage(images[Math.floor(Math.random() * images.length)]);
  }, []);

  useEffect(() => {
      console.log("--- 🤔 [4] '모두 선택했는가?' 판단 로직 실행 ---");
      console.log("실시간 참가자 명단:", realtimeParticipants.map(p => p.username));
      console.log("캐릭터 선택 현황:", characterSelections);
      console.log("판단 결과 (allPlayersSelected):", allPlayersSelected);
      
      // ✅ [추가] 현재 phase와 isOwner 값을 직접 확인합니다.
      console.log("현재 Phase:", phase);
      console.log("방장 여부 (isOwner):", isOwner);

      console.log("-------------------------------------------------");
  }, [realtimeParticipants, characterSelections, allPlayersSelected, phase, isOwner]);

  const handleCharacterSelect = (charId: string) => {
    const ws = wsRef?.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const isDeselecting = mySelectedCharacterId === charId;
    ws.send(JSON.stringify({
      action: "select_character", 
      characterId: isDeselecting ? null : charId,
    }));
  };

  const handleGameStart = () => {
    const ws = wsRef?.current;
    if (!ws) return;
    
    // ✅ [수정] 이제 클라이언트는 '시작' 신호만 보냅니다. 데이터 계산은 서버가 합니다.
    ws.send(JSON.stringify({
      action: "confirm_selections",
    }));
  };

  return (
    <View style={{ flex: 1 }}>
      {(phase === "loading" || phase === "loading_steps" || phase === "confirm") && (
        <ImageBackground source={loadingImage} style={styles.loadingBackground} imageStyle={{ opacity: 0.2 }}>
          <View style={styles.loadingBox}>
            {phase === 'confirm' ? (
              // 최종 확인 단계 UI
              <>
                {isOwner ? (
                  // 방장에게 보여줄 UI
                  <>
                    <Text style={styles.loadingText}>모든 플레이어의 준비가 완료되었습니다.</Text>
                    <TouchableOpacity style={styles.finalStartBtn} onPress={handleGameStart}>
                      <Text style={styles.finalStartBtnText}>게임 시작!</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  // 참여자에게 보여줄 UI
                  <>
                    <ActivityIndicator size="large" color="#E2C044" />
                    <Text style={styles.loadingText}>방장이 게임을 시작하기를 기다리고 있습니다...</Text>
                  </>
                )}
              </>
            ) : (
              // 캐릭터 선택 후 로딩 단계 UI
              <>
                <ActivityIndicator size="large" color="#E2C044" />
                <Text style={styles.loadingText}>{loadingMessage}</Text>
              </>
            )}
          </View>
        </ImageBackground>
      )}

      <Modal transparent visible={showCharacterModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>캐릭터 선택</Text>
            {remainingTime > 0 && <Text style={styles.timerText}>{remainingTime}초 안에 캐릭터를 선택하세요!</Text>}
            {mySelectedCharacterId && !allPlayersSelected && <Text style={styles.timerText}>선택 완료! 다른 플레이어를 기다립니다...</Text>}
            {allCharacters.length === 0 ? (
              <View style={{padding: 20}}>
                <ActivityIndicator size="large" color="#E2C044" />
                <Text style={styles.loadingText}>캐릭터 목록을 불러오는 중...</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.characterGridContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.characterGrid}>
                {allCharacters.map((char) => {
                  const selectorId = characterSelections[char.id];
                  const isSelectedByMe = selectorId === user?.id;
                  const isTakenByOther = !!(selectorId && !isSelectedByMe);
                  const hasMadeMyChoice = !!mySelectedCharacterId;
                  const selector = realtimeParticipants.find(p => p.id === selectorId);

                  return (
                    <TouchableOpacity
                      key={char.id}
                      style={[
                        styles.characterCard,
                        isSelectedByMe && styles.characterSelected,
                        isTakenByOther && styles.characterTaken,
                        (hasMadeMyChoice && !isSelectedByMe) && styles.characterDisabled,
                      ]}
                      disabled={isTakenByOther || (hasMadeMyChoice && !isSelectedByMe)}
                      onPress={() => handleCharacterSelect(char.id)}
                    >
                      <Image
                        source={char.image || require("@/assets/images/game/multi_mode/character/knight.png")}
                        style={styles.characterImage}
                        resizeMode="contain"
                      />
                      <Text style={styles.characterName}>{char.name}</Text>
                      <CharacterDetails char={char} />
                      {(isSelectedByMe || isTakenByOther) && (
                      <View style={styles.takenOverlay}>
                        <Text style={styles.takenText}>{selector?.username}</Text>
                      </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingBackground: { flex: 1, width: "100%", justifyContent: "center", alignItems: "center" },
  loadingBox: { alignItems: "center", justifyContent: "center", padding: 20 },
  loadingText: { marginTop: 16, color: "#fff", fontSize: 18, fontWeight: "600", textAlign: 'center', fontFamily: 'neodgm' },
  finalStartBtn: { marginTop: 30, backgroundColor: "#4CAF50", paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30 },
  finalStartBtnText: { color: "#fff", fontSize: 20, fontWeight: "bold", fontFamily: 'neodgm' },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.8)" },
  modalBox: { width: "85%", maxHeight: "85%", backgroundColor: "#1E293B", borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 1, borderColor: '#334155' },
  modalTitle: { fontSize: 24, color: "#E2C044", marginBottom: 8, fontWeight: "bold", fontFamily: 'neodgm' },
  timerText: { fontSize: 16, color: "#A0A0A0", marginBottom: 16, fontStyle: 'italic', fontFamily: 'neodgm' },
  characterGridContainer: { paddingBottom: 16 },
  characterGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around",},
  characterCard: { 
    width: "45%", 
    backgroundColor: "#334155", 
    borderRadius: 12, 
    padding: 12, 
    marginVertical: 8, 
    alignItems: "center", 
    borderWidth: 3, 
    borderColor: 'transparent',
  },
  characterSelected: { borderColor: "#4CAF50", transform: [{ scale: 1.05 }] },
  characterTaken: { opacity: 0.5 },
  characterDisabled: { opacity: 0.4 },
  takenOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(20,20,20, 0.7)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderRadius: 8 
  },
  takenText: { color: "#E2C044", fontWeight: "bold", fontSize: 20, fontFamily: 'neodgm' },
  characterImage: { width: 120, height: 120, marginBottom: 8, borderRadius: 8 },
  characterName: { fontSize: 18, fontWeight: "bold", color: "#fff", textAlign: "center", marginBottom: 6, fontFamily: 'neodgm' },
  characterDescription: { fontSize: 13, color: '#A0A0A0', textAlign: 'center', marginBottom: 8, fontFamily: 'neodgm' },
  statsContainer: { width: '100%', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#4A5568', alignItems: 'center' },
  statText: { color: '#CBD5E1', fontSize: 12, textAlign: 'center', lineHeight: 16, fontFamily: 'neodgm' },
  listContainer: { width: '100%', marginTop: 10, alignItems: 'center' },
  listTitle: { fontSize: 13, fontWeight: 'bold', color: '#E2C044', marginBottom: 4, fontFamily: 'neodgm' },
  listItemText: { color: "#CBD5E1", fontSize: 12, lineHeight: 16, fontFamily: 'neodgm' },
});