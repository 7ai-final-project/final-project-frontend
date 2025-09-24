// frontend\app\game\multi\index.tsx

import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, SafeAreaView, Alert, TextInput, Switch, ActivityIndicator, LayoutAnimation, UIManager, Platform, Pressable } from "react-native";
import { router, useFocusEffect } from "expo-router";
import api from "../../../services/api";
import { Ionicons } from '@expo/vector-icons';
import CreateRoomScreen from './room/create_room';
import { Audio } from "expo-av";
import { useFonts } from 'expo-font';
import { useSettings } from '../../../components/context/SettingsContext';
import OptionsModal from "../../../components/OptionsModal";

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
  const [fontsLoaded, fontError] = useFonts({
    'neodgm': require('../../../assets/fonts/neodgm.ttf'),
  });

  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);

  const [createRoomModalVisible, setCreateRoomModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<number | null>(null);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);

  const { isBgmOn } = useSettings();
  const musicRef = useRef<Audio.Sound | null>(null);
  const isFetching = useRef(false); // 중복 요청 방지 플래그

  useFocusEffect(
    useCallback(() => {
      const manageMusic = async () => {
          if (isBgmOn) {
            if (!musicRef.current) {
                try {
                await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
                const { sound } = await Audio.Sound.createAsync(
                    require('../../../assets/sounds/lobby_music.mp3'),
                    { isLooping: true }
                );
                await sound.playAsync();
                musicRef.current = sound;
                } catch (error) {
                console.error("배경 음악 로딩 실패:", error);
                }
            }
            else {
                await musicRef.current.playAsync();
            }
          } 
          else {
            if (musicRef.current) {
                await musicRef.current.stopAsync();
            }
          }
      };

      manageMusic();

      return () => {
          if (musicRef.current) {
            musicRef.current.unloadAsync();
            musicRef.current = null;
          }
      };
      }, [isBgmOn]) 
  );
  
  // 특정 페이지를 불러오는 함수
  const fetchPage = useCallback(async (pageNumber: number, isRefresh = false) => {
    // 중복 요청 방지
    if (isFetching.current) return;
    isFetching.current = true;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      params.append('page', pageNumber.toString());
      if (searchQuery) params.append('search', searchQuery);
      if (showAvailableOnly) params.append('status', 'waiting');
      
      const res = await api.get<{ results: GameRoom[], next: string | null }>(`/game/?${params.toString()}`);
      
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      
      setRooms(res.data.results);
      setCurrentPage(pageNumber);
      setHasNextPage(res.data.next !== null);

    } catch (err) {
      console.error("방 목록 불러오기 실패:", err);
      Alert.alert("오류", "방 목록을 불러오는 데 실패했습니다.");
    } finally {
      isFetching.current = false;
      setLoading(false);
      setRefreshing(false);
    }
    // --- 👇 [핵심 수정] 의존성 배열에서 loading 제거 ---
  }, [searchQuery, showAvailableOnly]); 


  // 화면에 처음 들어올 때 첫 페이지 로드
  useFocusEffect(
    useCallback(() => {
      // 컴포넌트가 마운트되거나 포커스될 때 첫 페이지를 불러옵니다.
      fetchPage(1, true);
    }, [fetchPage]) // fetchPage 함수가 (검색어 변경 등으로) 새로 생성될 때만 이 효과를 다시 실행
  );

  // 검색어/필터 변경 시 첫 페이지 로드
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery, showAvailableOnly]);

  // 다음/이전 페이지 이동 핸들러
  const handleNextPage = () => {
    if (hasNextPage && !isFetching.current) {
      fetchPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1 && !isFetching.current) {
      fetchPage(currentPage - 1);
    }
  };

  const handleDeletePress = (roomId: number) => {
    setRoomToDelete(roomId);
    setIsConfirmModalVisible(true);
  };

  const confirmDelete = async () => {
    if (roomToDelete === null) return;
    try {
      await api.delete(`/game/${roomToDelete}/`);
      Alert.alert("성공", "방이 삭제되었습니다.");
      setIsConfirmModalVisible(false);
      setRoomToDelete(null);
      fetchPage(1, true);
    } catch (err) {
      console.error("방 삭제 실패:", err);
      Alert.alert("오류", "방 삭제에 실패했습니다.");
      setIsConfirmModalVisible(false);
      setRoomToDelete(null);
    }
  };

  const handleRoomCreated = (newRoom: GameRoom) => {
    if (newRoom && newRoom.id) {
      setCreateRoomModalVisible(false);
      // 새로 생성된 방의 ID를 가지고 방 화면으로 즉시 이동합니다.
      router.push({ pathname: "/game/multi/room/[id]", params: { id: newRoom.id.toString() } });
    } else {
      // 혹시 모를 예외 처리
      setCreateRoomModalVisible(false);
      Alert.alert("오류", "방 생성 후 정보를 받아오지 못했습니다.");
      fetchPage(1, true); // 목록 새로고침
    }
  };
  
  const renderRoomStatus = (status: 'waiting' | 'play') => {
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
            handleDeletePress(item.id);
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

  const renderPaginationControls = () => {
    if (loading && !refreshing) {
      return <ActivityIndicator size="large" color="#61dafb" style={{ marginVertical: 20 }} />;
    }
    if (rooms.length === 0 && !loading) {
      return null;
    }
    return (
      <View style={styles.paginationContainer}>
        <TouchableOpacity
          style={[styles.paginationButton, (currentPage === 1) && styles.disabledButton]}
          onPress={handlePrevPage}
          disabled={currentPage === 1 || loading}
        >
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        
        <Text style={styles.paginationText}>페이지 {currentPage}</Text>
        
        <TouchableOpacity
          style={[styles.paginationButton, !hasNextPage && styles.disabledButton]}
          onPress={handleNextPage}
          disabled={!hasNextPage || loading}
        >
          <Ionicons name="chevron-forward" size={24} color="white" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.headerIcon} onPress={() => router.push('/')}>
          <Ionicons name="arrow-back" size={32} color="#61dafb" />
        </TouchableOpacity>
        <Text style={styles.header}>멀티 모드 로비</Text>
        {/* 오른쪽 아이콘들을 View로 묶습니다. */}
        <View style={styles.headerRightIcons}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setCreateRoomModalVisible(true)}>
            <Ionicons name="add-circle" size={32} color="#61dafb" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setOptionsModalVisible(true)}>
            <Ionicons name="settings-sharp" size={28} color="#E2C044" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={rooms}
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
        onRefresh={() => fetchPage(1, true)}
        refreshing={refreshing}
        ListFooterComponent={renderPaginationControls} 
      />
      
      <Modal visible={createRoomModalVisible} animationType="slide" transparent={true} onRequestClose={() => setCreateRoomModalVisible(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <CreateRoomScreen onClose={() => setCreateRoomModalVisible(false)} onRoomCreated={handleRoomCreated} />
            </View>
        </View>
      </Modal>

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
      <OptionsModal
        visible={optionsModalVisible}
        onClose={() => setOptionsModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1021", paddingTop: 20 },
  headerContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 20, 
    marginBottom: 10 
  },
  header: { 
    flex: 1,
    textAlign: 'center',
    fontSize: 28, 
    fontWeight: "bold", 
    color: "#E2C044", 
    fontFamily: 'neodgm' 
  },
  headerIcon: {
    padding: 5,
  },
  emptyListText: { color: "#D1C4E9", fontSize: 16, textAlign: "center", marginTop: 50, fontFamily: 'neodgm' },
  roomCard: { padding: 15, marginHorizontal: 20, marginVertical: 8, backgroundColor: "#1E293B", borderRadius: 10, borderColor: "#334155", borderWidth: 1 },
  roomCardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  roomName: { flexShrink: 1, fontSize: 18, fontWeight: "bold", color: "white", fontFamily: 'neodgm' },
  deleteButton: { padding: 5, marginLeft: 'auto' },
  roomDescription: { color: "#D1C4E9", fontSize: 14, marginBottom: 10, minHeight: 35, fontFamily: 'neodgm' },
  roomCardFooter: { flexDirection: 'row', alignItems: 'center' },
  roomParticipants: { color: "#9CA3AF", fontSize: 14, marginLeft: 8, fontFamily: 'neodgm' },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "90%", maxHeight: "80%", borderRadius: 16, overflow: 'hidden' },
  statusIndicator: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10, marginRight: 10 },
  statusText: { color: 'white', fontWeight: 'bold', fontSize: 12, fontFamily: 'neodgm' },
  listHeader: { paddingHorizontal: 20, marginBottom: 10 },
  searchInput: { backgroundColor: "#1E293B", color: 'white', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 15, fontSize: 16, marginBottom: 15, borderColor: "#334155", borderWidth: 1, fontFamily: 'neodgm' },
  filterContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterText: { color: 'white', fontSize: 16, fontFamily: 'neodgm' },
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
    fontFamily: 'neodgm'
  },
  confirmModalText: {
    fontSize: 16,
    color: '#D1C4E9',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
    fontFamily: 'neodgm'
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
    fontFamily: 'neodgm'
  },
  deleteConfirmButton: {
    backgroundColor: '#DC2626',
  },
  deleteConfirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'neodgm'
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  paginationButton: {
    backgroundColor: '#334155',
    padding: 10,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#1E293B',
    opacity: 0.5,
  },
  paginationText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'neodgm',
    fontWeight: 'bold',
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
});