import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, Alert, useWindowDimensions, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api, { fetchUserStoryProgress } from '../services/api';
import { useFonts } from 'expo-font';

// 업적 데이터 타입
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  isUnlocked: boolean;
}

// 더미 업적 데이터
const dummyAchievements: Achievement[] = [
  { id: '1', name: '첫 번째 도전', description: '게임에 처음 접속했습니다.', icon: 'star', isUnlocked: true },
  { id: '2', name: '초보 사냥꾼', description: '몬스터 10마리를 처치했습니다.', icon: 'sword', isUnlocked: true },
  { id: '3', name: '탐험가', description: '숨겨진 지역을 발견했습니다.', icon: 'map', isUnlocked: false },
  { id: '4', name: '골드 수집가', description: '총 1000골드를 모았습니다.', icon: 'cash', isUnlocked: false },
  { id: '5', name: '마스터 길드원', description: '모든 퀘스트를 완료했습니다.', icon: 'shield', isUnlocked: false },
];

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: {
    name: string;
    nickname: string;
    email?: string;
  } | null;
  onUpdateNickname?: (newNickname: string) => void;
}

// 스토리 진행률 데이터 타입
interface StoryProgress {
  story_id: string;
  story_title: string;
  total_endings: number;
  unlocked_endings: number;
}

const AchievementSection: React.FC<{ achievements: Achievement[]; isMobile: boolean }> = ({ achievements, isMobile }) => (
  <View style={styles.achievementContainer}>
    <Text style={isMobile ? styles.achievementTitleMobile : styles.achievementTitle}>
      <Ionicons name="trophy" size={isMobile ? 18 : 22} color="#FFD700" /> 업적
    </Text>
    <ScrollView style={styles.achievementList} showsVerticalScrollIndicator={false}>
      {achievements.map((item) => (
        <View key={item.id} style={isMobile ? styles.achievementItemMobile : styles.achievementItem}>
          <Ionicons name={item.isUnlocked ? "lock-open" : "lock-closed"} size={isMobile ? 18 : 24} color={item.isUnlocked ? "#3CB371" : "#A9A9A9"} style={styles.achievementIcon} />
          <View style={styles.achievementTextContainer}>
            <Text style={isMobile ? styles.achievementNameMobile : styles.achievementName}>{item.name}</Text>
            <Text style={isMobile ? styles.achievementDescMobile : styles.achievementDesc}>{item.description}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  </View>
);

const ProfileModal: React.FC<ProfileModalProps> = ({ visible, onClose, user, onUpdateNickname }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [isEditing, setIsEditing] = useState(false);
  const [newNickname, setNewNickname] = useState(user?.nickname || '');
  const [fontsLoaded] = useFonts({
    'neodgm': require('../assets/fonts/neodgm.ttf'),
  });

  const [storyProgressList, setStoryProgressList] = useState<StoryProgress[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchProgressData = async () => {
      if (user) {
        setLoading(true);
        try {
          const response = await fetchUserStoryProgress();
          setStoryProgressList(response.data.progress_list);
        } catch (error) {
          console.error("스토리 진행률 로딩 실패:", error);
          setStoryProgressList(null);
        } finally {
          setLoading(false);
        }
      }
    };

    if (visible) {
      fetchProgressData();
    } else {
      setStoryProgressList(null);
    }
  }, [visible, user]);

  if (!fontsLoaded) {
    return null;
  }

  const handleUpdateNickname = () => {
    if (onUpdateNickname) {
      onUpdateNickname(newNickname);
      setIsEditing(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={[styles.modalView, isMobile ? styles.modalViewMobile : {}]}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={isMobile ? 24 : 30} color="#F4E4BC" />
          </TouchableOpacity>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <Ionicons name="person-circle" size={isMobile ? 80 : 100} color="#F4E4BC" />
            
            <View style={styles.infoContainer}>
              <Text style={isMobile ? styles.nameTextMobile : styles.nameText}>{user?.name}</Text>
              {isEditing ? (
                <View style={styles.editContainer}>
                  <TextInput
                    style={isMobile ? styles.nicknameInputMobile : styles.nicknameInput}
                    value={newNickname}
                    onChangeText={setNewNickname}
                    placeholder="새 닉네임"
                    placeholderTextColor="#A9A9A9"
                  />
                  <TouchableOpacity onPress={handleUpdateNickname}>
                    <Ionicons name="checkmark-circle" size={isMobile ? 24 : 30} color="#3CB371" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setIsEditing(false)}>
                    <Ionicons name="close-circle" size={isMobile ? 24 : 30} color="#A9A9A9" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.nicknameContainer}>
                  <Text style={isMobile ? styles.nicknameTextMobile : styles.nicknameText}>{user?.nickname}</Text>
                  <TouchableOpacity onPress={() => setIsEditing(true)}>
                    <Ionicons name="create-outline" size={isMobile ? 18 : 24} color="#A9A9A9" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 업적 섹션 */}
            <AchievementSection achievements={dummyAchievements} isMobile={isMobile} />
            
            {/* 스토리 진행률 섹션 */}
            <View style={styles.storyProgressContainer}>
              <Text style={isMobile ? styles.storyProgressTitleMobile : styles.storyProgressTitle}>
                <Ionicons name="book" size={isMobile ? 18 : 22} color="#F4E4BC" /> 플레이 기록
              </Text>
              {loading ? (
                <ActivityIndicator size="small" color="#F4E4BC" style={styles.loadingIndicator} />
              ) : (
                <ScrollView style={styles.storyProgressList} showsVerticalScrollIndicator={false}>
                  {storyProgressList && storyProgressList.length > 0 ? (
                    storyProgressList.map(item => (
                      <View key={item.story_id} style={styles.storyProgressItem}>
                        <Text style={isMobile ? styles.progressTextMobile : styles.progressText}>
                          {item.story_title}: {item.unlocked_endings} / {item.total_endings}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noDataText}>플레이한 스토리가 없습니다.</Text>
                  )}
                </ScrollView>
              )}
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalView: {
    width: '40%',
    backgroundColor: '#2C2B29',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#F4E4BC',
  },
  modalViewMobile: {
    width: '90%',
    padding: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
  },
  scrollContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  nameText: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'neodgm',
  },
  nameTextMobile: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'neodgm',
  },
  nicknameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  nicknameText: {
    color: '#A9A9A9',
    fontSize: 18,
    marginRight: 10,
    fontFamily: 'neodgm',
  },
  nicknameTextMobile: {
    color: '#A9A9A9',
    fontSize: 16,
    marginRight: 8,
    fontFamily: 'neodgm',
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  nicknameInput: {
    width: 150,
    borderBottomWidth: 1,
    borderBottomColor: '#F4E4BC',
    color: '#F4E4BC',
    fontSize: 16,
    marginRight: 10,
    fontFamily: 'neodgm',
  },
  nicknameInputMobile: {
    width: 120,
    borderBottomWidth: 1,
    borderBottomColor: '#F4E4BC',
    color: '#F4E4BC',
    fontSize: 14,
    marginRight: 8,
    fontFamily: 'neodgm',
  },
  achievementContainer: {
    width: '100%',
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 15,
  },
  achievementTitle: {
    color: '#FFD700',
    fontSize: 18,
    fontFamily: 'neodgm',
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  achievementTitleMobile: {
    color: '#FFD700',
    fontSize: 16,
    fontFamily: 'neodgm',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  achievementList: {
    maxHeight: 200,
    width: '100%',
    paddingHorizontal: 5,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  achievementItemMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  achievementIcon: {
    marginRight: 15,
  },
  achievementTextContainer: {
    flex: 1,
  },
  achievementName: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'neodgm',
  },
  achievementNameMobile: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'neodgm',
  },
  achievementDesc: {
    color: '#A9A9A9',
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'neodgm',
  },
  achievementDescMobile: {
    color: '#A9A9A9',
    fontSize: 10,
    marginTop: 2,
    fontFamily: 'neodgm',
  },

  storyProgressContainer: {
    width: '100%',
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 15,
  },
  storyProgressTitle: {
    color: '#F4E4BC',
    fontSize: 18,
    fontFamily: 'neodgm',
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  storyProgressTitleMobile: {
    color: '#F4E4BC',
    fontSize: 16,
    fontFamily: 'neodgm',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  storyProgressList: {
    maxHeight: 200,
    width: '100%',
    paddingHorizontal: 5,
  },
  storyProgressItem: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 16,
    color: '#fff',
    fontFamily: 'neodgm',
  },
  progressTextMobile: {
    fontSize: 14,
    color: '#fff',
    fontFamily: 'neodgm',
  },
  noDataText: {
    color: '#A9A9A9',
    textAlign: 'center',
    fontFamily: 'neodgm',
    marginTop: 20,
  },
  loadingIndicator: {
    marginTop: 20,
    marginBottom: 20,
  },
});

export default ProfileModal;