import React, { useState, useEffect, useMemo } from "react";
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

const API_BASE_URL = "http://127.0.0.1:8000";

// 객체/문자열 모두 안전하게 문자열로 정규화
function toLine(
  v: unknown,
  fallbackWhenObject?: string
): { title: string; desc?: string } {
  if (typeof v === "string" || typeof v === "number") {
    return { title: String(v) };
  }
  if (v && typeof v === "object") {
    const o = v as any;
    // name/title/name_eng 등 흔한 키를 우선적으로 사용
    const title =
      o.name ??
      o.title ??
      o.name_eng ??
      o.title_eng ??
      fallbackWhenObject ??
      "[object]";
    const desc =
      o.description ??
      o.desc ??
      o.description_kr ??
      o.description_eng ??
      undefined;
    return { title: String(title), desc: desc ? String(desc) : undefined };
  }
  return { title: String(v ?? "") };
}

// 배열이 아닐 수도 있는 입력을 방어적으로 배열로
function toArray<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v == null) return [];
  return [v as T];
}

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
const CharacterDetails = ({ char }: { char: Character }) => {
  // stats, skills, items가 없거나 타입이 달라도 안전하게 처리
  const stats: Record<string, unknown> =
    // 백엔드가 ability.stats에 넣는 경우도 대비
    (char as any).stats ??
    (char as any).ability?.stats ??
    {};
  const skillsRaw =
    (char as any).skills ??
    (char as any).ability?.skills ??
    [];
  const itemsRaw =
    (char as any).items ??
    (char as any).starting_items ??
    [];

  const skills = toArray(skillsRaw).map((s) => toLine(s));
  const items = toArray(itemsRaw).map((it) => toLine(it));

  return (
    <>
      {!!char.description && (
        <Text style={styles.characterDescription}>
          {String(char.description)}
        </Text>
      )}

      {/* 스탯 */}
      <View style={styles.statsContainer}>
        <Text style={styles.listTitle}>능력치</Text>
        {Object.entries(stats).length === 0 && (
          <Text style={styles.statText}>-</Text>
        )}
        {Object.entries(stats).map(([stat, value]) => (
          <Text key={stat} style={styles.statText}>
            {stat}: {typeof value === "number" ? value : String(value)}
          </Text>
        ))}
      </View>

      {/* 스킬 */}
      {skills.length > 0 && (
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>스킬</Text>
          {skills.map(({ title, desc }, idx) => (
            <View key={`skill-${idx}`} style={{ width: "100%" }}>
              <Text style={styles.listItemText}>- {title}</Text>
              {!!desc && (
                <Text style={[styles.listItemText, { opacity: 0.8 }]}>
                  {"  "}· {desc}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* 아이템 */}
      {items.length > 0 && (
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>아이템</Text>
          {items.map(({ title, desc }, idx) => (
            <View key={`item-${idx}`} style={{ width: "100%" }}>
              <Text style={styles.listItemText}>- {title}</Text>
              {!!desc && (
                <Text style={[styles.listItemText, { opacity: 0.8 }]}>
                  {"  "}· {desc}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </>
  );
};
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

  const allCharacters: Character[] = useMemo(() => {
    try { return JSON.parse(initialCharacters); } 
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
    Object.keys(characterSelections).find(charId => characterSelections[charId] === user?.name)
  , [characterSelections, user]);
  
  const allPlayersSelected = useMemo(() => {
    // ✅ [수정] Stale한 prop 대신 실시간 state를 사용합니다.
    const participantCount = realtimeParticipants.length;
    const selectionCount = Object.values(characterSelections).length;

    // 참가자가 없거나, 선택한 사람 수가 참가자 수와 다르면 false
    if (participantCount === 0 || selectionCount < participantCount) {
        return false;
    }
    
    // 모든 참가자가 선택했는지 최종 확인
    const selectedUsernames = new Set(Object.values(characterSelections));
    return realtimeParticipants.every(p => selectedUsernames.has(p.username));

  }, [realtimeParticipants, characterSelections]);

  useEffect(() => {
      const ws = wsRef?.current;
      if (!ws) return;
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // ✅ [로그 1] 서버로부터 받은 모든 메시지를 그대로 출력합니다.
        console.log("--- 📥 [1] WebSocket 메시지 수신 ---", data);

        if (data.type === "room_state") {
          const newSelections: Record<string, string> = {};
          const updatedParticipants: Participant[] = [];

          if (Array.isArray(data.selected_by_room)) {
              // ✅ [로그 2] 서버가 보내준 핵심 데이터인 참가자 목록을 확인합니다.
              console.log("--- [2] 서버가 보낸 참가자 RAW 데이터 ---", data.selected_by_room);

              data.selected_by_room.forEach((p: SelectedRoomParticipant) => {
                  updatedParticipants.push({ id: p.id, username: p.username });
                  if (p.selected_character && p.selected_character.id) {
                      newSelections[p.selected_character.id] = p.username;
                  }
              });
          }
          
          // ✅ [로그 3] 가공 후 state에 저장될 최종 데이터를 확인합니다.
          console.log("--- [3] State에 반영될 참가자/선택 정보 ---", { updatedParticipants, newSelections });
          setRealtimeParticipants(updatedParticipants);
          setCharacterSelections(newSelections);
        }
        
        if (data.type === "selections_confirmed") {
          onStart(data.payload);
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
    if (!ws || !mySelectedCharacterId) return;
    const myChar = allCharacters.find(c => c.id === mySelectedCharacterId);
    if (!myChar) return;
    const playerSelectedCharIds = Object.keys(characterSelections);
    const aiCharacters = allCharacters.filter(c => !playerSelectedCharIds.includes(c.id));
    const finalSetupData = { myCharacter: myChar, aiCharacters, allCharacters };
    ws.send(JSON.stringify({
      action: "confirm_selections",
      setup_data: finalSetupData,
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
                  const selectorName = characterSelections[char.id];
                  const isSelectedByMe = selectorName === user?.name;
                  const isTakenByOther = !!(selectorName && !isSelectedByMe);
                  const hasMadeMyChoice = !!mySelectedCharacterId;
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
                        source={char.image ? { uri: `${API_BASE_URL}${char.image}` } : require("@/assets/images/game/multi_mode/character/knight.png")}
                        style={styles.characterImage}
                        resizeMode="contain"
                      />
                      <Text style={styles.characterName}>{char.name}</Text>
                      <CharacterDetails char={char} />
                      {(isSelectedByMe || isTakenByOther) && (
                      <View style={styles.takenOverlay}>
                        <Text style={styles.takenText}>{selectorName}</Text>
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
  loadingText: { marginTop: 16, color: "#fff", fontSize: 18, fontWeight: "600", textAlign: 'center' },
  finalStartBtn: { marginTop: 30, backgroundColor: "#4CAF50", paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30 },
  finalStartBtnText: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.8)" },
  modalBox: { width: "85%", maxHeight: "85%", backgroundColor: "#1E293B", borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 1, borderColor: '#334155' },
  modalTitle: { fontSize: 24, color: "#E2C044", marginBottom: 8, fontWeight: "bold" },
  timerText: { fontSize: 16, color: "#A0A0A0", marginBottom: 16, fontStyle: 'italic' },
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
  takenText: { color: "#E2C044", fontWeight: "bold", fontSize: 20 },
  characterImage: { width: 120, height: 120, marginBottom: 8, borderRadius: 8 },
  characterName: { fontSize: 18, fontWeight: "bold", color: "#fff", textAlign: "center", marginBottom: 6 },
  characterDescription: { fontSize: 13, color: '#A0A0A0', textAlign: 'center', marginBottom: 8 },
  statsContainer: { width: '100%', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#4A5568', alignItems: 'center' },
  statText: { color: '#CBD5E1', fontSize: 12, textAlign: 'center', lineHeight: 16 },
  listContainer: { width: '100%', marginTop: 10, alignItems: 'center' },
  listTitle: { fontSize: 13, fontWeight: 'bold', color: '#E2C044', marginBottom: 4 },
  listItemText: { color: "#CBD5E1", fontSize: 12, lineHeight: 16 },
});