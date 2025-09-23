import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, TextInput,
  useWindowDimensions, ScrollView, ActivityIndicator,
  UIManager, Platform, LayoutAnimation, Animated, Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import api from '../services/api'; // API import 통일

// Android LayoutAnimation 설정
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- 타입 정의 ---
// 'mode' 속성 추가
interface Achievement { id: string; name: string; description: string; icon: string; isUnlocked: boolean; mode: 'story' | 'single' | 'multi'; }
interface StoryProgress { story_id: string; story_title: string; total_endings: number; unlocked_endings: number; }
interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: { name: string; nickname: string; email?: string; } | null;
  onUpdateNickname?: (newNickname: string) => void;
}

// --- 🟢 탭별 콘텐츠를 위한 컴포넌트 분리 ---

// 1. 개인정보 탭 컴포넌트
const ProfileSection: React.FC<{
  user: ProfileModalProps['user'];
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  newNickname: string;
  setNewNickname: (nickname: string) => void;
  handleUpdateNickname: () => void;
  isMobile: boolean;
  isSaving: boolean;
  errorMessage: string;
}> = ({ user, isEditing, setIsEditing, newNickname, setNewNickname, handleUpdateNickname, isMobile, isSaving, errorMessage }) => (
  <View style={styles.contentContainer}>
    <Ionicons name="person-circle" size={isMobile ? 80 : 100} color="#F4E4BC" />
    <View style={styles.infoContainer}>
      <Text style={isMobile ? styles.nameTextMobile : styles.nameText}>{user?.name}</Text>
      {isEditing ? (
        <View style={styles.editContainer}>
          <TextInput
            style={[styles.nicknameInput, errorMessage ? styles.inputError : null]}
            value={newNickname}
            onChangeText={setNewNickname}
            placeholder="2~10자 한글, 영문, 숫자"
            placeholderTextColor="#A9A9A9"
            maxLength={10}
            editable={!isSaving}
          />
          <TouchableOpacity onPress={handleUpdateNickname} disabled={isSaving} style={isSaving ? styles.disabledButton : {}}>
            <Ionicons name="checkmark-circle" size={isMobile ? 24 : 30} color="#3CB371" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsEditing(false)} disabled={isSaving} style={isSaving ? styles.disabledButton : {}}>
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
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  </View>
);

// 2. 업적 아이템 컴포넌트 (새로 추가)
const AchievementItem = ({ item, isMobile }: { item: Achievement; isMobile: boolean }) => (
  <View key={item.id} style={item.isUnlocked ? (isMobile ? styles.achievementItemUnlockedMobile : styles.achievementItemUnlocked) : (isMobile ? styles.achievementItemMobile : styles.achievementItem)}>
    <Ionicons name={item.isUnlocked ? "lock-open" : "lock-closed"} size={isMobile ? 18 : 24} color={item.isUnlocked ? "#3CB371" : "#A9A9A9"} style={styles.achievementIcon} />
    <View style={styles.achievementTextContainer}>
      <Text style={item.isUnlocked ? (isMobile ? styles.achievementNameUnlockedMobile : styles.achievementNameUnlocked) : (isMobile ? styles.achievementNameMobile : styles.achievementName)}>{item.name}</Text>
      <Text style={isMobile ? styles.achievementDescMobile : styles.achievementDesc}>{item.description}</Text>
    </View>
  </View>
);

// 3. 업적 탭 컴포넌트 (업데이트됨)
const AchievementSection: React.FC<{
  allAchievements: { story: Achievement[]; single: Achievement[]; multi: Achievement[]; } | null;
  loading: boolean;
  isMobile: boolean
}> = ({ allAchievements, loading, isMobile }) => {
  const [activeAchievementTab, setActiveAchievementTab] = useState<'story' | 'single' | 'multi'>('story');

  const filteredAchievements = allAchievements && allAchievements[activeAchievementTab]
    ? allAchievements[activeAchievementTab]
    : [];

  return (
    <View style={styles.contentContainer}>
      <Text style={isMobile ? styles.contentTitleMobile : styles.contentTitle}>
        <Ionicons name="trophy" size={isMobile ? 18 : 22} color="#FFD700" /> 업적
      </Text>

      <View style={styles.achievementTabBar}>
        <TouchableOpacity
          style={[styles.achievementTabButton, activeAchievementTab === 'story' && styles.activeAchievementTabButton]}
          onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveAchievementTab('story'); }}
        >
          <Text style={styles.achievementTabButtonText}>스토리모드</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.achievementTabButton, activeAchievementTab === 'single' && styles.activeAchievementTabButton]}
          onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveAchievementTab('single'); }}
        >
          <Text style={styles.achievementTabButtonText}>싱글 모드</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.achievementTabButton, activeAchievementTab === 'multi' && styles.activeAchievementTabButton]}
          onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveAchievementTab('multi'); }}
        >
          <Text style={styles.achievementTabButtonText}>멀티 모드</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FFD700" style={styles.loadingIndicator} />
      ) : (
        <ScrollView style={styles.listScrollView} showsVerticalScrollIndicator={false}>
          {filteredAchievements && filteredAchievements.length > 0 ? (
            filteredAchievements.map((item) => (
              <AchievementItem key={item.id} item={item} isMobile={isMobile} />
            ))
          ) : (
            <Text style={styles.noDataText}>해당 모드의 업적이 없습니다.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
};

// 4. 기타 컴포넌트들
const ProgressBar: React.FC<{ progress: number; isMobile: boolean }> = ({ progress, isMobile }) => (
    <View style={isMobile ? styles.progressBarContainerMobile : styles.progressBarContainer}><View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} /></View>
);

const StoryProgressSection: React.FC<{ storyProgressList: StoryProgress[] | null; loading: boolean; isMobile: boolean; }> = ({ storyProgressList, loading, isMobile }) => (
    <View style={styles.contentContainer}><Text style={isMobile ? styles.contentTitleMobile : styles.contentTitle}><Ionicons name="book" size={isMobile ? 18 : 22} color="#F4E4BC" /> 플레이 기록</Text>{loading ? (<ActivityIndicator size="large" color="#F4E4BC" style={styles.loadingIndicator} />) : (<ScrollView style={styles.listScrollView} showsVerticalScrollIndicator={false}>{storyProgressList && storyProgressList.length > 0 ? (storyProgressList.map(item => { const progress = item.total_endings > 0 ? item.unlocked_endings / item.total_endings : 0; return (<View key={item.story_id} style={styles.storyProgressItem}><Text style={isMobile ? styles.progressTextMobile : styles.progressText}>{item.story_title}: {item.unlocked_endings} / {item.total_endings}</Text><ProgressBar progress={progress} isMobile={isMobile} /></View>); })) : (<Text style={styles.noDataText}>플레이한 스토리가 없습니다.</Text>)}</ScrollView>)}</View>
);

const Toast: React.FC<{ message: string; visible: boolean; onHide: () => void; isMobile: boolean }> = ({ message, visible, onHide, isMobile }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => { if (visible) { Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start(); const timer = setTimeout(() => { Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(onHide); }, 2000); return () => clearTimeout(timer); } }, [visible, fadeAnim, onHide]);
    if (!visible) return null;
    return (<Animated.View style={[isMobile ? styles.toastContainerMobile : styles.toastContainer, { opacity: fadeAnim }]}><Text style={styles.toastText}>{message}</Text></Animated.View>);
};

// --- 🟣 메인 ProfileModal 컴포넌트 ---
const ProfileModal: React.FC<ProfileModalProps> = ({ visible, onClose, user, onUpdateNickname }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // --- State 관리 ---
  const [activeTab, setActiveTab] = useState<'profile' | 'achievements' | 'progress'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [newNickname, setNewNickname] = useState(user?.nickname || '');
  const [storyProgressList, setStoryProgressList] = useState<StoryProgress[] | null>(null);
  const [allAchievements, setAllAchievements] = useState<{ story: Achievement[]; single: Achievement[]; multi: Achievement[]; } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [achievementLoading, setAchievementLoading] = useState<boolean>(false);
  const [fontsLoaded] = useFonts({ 'neodgm': require('../assets/fonts/neodgm.ttf') });
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 닉네임 수정 시작 시, 현재 닉네임으로 상태 초기화
  useEffect(() => {
    if (isEditing && user) {
        setNewNickname(user.nickname);
        setErrorMessage('');
    }
  }, [isEditing, user]);

  // 데이터 로딩 Effect
  useEffect(() => {
    const fetchProgressData = async () => {
      if (user) {
        setLoading(true);
        try {
          const response = await api.get('/storymode/story/progress/user/');
          setStoryProgressList(response.data.progress_list);
        } catch (error) {
          console.error("스토리 진행률 로딩 실패:", error);
          setStoryProgressList(null);
        } finally {
          setLoading(false);
        }
      }
    };

    const fetchAchievements = async () => {
      if (user) {
        setAchievementLoading(true);
        try {
          const response = await api.get('/auth/achievements/');
          setAllAchievements(response.data.data);
        } catch (error) {
          console.error("업적 로딩 실패:", error);
          setAllAchievements(null);
        } finally {
          setAchievementLoading(false);
        }
      }
    };

    if (visible) {
      fetchProgressData();
      fetchAchievements();
      setActiveTab('profile');
    } else {
      setStoryProgressList(null);
      setAllAchievements(null);
      setIsEditing(false);
    }
  }, [visible, user]);

  // --- 닉네임 업데이트 핸들러 ---
  const handleUpdateNickname = async () => {
    if (isSaving) return;

    const trimmedNickname = newNickname.trim();
    if (!trimmedNickname) {
      setErrorMessage('닉네임을 입력해주세요.');
      return;
    }
    if (trimmedNickname.length < 2 || trimmedNickname.length > 10) {
      setErrorMessage('닉네임은 2자 이상 10자 이하로 입력해주세요.');
      return;
    }
    if (!/^[a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ]*$/.test(trimmedNickname)) {
      setErrorMessage('닉네임은 한글, 영문, 숫자만 사용할 수 있습니다.');
      return;
    }
    
    setIsSaving(true);
    setErrorMessage('');

    try {
      await api.put('/auth/user/update', { nickname: trimmedNickname });

      if (onUpdateNickname) {
        onUpdateNickname(trimmedNickname);
      }
      
      setIsEditing(false);
      setToast({ visible: true, message: '닉네임이 성공적으로 변경되었습니다.' });

    } catch (error: any) {
      console.error('닉네임 업데이트 실패:', error);
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('닉네임 저장 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTabPress = (tabName: 'profile' | 'achievements' | 'progress') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tabName);
  }

  if (!fontsLoaded) return null;

  // --- 렌더링 ---
  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      {/* 아래 View를 Pressable로 변경하고 onPress 속성을 추가합니다. */}
      <Pressable style={styles.centeredView} onPress={onClose}>
        {/* 이 TouchableOpacity는 내용 클릭 시 창이 닫히는 것을 막아주므로 그대로 둡니다. */}
        <TouchableOpacity activeOpacity={1} style={[styles.modalView, isMobile ? styles.modalViewMobile : {}]} onPress={(e) => e.stopPropagation()}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={isMobile ? 24 : 30} color="#F4E4BC" />
          </TouchableOpacity>
          <View style={styles.modalContentLayout}>
            <View style={styles.tabBar}>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'profile' && styles.activeTabButton]} onPress={() => handleTabPress('profile')}><Ionicons name="person-outline" size={isMobile ? 20 : 24} color="#F4E4BC" />{!isMobile && <Text style={styles.tabButtonText}>개인정보</Text>}</TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'achievements' && styles.activeTabButton]} onPress={() => handleTabPress('achievements')}><Ionicons name="trophy-outline" size={isMobile ? 20 : 24} color="#FFD700" />{!isMobile && <Text style={styles.tabButtonText}>업적</Text>}</TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'progress' && styles.activeTabButton]} onPress={() => handleTabPress('progress')}><Ionicons name="book-outline" size={isMobile ? 20 : 24} color="#87CEEB" />{!isMobile && <Text style={styles.tabButtonText}>플레이 기록</Text>}</TouchableOpacity>
            </View>
            <View style={styles.contentArea}>
                {activeTab === 'profile' && ( <ProfileSection user={user} isEditing={isEditing} setIsEditing={setIsEditing} newNickname={newNickname} setNewNickname={setNewNickname} handleUpdateNickname={handleUpdateNickname} isMobile={isMobile} isSaving={isSaving} errorMessage={errorMessage} /> )}
                {activeTab === 'achievements' && ( <AchievementSection allAchievements={allAchievements} loading={achievementLoading} isMobile={isMobile} /> )}
                {activeTab === 'progress' && ( <StoryProgressSection storyProgressList={storyProgressList} loading={loading} isMobile={isMobile}/> )}
            </View>
          </View>
          <Toast message={toast.message} visible={toast.visible} onHide={() => setToast({ ...toast, visible: false })} isMobile={isMobile} />
        </TouchableOpacity>
      </Pressable>
    </Modal>
  );
};

// --- 스타일 정의 ---
const styles = StyleSheet.create({
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.7)', },
  modalView: { width: '60%', height: '70%', maxWidth: 900, maxHeight: 600, backgroundColor: '#2C2B29', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, borderWidth: 2, borderColor: '#F4E4BC', },
  modalViewMobile: { width: '95%', height: '85%', padding: 10, },
  closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 10, },
  modalContentLayout: { flex: 1, flexDirection: 'row', },
  tabBar: { flex: 1, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.1)', paddingRight: 10, marginRight: 10, },
  tabButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 10, borderRadius: 8, marginBottom: 10, },
  activeTabButton: { backgroundColor: 'rgba(244, 228, 188, 0.1)', },
  tabButtonText: { color: '#F4E4BC', fontSize: 16, fontFamily: 'neodgm', marginLeft: 10, },
  contentArea: { flex: 3, justifyContent: 'center', alignItems: 'center', },
  contentContainer: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'flex-start', padding: 10, },
  contentTitle: { color: '#F4E4BC', fontSize: 22, fontFamily: 'neodgm', fontWeight: 'bold', marginBottom: 20, textAlign: 'center', },
  contentTitleMobile: { fontSize: 18, color: '#F4E4BC', fontFamily: 'neodgm', fontWeight: 'bold', marginBottom: 15, textAlign: 'center', },
  listScrollView: { width: '100%', },
  infoContainer: { alignItems: 'center', marginTop: 10, width: '100%' },
  nameText: { color: '#fff', fontSize: 24, fontFamily: 'neodgm' },
  nameTextMobile: { fontSize: 20, color: '#fff', fontFamily: 'neodgm' },
  nicknameContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  nicknameText: { color: '#A9A9A9', fontSize: 18, marginRight: 10, fontFamily: 'neodgm' },
  nicknameTextMobile: { fontSize: 16, color: '#A9A9A9', marginRight: 8, fontFamily: 'neodgm' },
  editContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 5, width: '90%' },
  nicknameInput: { flex: 1, borderBottomWidth: 1, borderBottomColor: '#F4E4BC', color: '#F4E4BC', fontSize: 16, marginRight: 10, fontFamily: 'neodgm', paddingBottom: 5 },
  inputError: { borderColor: '#f44336' },
  disabledButton: { opacity: 0.5 },
  errorText: { fontSize: 12, color: '#f44336', fontFamily: 'neodgm', marginTop: 8, },
  
  // 업적 아이템 스타일 (업데이트됨)
  achievementItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  achievementItemMobile: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  achievementItemUnlocked: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(60,179,113,0.1)', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#3CB371' },
  achievementItemUnlockedMobile: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(60,179,113,0.1)', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#3CB371' },
  achievementIcon: { marginRight: 15 },
  achievementTextContainer: { flex: 1 },
  achievementName: { color: '#fff', fontSize: 16, fontFamily: 'neodgm' },
  achievementNameMobile: { fontSize: 14, color: '#fff', fontFamily: 'neodgm' },
  achievementNameUnlocked: { color: '#3CB371', fontSize: 16, fontFamily: 'neodgm', fontWeight: 'bold' },
  achievementNameUnlockedMobile: { color: '#3CB371', fontSize: 14, fontFamily: 'neodgm', fontWeight: 'bold' },
  achievementDesc: { color: '#A9A9A9', fontSize: 12, marginTop: 4, fontFamily: 'neodgm' },
  achievementDescMobile: { fontSize: 10, color: '#A9A9A9', marginTop: 2, fontFamily: 'neodgm' },
  
  // 플레이 기록
  storyProgressItem: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', },
  progressText: { fontSize: 16, color: '#fff', fontFamily: 'neodgm', textAlign: 'center', },
  progressTextMobile: { fontSize: 14, color: '#fff', fontFamily: 'neodgm', textAlign: 'center', },
  noDataText: { color: '#A9A9A9', textAlign: 'center', fontFamily: 'neodgm', marginTop: 20 },
  loadingIndicator: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  progressBarContainer: { height: 8, width: '100%', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 4, marginTop: 8, overflow: 'hidden', },
  progressBarContainerMobile: { height: 6, width: '100%', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 3, marginTop: 6, },
  progressBarFill: { height: '100%', backgroundColor: '#3CB371', borderRadius: 4, },

  // 토스트
  toastContainer: { position: 'absolute', bottom: 30, alignSelf: 'center', backgroundColor: 'rgba(0, 0, 0, 0.85)', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 25, elevation: 10, },
  toastContainerMobile: { position: 'absolute', bottom: 20, alignSelf: 'center', width: '80%', backgroundColor: 'rgba(0, 0, 0, 0.85)', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 15, alignItems: 'center', },
  toastText: { color: '#fff', fontSize: 14, fontFamily: 'neodgm', },
  
  // 업적 탭 바 스타일 (새로 추가)
  achievementTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 10,
  },
  achievementTabButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 15,
  },
  activeAchievementTabButton: {
    backgroundColor: 'rgba(255,215,0,0.2)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  achievementTabButtonText: {
    color: '#F4E4BC',
    fontSize: 14,
    fontFamily: 'neodgm',
  },
});

export default ProfileModal;