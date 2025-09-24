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
import { useFonts } from 'expo-font';
import { Character } from "@/services/api";
import { useSettings } from "@/components/context/SettingsContext"; // SettingsContext 훅 임포트

// --- 타입 정의 ---
interface GameSetupProps {
  topic: string;
  characters: string;
  onStart: (payload: {
    myCharacter: Character;
    aiCharacters: Character[];
    allCharacters: Character[];
  }) => void;
}

// --- 자식 컴포넌트: 상세 정보 표시용 ---
const CharacterDetails = ({ char, fontSizeMultiplier }: { char: Character, fontSizeMultiplier: number }) => (
  <>
    <Text style={[styles.characterDescription, { fontSize: 13 * fontSizeMultiplier }]}>{char.description}</Text>
    <View style={styles.statsContainer}>
        <Text style={[styles.listTitle, { fontSize: 13 * fontSizeMultiplier }]}>능력치</Text>
      {Object.entries(char.stats).map(([stat, value]) => (
        <Text key={stat} style={[styles.statText, { fontSize: 12 * fontSizeMultiplier }]}>
          {stat}: {value}
        </Text>
      ))}
    </View>
    {char.skills?.length > 0 && (
      <View style={styles.listContainer}>
        <Text style={[styles.listTitle, { fontSize: 13 * fontSizeMultiplier }]}>스킬</Text>
        {char.skills.map(skill => <Text key={skill.name} style={[styles.listItemText, { fontSize: 12 * fontSizeMultiplier }]}>- {skill.name}</Text>)}
      </View>
    )}
    {char.items?.length > 0 && (
      <View style={styles.listContainer}>
        <Text style={[styles.listTitle, { fontSize: 13 * fontSizeMultiplier }]}>아이템</Text>
        {char.items.map(item => <Text key={item.name} style={[styles.listItemText, { fontSize: 12 * fontSizeMultiplier }]}>- {item.name}</Text>)}
      </View>
    )}
  </>
);

// --- 메인 컴포넌트 ---
export default function GameSetup({
  topic,
  characters: initialCharacters,
  onStart,
}: GameSetupProps) {
  const { fontSizeMultiplier } = useSettings(); // 설정 컨텍스트에서 폰트 크기 가져오기
  const [fontsLoaded, fontError] = useFonts({
    'neodgm': require("@/assets/fonts/neodgm.ttf"),
  });

  const allCharacters: Character[] = useMemo(() => {
    try {
      const chars = JSON.parse(initialCharacters);
      console.log("서버로부터 받은 캐릭터 데이터:", JSON.stringify(chars, null, 2));
      return Array.isArray(chars) ? chars : [];
    } 
    catch (e) { console.error("캐릭터 데이터 파싱 실패:", e); return []; }
  }, [initialCharacters]);

  const [mySelection, setMySelection] = useState<string | null>(null);
  const isGameStartedRef = useRef(false);

  const handleCharacterSelect = (charId: string) => {
    console.log(`[SingleGameSetup] 캐릭터 선택됨: ${charId}`);
    setMySelection(charId);
  };

  const handleGameStart = () => {
      if (isGameStartedRef.current) return;
      if (!mySelection) {
        alert("플레이할 캐릭터를 선택해주세요.");
        return;
      }
      const myCharacter = allCharacters.find(char => char.id === mySelection);
      if (!myCharacter) {
        console.error("선택한 캐릭터 정보를 찾을 수 없습니다.");
        alert("오류: 선택된 캐릭터를 찾을 수 없습니다. 다시 시도해주세요.");
        return;
      }
      const aiCharacters = allCharacters.filter(char => char.id !== mySelection);
      isGameStartedRef.current = true;
      
      onStart({
        myCharacter,
        aiCharacters,
        allCharacters,
      });
  };

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalBox}>
        <Text style={[styles.modalTitle, { fontSize: 24 * fontSizeMultiplier }]}>캐릭터 선택</Text>
        <ScrollView contentContainerStyle={styles.characterGridContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.characterGrid}>
          {allCharacters.map((char) => {
            const isSelectedByMe = mySelection === char.id;
            
            return (
              <TouchableOpacity
                key={char.id}
                style={[
                  styles.characterCard,
                  isSelectedByMe && styles.characterSelected,
                ]}
                onPress={() => handleCharacterSelect(char.id)}
              >
                
                  <Image
                    source={
                      char.image
                        ? { uri: char.image }
                        : require("@/assets/images/game/multi/character/knight.png")
                    }
                    style={styles.characterImage}
                    resizeMode="contain"
                  />
                  <Text style={[styles.characterName, { fontSize: 18 * fontSizeMultiplier }]}>{char.name}</Text>
                  <CharacterDetails char={char} fontSizeMultiplier={fontSizeMultiplier} />
                  {isSelectedByMe && (
                  <View style={styles.takenOverlay}>
                    <Text style={[styles.takenText, { fontSize: 20 * fontSizeMultiplier }]}>선택됨</Text>
                  </View>
                  )}
                </TouchableOpacity>
              );
            })}
            </View>
          </ScrollView>
          <TouchableOpacity
            style={[styles.finalStartBtn, !mySelection && { backgroundColor: '#5A5A5A' }]}
            onPress={handleGameStart}
            disabled={!mySelection}
          >
            <Text style={[styles.finalStartBtnText, { fontSize: 20 * fontSizeMultiplier }]}>모험 시작!</Text>
          </TouchableOpacity>
      </View>
    </View>
  );
}

// --- 스타일 ---
const styles = StyleSheet.create({
  loadingBackground: { flex: 1, width: "100%", justifyContent: "center", alignItems: "center" },
  loadingBox: { alignItems: "center", justifyContent: "center", padding: 20 },
  loadingText: { marginTop: 16, color: "#fff", /* fontSize: 18, */ fontWeight: "600", textAlign: 'center', fontFamily: 'neodgm' },
  finalStartBtn: { marginTop: 30, backgroundColor: "#4CAF50", paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30 },
  finalStartBtnText: { color: "#fff", /* fontSize: 20, */ fontWeight: "bold", fontFamily: 'neodgm' },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.8)" },
  modalBox: { width: "85%", maxHeight: "85%", backgroundColor: "#1E293B", borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 1, borderColor: '#334155' },
  modalTitle: { /* fontSize: 24, */ color: "#E2C044", marginBottom: 8, fontWeight: "bold", fontFamily: 'neodgm' },
  timerText: { /* fontSize: 16, */ color: "#A0A0A0", marginBottom: 16, fontStyle: 'italic', fontFamily: 'neodgm' },
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
  takenText: { color: "#E2C044", fontWeight: "bold", /* fontSize: 20, */ fontFamily: 'neodgm' },
  characterImage: { width: 120, height: 120, marginBottom: 8, borderRadius: 8 },
  characterName: { /* fontSize: 18, */ fontWeight: "bold", color: "#fff", textAlign: "center", marginBottom: 6, fontFamily: 'neodgm' },
  characterDescription: { /* fontSize: 13, */ color: '#A0A0A0', textAlign: 'center', marginBottom: 8, fontFamily: 'neodgm' },
  statsContainer: { width: '100%', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#4A5568', alignItems: 'center' },
  statText: { color: '#CBD5E1', /* fontSize: 12, */ textAlign: 'center', lineHeight: 16, fontFamily: 'neodgm' },
  listContainer: { width: '100%', marginTop: 10, alignItems: 'center' },
  listTitle: { /* fontSize: 13, */ fontWeight: 'bold', color: '#E2C044', marginBottom: 4, fontFamily: 'neodgm' },
  listItemText: { color: "#CBD5E1", /* fontSize: 12, */ lineHeight: 16, fontFamily: 'neodgm' },
});