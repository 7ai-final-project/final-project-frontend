// frontend\app\game\multi\index.tsx

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, SafeAreaView, Alert, TextInput, Switch, ActivityIndicator, LayoutAnimation, UIManager, Platform, Pressable } from "react-native";
import { router, useFocusEffect } from "expo-router";
import api from "../../../services/api";
import { Ionicons } from '@expo/vector-icons';
import CreateRoomScreen from './room/create_room';
import { Audio } from "expo-av";

// Android에서 LayoutAnimation을 사용하기 위한 설정
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface GameRoom {
  id: number;
  name: string;
  description: string;
  selected_by_room: any[];
  max_players: number;
  status: 'waiting' | 'play';
  room_type: 'public' | 'private';
}

export default function MultiModeLobby() {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [createRoomModalVisible, setCreateRoomModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  
  // --- 👇 추가: 삭제 확인 모달을 위한 상태 ---
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<number | null>(null);

  // ★★★ 2. 배경 음악을 저장할 새로운 state를 만듭니다. ★★★
  const [music, setMusic] = useState<Audio.Sound | null>(null);

  // ★★★ 3. 로비 화면이 나타날 때 배경 음악을 로드하고 재생합니다. ★★★
  useEffect(() => {
    const loadAndPlayMusic = async () => {
        try {
            await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
            const { sound } = await Audio.Sound.createAsync(
               require('../../../assets/sounds/lobby_music.mp3'), // 경로를 확인해주세요!
               { shouldPlay: true } // 로드 후 바로 재생
            );
            setMusic(sound);
        } catch (error) {
            console.error("배경 음악 로딩 실패:", error);
        }
    };

    loadAndPlayMusic();

    // 이 화면을 떠날 때 (게임 방에 들어가거나, 뒤로 갈 때) 음악을 정리합니다.
    return () => {
        console.log("로비 화면을 떠나므로 음악을 정지합니다.");
        music?.unloadAsync();
    };
  }, []); // 이 useEffect는 로비 화면에 처음 들어왔을 때 딱 한 번만 실행됩니다.

  const fetchRooms = useCallback(async (isRefresh = false) => {
    // ... (이전과 동일한 fetchRooms 함수)
    if (loading || refreshing) return;
    const pageToFetch = isRefresh ? 1 : page;
    if (!isRefresh && !hasNextPage) return;
    if (isRefresh) { setRefreshing(true); } else { setLoading(true); }
    try {
      const params = new URLSearchParams();
      params.append('page', pageToFetch.toString());
      if (searchQuery) params.append('search', searchQuery);
      if (showAvailableOnly) params.append('status', 'waiting');
      const res = await api.get<{ results: GameRoom[], next: string | null }>(`/game/?${params.toString()}`);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      if (isRefresh) {
        setRooms(res.data.results);
      } else {
        setRooms(prevRooms => {
          const newRooms = res.data.results.filter(newItem => !prevRooms.some(prevItem => prevItem.id === newItem.id));
          return [...prevRooms, ...newRooms];
        });
      }
      setPage(pageToFetch + 1);
      setHasNextPage(res.data.next !== null);
    } catch (err) {
      console.error("방 목록 불러오기 실패:", err);
      Alert.alert("오류", "방 목록을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, loading, refreshing, hasNextPage, searchQuery, showAvailableOnly]);

  useFocusEffect(
    useCallback(() => {
      // 화면에 들어올 때 항상 첫 페이지부터 새로고침
      setPage(1);
      setHasNextPage(true);
      fetchRooms(true); // 'true'를 인자로 주어 새로고침 동작을 수행
    }, []) // 의존성 배열은 비워둡니다.
  );

  useEffect(() => {
    // ... (이전과 동일한 useEffect)
    const handler = setTimeout(() => {
      setPage(1);
      setHasNextPage(true);
      fetchRooms(true);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery, showAvailableOnly]);

  // --- 👇 수정: 삭제 버튼 클릭 시 모달을 여는 함수 ---
  const handleDeletePress = (roomId: number) => {
    setRoomToDelete(roomId); // 삭제할 방 ID 저장
    setIsConfirmModalVisible(true); // 모달 열기
  };

  // --- 👇 추가: 모달에서 '삭제' 버튼을 눌렀을 때 실행되는 함수 ---
  const confirmDelete = async () => {
    if (roomToDelete === null) return;

    try {
      await api.delete(`/game/${roomToDelete}/`);
      Alert.alert("성공", "방이 삭제되었습니다.");
      
      // 모달 닫고 상태 초기화
      setIsConfirmModalVisible(false);
      setRoomToDelete(null);
      
      // 목록 새로고침
      setPage(1);
      setHasNextPage(true);
      fetchRooms(true);
    } catch (err) {
      console.error("방 삭제 실패:", err);
      Alert.alert("오류", "방 삭제에 실패했습니다.");
      setIsConfirmModalVisible(false);
      setRoomToDelete(null);
    }
  };

  const handleRoomCreated = () => {
    setCreateRoomModalVisible(false);
    setPage(1);
    setHasNextPage(true);
    fetchRooms(true);
  };
  
  const renderRoomStatus = (status: 'waiting' | 'play') => {
    // ... (이전과 동일)
    const color = status === 'waiting' ? '#4CAF50' : '#F44336';
    const text = status === 'waiting' ? '대기중' : '게임중';
    return <View style={[styles.statusIndicator, { backgroundColor: color }]}><Text style={styles.statusText}>{text}</Text></View>;
  };
  
  const renderRoomItem = ({ item }: { item: GameRoom }) => (
    <TouchableOpacity style={styles.roomCard} onPress={() => router.push({ pathname: "/game/multi/room/[id]", params: { id: item.id.toString() } })}>
      <View style={styles.roomCardHeader}>
        {renderRoomStatus(item.status)}
        <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
        {item.room_type === "private" && (
          <Ionicons name="lock-closed" size={16} color="#E2C044" style={{ marginHorizontal: 8 }} />
        )}
        <Pressable 
          style={styles.deleteButton} 
          onPress={(e) => { 
            e.stopPropagation();
            handleDeletePress(item.id); // --- 👆 수정: 모달을 열도록 함수 변경 ---
          }}
        >
          <Ionicons name="trash-outline" size={22} color="#DC2626" />
        </Pressable>
      </View>
      <Text style={styles.roomDescription} numberOfLines={2}>{item.description || "설명 없음"}</Text>
      <View style={styles.roomCardFooter}>
        <Ionicons name="people" size={16} color="#9CA3AF" />
        <Text style={styles.roomParticipants}>{item.selected_by_room?.length || 0} / {item.max_players} 명</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* ... (헤더 및 FlatList는 이전과 거의 동일) ... */}
      <View style={styles.headerContainer}>
        <Text style={styles.header}>멀티 모드 로비</Text>
        <TouchableOpacity style={styles.createRoomButton} onPress={() => setCreateRoomModalVisible(true)}>
          <Ionicons name="add-circle" size={32} color="#61dafb" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={rooms}
        // ... (props 이전과 동일)
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderRoomItem}
        ListHeaderComponent={
            <View style={styles.listHeader}>
                <TextInput style={styles.searchInput} placeholder="방 이름으로 검색..." placeholderTextColor="#9CA3AF" value={searchQuery} onChangeText={setSearchQuery} />
                <View style={styles.filterContainer}>
                <Text style={styles.filterText}>입장 가능한 방만 보기</Text>
                <Switch value={showAvailableOnly} onValueChange={setShowAvailableOnly} trackColor={{ false: "#767577", true: "#81b0ff" }} thumbColor={showAvailableOnly ? "#61dafb" : "#f4f3f4"} />
                </View>
            </View>
        }
        ListEmptyComponent={!loading && !refreshing ? <Text style={styles.emptyListText}>참여할 수 있는 방이 없습니다.</Text> : null}
        onRefresh={() => {
          setPage(1);
          setHasNextPage(true);
          fetchRooms(true);
        }}
        refreshing={refreshing}
        onEndReached={() => fetchRooms()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loading ? <ActivityIndicator size="large" color="#61dafb" style={{ marginVertical: 20 }} /> : null}
      />
      
      {/* 방 생성 모달 */}
      <Modal visible={createRoomModalVisible} animationType="slide" transparent={true} onRequestClose={() => setCreateRoomModalVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <CreateRoomScreen onClose={() => setCreateRoomModalVisible(false)} onRoomCreated={handleRoomCreated} />
        </View></View>
      </Modal>

      {/* --- 👇 추가: 삭제 확인 모달 --- */}
      <Modal
        visible={isConfirmModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmModalTitle}>방 삭제</Text>
            <Text style={styles.confirmModalText}>정말로 이 방을 삭제하시겠습니까?{"\n"}이 작업은 되돌릴 수 없습니다.</Text>
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setIsConfirmModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.deleteConfirmButton]} 
                onPress={confirmDelete}
              >
                <Text style={styles.deleteConfirmButtonText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// 스타일
const styles = StyleSheet.create({
  // ... (기존 스타일)
  container: { flex: 1, backgroundColor: "#0B1021", paddingTop: 20 },
  headerContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 10 },
  header: { fontSize: 28, fontWeight: "bold", color: "#E2C044" },
  createRoomButton: { padding: 5 },
  emptyListText: { color: "#D1C4E9", fontSize: 16, textAlign: "center", marginTop: 50 },
  roomCard: { padding: 15, marginHorizontal: 20, marginVertical: 8, backgroundColor: "#1E293B", borderRadius: 10, borderColor: "#334155", borderWidth: 1 },
  roomCardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  roomName: { flexShrink: 1, fontSize: 18, fontWeight: "bold", color: "white" },
  deleteButton: { padding: 5, marginLeft: 'auto' },
  roomDescription: { color: "#D1C4E9", fontSize: 14, marginBottom: 10, minHeight: 35 },
  roomCardFooter: { flexDirection: 'row', alignItems: 'center' },
  roomParticipants: { color: "#9CA3AF", fontSize: 14, marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "90%", maxHeight: "80%", borderRadius: 16, overflow: 'hidden' },
  statusIndicator: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10, marginRight: 10 },
  statusText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  listHeader: { paddingHorizontal: 20, marginBottom: 10 },
  searchInput: { backgroundColor: "#1E293B", color: 'white', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 15, fontSize: 16, marginBottom: 15, borderColor: "#334155", borderWidth: 1 },
  filterContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterText: { color: 'white', fontSize: 16 },
  // --- 👇 추가: 삭제 확인 모달 스타일 ---
  confirmModalContent: {
    width: '80%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderColor: '#334155',
    borderWidth: 1,
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  confirmModalText: {
    fontSize: 16,
    color: '#D1C4E9',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  confirmModalButtons: {
    flexDirection: 'row',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#334155',
    marginRight: 10,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteConfirmButton: {
    backgroundColor: '#DC2626',
  },
  deleteConfirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});