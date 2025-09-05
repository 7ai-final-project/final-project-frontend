// ./room/create_room.tsx

import React, { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Switch } from "react-native";
import api from "../../../../services/api";
import { Ionicons } from '@expo/vector-icons';

interface CreateRoomScreenProps {
  onClose: () => void;
  onRoomCreated: () => void;
}

export default function CreateRoomScreen({ onClose, onRoomCreated }: CreateRoomScreenProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isCreating, setIsCreating] = useState(false);

  // --- 🎨 UI/UX 개선을 위한 상태 추가 ---
  const [isPrivate, setIsPrivate] = useState(false); // 비밀방 여부 상태
  const [password, setPassword] = useState(""); // 비밀번호 상태

  const handlePlayerCountChange = useCallback((increment: number) => {
    setMaxPlayers(prevCount => {
      const newCount = prevCount + increment;
      return newCount >= 2 && newCount <= 6 ? newCount : prevCount; // 인원 2~6명으로 제한
    });
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("오류", "방 이름을 입력해주세요.");
      return;
    }
    if (isPrivate && !password.trim()) {
      Alert.alert("오류", "비밀방은 비밀번호를 입력해야 합니다.");
      return;
    }

    setIsCreating(true);
    try {
      // --- 🎨 API 요청 데이터 수정 ---
      const payload: any = {
        name,
        description,
        max_players: maxPlayers,
        // room_type 필드는 백엔드 Room 모델 및 Serializer에 추가되어야 합니다.
        room_type: isPrivate ? 'private' : 'public',
      };
      
      // 비밀방일 경우에만 password 필드를 추가합니다.
      if (isPrivate) {
        payload.password = password;
      }

      await api.post("game/", payload);

      Alert.alert("성공", "방이 성공적으로 생성되었습니다!");
      onRoomCreated();
    } catch (err) {
      console.error("방 생성 실패:", err);
      Alert.alert("오류", "방 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoidingContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>방 만들기</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close-circle" size={28} color="#D1C4E9" />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>방 이름</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="방 이름을 입력하세요" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>방 설명</Text>
            <TextInput style={[styles.input, styles.descriptionInput]} value={description} onChangeText={setDescription} placeholder="방 설명을 입력하세요 (선택 사항)" placeholderTextColor="#9CA3AF" multiline />
            
            <Text style={styles.label}>최대 인원</Text>
            <View style={styles.playerCountSelector}>
              <TouchableOpacity style={[styles.playerCountButton, maxPlayers === 2 && styles.playerCountButtonDisabled]} onPress={() => handlePlayerCountChange(-1)} disabled={maxPlayers === 2}>
                <Ionicons name="remove" size={24} color={maxPlayers === 2 ? "#6B7280" : "white"} />
              </TouchableOpacity>
              <Text style={styles.playerCountText}>{maxPlayers}</Text>
              <TouchableOpacity style={[styles.playerCountButton, maxPlayers === 6 && styles.playerCountButtonDisabled]} onPress={() => handlePlayerCountChange(1)} disabled={maxPlayers === 6}>
                <Ionicons name="add" size={24} color={maxPlayers === 6 ? "#6B7280" : "white"} />
              </TouchableOpacity>
            </View>

            {/* --- 🎨 비밀방 설정 UI 추가 --- */}
            <View style={styles.optionRow}>
              <Text style={styles.label}>비밀방으로 설정</Text>
              <Switch
                trackColor={{ false: "#767577", true: "#81b0ff" }}
                thumbColor={isPrivate ? "#61dafb" : "#f4f3f4"}
                onValueChange={setIsPrivate}
                value={isPrivate}
              />
            </View>
            
            {isPrivate && (
              <>
                <Text style={styles.label}>비밀번호</Text>
                <TextInput 
                  style={styles.input} 
                  value={password} 
                  onChangeText={setPassword} 
                  placeholder="비밀번호를 입력하세요" 
                  placeholderTextColor="#9CA3AF" 
                  secureTextEntry // 비밀번호를 가려줍니다.
                />
              </>
            )}

            <TouchableOpacity style={[styles.createButton, isCreating && styles.createButtonDisabled]} onPress={handleSubmit} disabled={isCreating}>
              <Text style={styles.buttonText}>{isCreating ? "생성 중..." : "방 만들기"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// 스타일 시트
const styles = StyleSheet.create({
  keyboardAvoidingContainer: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  container: { width: "100%", backgroundColor: "#2B355E", borderRadius: 16, padding: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  closeButton: { padding: 5 },
  title: { fontSize: 22, fontWeight: "bold", color: "#E2C044" },
  form: { marginTop: 10 },
  label: { fontSize: 16, fontWeight: "600", marginBottom: 8, color: "#D1C4E9" },
  input: { backgroundColor: "rgba(255,255,255,0.1)", color: "white", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 15, marginBottom: 15, fontSize: 16, borderColor: "#131A33", borderWidth: 1 },
  descriptionInput: { height: 100, textAlignVertical: "top" },
  playerCountSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 8, marginBottom: 15, borderColor: "#131A33", borderWidth: 1, paddingVertical: 8 },
  playerCountButton: { padding: 10 },
  playerCountButtonDisabled: { opacity: 0.5 },
  playerCountText: { fontSize: 20, fontWeight: 'bold', color: 'white', marginHorizontal: 20, minWidth: 30, textAlign: 'center' },
  createButton: { backgroundColor: "#61dafb", padding: 15, borderRadius: 10, alignItems: "center", marginTop: 20 },
  createButtonDisabled: { backgroundColor: "#9CA3AF" },
  buttonText: { fontSize: 18, color: "#0B1021", fontWeight: "bold" },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 }, // label과 스타일 통일감을 위해 padding 추가
});