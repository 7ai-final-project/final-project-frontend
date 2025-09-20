import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, Alert, useWindowDimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useFonts } from 'expo-font';

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
  { id: '4', name: '골드 수집가', description: '총 1000골드를 모았습니다.', icon: 'cash', isUnlocked: true },
  { id: '5', name: '대장장이', description: '아이템을 5개 제작했습니다.', icon: 'hammer', isUnlocked: false },
  { id: '6', name: '전설의 시작', description: '첫 번째 보스를 물리쳤습니다.', icon: 'trophy', isUnlocked: true },
  { id: '7', name: '미지의 영웅', description: '모든 업적을 달성했습니다.', icon: 'ribbon', isUnlocked: false },
  { id: '8', name: '끈기의 증명', description: '100시간 이상 플레이했습니다.', icon: 'time', isUnlocked: false },
];

// 게임 업적 섹션 컴포넌트
const AchievementSection = ({ achievements, isMobile }: { achievements: Achievement[], isMobile: boolean }) => {
  return (
    <View style={isMobile ? achievementStyles.achievementContainerMobile : achievementStyles.achievementContainer}>
      <Text style={isMobile ? achievementStyles.achievementTitleMobile : achievementStyles.achievementTitle}>
        <Ionicons name="trophy" size={isMobile ? 18 : 22} color="#FFD700" /> 게임 업적
      </Text>
      <ScrollView style={achievementStyles.achievementList}>
        {achievements.map((achievement) => (
          <View key={achievement.id} style={isMobile ? achievementStyles.achievementItemMobile : achievementStyles.achievementItem}>
            <Ionicons
              name={achievement.icon as any}
              size={isMobile ? 24 : 28}
              color={achievement.isUnlocked ? '#FFD700' : '#888'}
              style={achievementStyles.achievementIcon}
            />
            <View style={achievementStyles.achievementTextContent}>
              <Text style={isMobile ? achievementStyles.achievementNameMobile : achievementStyles.achievementName}>
                {achievement.name}
              </Text>
              <Text style={isMobile ? achievementStyles.achievementDescriptionMobile : achievementStyles.achievementDescription}>
                {achievement.description}
              </Text>
            </View>
            {achievement.isUnlocked && (
              <Ionicons name="checkmark-circle" size={isMobile ? 20 : 24} color="#4CAF50" />
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default function ProfileModal({ visible, onClose, user, onUpdateNickname }: ProfileModalProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [fontsLoaded, fontError] = useFonts({ 'neodgm': require('../assets/fonts/neodgm.ttf'), });

  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [tempNickname, setTempNickname] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (user) {
      setTempNickname(user.nickname);
    }
  }, [user]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (!user) {
    return null;
  }

  const handleStartEditNickname = () => {
    setTempNickname(user.nickname);
    setIsEditingNickname(true);
  };

  const handleCancelEditNickname = () => {
    setTempNickname(user.nickname);
    setIsEditingNickname(false);
    setErrorMessage('');
  };

  const handleSaveNickname = async () => {
    if (isSaving) return;

    if (!tempNickname.trim()) {
      setErrorMessage('닉네임을 입력해주세요.');
      return;
    }

    if (tempNickname.trim().length < 2 || tempNickname.trim().length > 10) {
      setErrorMessage('닉네임은 2자 이상 10자 이하로 입력해주세요.');
      return;
    }

    const nicknameRegex = /^[a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ]*$/;
    if (!nicknameRegex.test(tempNickname.trim())) {
      setErrorMessage('닉네임은 한글, 영문, 숫자만 사용할 수 있습니다.');
      return;
    }

    const isConfirmed = confirm('닉네임을 정말 수정하시겠습니까?');    
    if (isConfirmed) {
      console.log('사용자가 확인을 선택함');
      await performNicknameUpdate();
    } else {
      console.log('사용자가 취소를 선택함');
    }
  };

  const performNicknameUpdate = async () => {
    setIsSaving(true);
    setErrorMessage('');

    try {
      const response = await api.put('/auth/user/update', { nickname: tempNickname.trim() });

      if (response.status === 409) {
        setErrorMessage('이미 사용 중인 닉네임입니다. 다른 닉네임을 사용해주세요.');
        setIsSaving(false);
        return;
      }

      if (user) {
        user.nickname = tempNickname.trim();
      }

      if (onUpdateNickname) {
        onUpdateNickname(tempNickname.trim());
      }

      Alert.alert('성공', '닉네임이 성공적으로 변경되었습니다!');

      setIsEditingNickname(false);
      setErrorMessage('');

    } catch (error: any) {
      console.error('닉네임 업데이트 실패:', error);

      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else if (error.response?.status === 409) {
        setErrorMessage('이미 사용 중인 닉네임입니다. 다른 닉네임을 사용해주세요.');
      } else {
        setErrorMessage('닉네임 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleModalClose = () => {
    setIsEditingNickname(false);
    setTempNickname(user.nickname);
    setErrorMessage('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={handleModalClose}>
      <View style={styles.modalOverlay}>
        <View style={isMobile ? styles.profileModalBoxMobile : styles.profileModalBox}>
          <TouchableOpacity style={styles.closeIcon} onPress={handleModalClose}>
            <Ionicons name="close" size={isMobile ? 22 : 24} color="#aaa" />
          </TouchableOpacity>
          <Text style={isMobile ? styles.modalTitleMobile : styles.modalTitle}>프로필</Text>

          <View style={isMobile ? styles.profileContentMobile : styles.profileContent}>
            <View style={isMobile ? styles.profileIconContainerMobile : styles.profileIconContainer}>
              <Ionicons name="person-circle" size={isMobile ? 70 : 80} color="#eee" />
            </View>

            <View style={styles.profileTextContainer}>
              <View style={isMobile ? styles.userInfoSectionMobile : styles.userInfoSection}>
                <Text style={isMobile ? styles.userInfoLabelMobile : styles.userInfoLabel}>닉네임</Text>
                {isEditingNickname ? (
                  <View style={styles.nicknameEditContainer}>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.nicknameInput, errorMessage ? styles.inputError : null, isMobile ? styles.nicknameInputMobile : {}]}
                        value={tempNickname}
                        onChangeText={setTempNickname}
                        placeholder="닉네임을 입력하세요"
                        placeholderTextColor="#aaa"
                        autoFocus={true}
                        selectTextOnFocus={true}
                        maxLength={10}
                        editable={!isSaving}
                        autoCapitalize="none"
                        keyboardAppearance="dark"
                      />
                      <View style={styles.editButtonsContainer}>
                        <TouchableOpacity
                          style={[styles.saveButton, isSaving && styles.disabledButton]}
                          onPress={handleSaveNickname}
                          disabled={isSaving}
                        >
                          <Ionicons
                            name={isSaving ? "hourglass" : "checkmark"}
                            size={isMobile ? 18 : 20}
                            color={isSaving ? "#aaa" : "#4CAF50"}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.cancelButton, isSaving && styles.disabledButton]}
                          onPress={handleCancelEditNickname}
                          disabled={isSaving}
                        >
                          <Ionicons name="close" size={isMobile ? 18 : 20} color="#f44336" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {errorMessage ? (
                      <Text style={styles.errorText}>{errorMessage}</Text>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.nicknameDisplayContainer}>
                    <Text style={isMobile ? styles.profileNicknameMobile : styles.profileNickname}>{user.nickname} ({user.name})</Text>
                    <TouchableOpacity style={styles.editNicknameButton} onPress={handleStartEditNickname}>
                      <Ionicons name="pencil" size={isMobile ? 16 : 18} color="#aaa" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* 이메일 */}
              <View style={isMobile ? styles.userInfoSectionMobile : styles.userInfoSection}>
                <Text style={isMobile ? styles.userInfoLabelMobile : styles.userInfoLabel}>이메일</Text>
                <Text style={isMobile ? styles.profileEmailMobile : styles.profileEmail}>{user.email || '이메일 정보 없음'}</Text>
              </View>
            </View>
          </View>

          {/* 게임 업적 섹션 */}
          <AchievementSection achievements={dummyAchievements} isMobile={isMobile} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  profileModalBox: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: '#2a2d47',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    position: 'relative'
  },
  profileModalBoxMobile: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#2a2d47',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 15,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    position: 'relative',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'neodgm',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20
  },
  modalTitleMobile: {
    fontSize: 18,
    fontFamily: 'neodgm',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15
  },
  closeIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 6
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 20,
  },
  profileContentMobile: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
  },
  profileIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    marginRight: 20,
    borderWidth: 2,
    borderColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3b3e5c',
  },
  profileIconContainerMobile: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3b3e5c',
  },
  profileTextContainer: {
    flex: 1,
  },
  userInfoSection: {
    width: '100%',
    marginBottom: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 15,
  },
  userInfoSectionMobile: {
    width: '100%',
    marginBottom: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 10,
    alignItems: 'center',
  },
  userInfoLabel: {
    color: '#D1C4E9',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
    fontFamily: 'neodgm',
  },
  userInfoLabelMobile: {
    color: '#D1C4E9',
    fontSize: 13,
    marginBottom: 5,
    fontWeight: '600',
    fontFamily: 'neodgm',
  },
  nicknameDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  profileNickname: {
    fontSize: 18,
    color: '#fff',
    fontFamily: 'neodgm',
    marginRight: 8,
  },
  profileNicknameMobile: {
    fontSize: 15,
    color: '#fff',
    fontFamily: 'neodgm',
    marginRight: 6,
  },
  editNicknameButton: {
    padding: 4,
  },
  nicknameEditContainer: {
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 5,
  },
  nicknameInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    fontFamily: 'neodgm',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 6,
    minWidth: 0,
  },
  nicknameInputMobile: {
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  inputError: {
    borderColor: '#f44336',
  },
  editButtonsContainer: {
    flexDirection: 'row',
  },
  saveButton: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginRight: 4,
  },
  cancelButton: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 12,
    color: '#f44336',
    fontFamily: 'neodgm',
    marginTop: 4,
  },
  profileEmail: {
    fontSize: 18,
    color: '#fff',
    fontFamily: 'neodgm',
  },
  profileEmailMobile: {
    fontSize: 15,
    color: '#fff',
    fontFamily: 'neodgm',
  },
});

// 업적 섹션 스타일 시트
const achievementStyles = StyleSheet.create({
  achievementContainer: {
    width: '100%',
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 15,
  },
  achievementContainerMobile: {
    width: '100%',
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 10,
    alignItems: 'center',
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
    marginRight: 10,
  },
  achievementTextContent: {
    flex: 1,
  },
  achievementName: {
    fontSize: 16,
    color: '#fff',
    fontFamily: 'neodgm',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  achievementNameMobile: {
    fontSize: 14,
    color: '#fff',
    fontFamily: 'neodgm',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  achievementDescription: {
    fontSize: 13,
    color: '#bbb',
    fontFamily: 'neodgm',
  },
  achievementDescriptionMobile: {
    fontSize: 11,
    color: '#bbb',
    fontFamily: 'neodgm',
  },
});