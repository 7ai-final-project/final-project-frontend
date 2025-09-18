// frontend/components/ProfileModal.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Image, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

// 이 컴포넌트가 받을 Props의 타입을 정의합니다.
interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  // user 객체의 타입을 좀 더 명확하게 정의하면 좋습니다.
  user: {
    name: string;
    nickname: string;
    email?: string;
    picture?: string;
  } | null;
  // 닉네임 업데이트 함수를 props로 받습니다
  onUpdateNickname?: (newNickname: string) => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ visible, onClose, user, onUpdateNickname }) => {
  // 닉네임 편집 모드 상태
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  // 임시 닉네임 값
  const [tempNickname, setTempNickname] = useState('');
  // 저장 중 상태
  const [isSaving, setIsSaving] = useState(false);
  // 에러 메시지 상태
  const [errorMessage, setErrorMessage] = useState('');

  // user가 변경될 때마다 tempNickname을 초기화
  useEffect(() => {
    if (user) {
      setTempNickname(user.nickname);
    }
  }, [user]);

  // user 데이터가 없으면 모달을 렌더링하지 않습니다. (안전장치)
  if (!user) {
    return null;
  }

  // 닉네임 편집 시작
  const handleStartEditNickname = () => {
    setTempNickname(user.nickname);
    setIsEditingNickname(true);
  };

  // 닉네임 편집 취소
  const handleCancelEditNickname = () => {
    setTempNickname(user.nickname);
    setIsEditingNickname(false);
    setErrorMessage('');
  };

  // 닉네임 저장
  const handleSaveNickname = async () => {
    if (isSaving) return;

    console.log(`nickname : ${tempNickname.trim()}, 길이 : ${tempNickname.trim().length}`);
    console.log('handleSaveNickname 함수 시작'); // 디버그 로그 추가

    // 빈 닉네임 체크
    if (!tempNickname.trim()) {
      console.log('빈 닉네임 에러'); // 디버그 로그
      setErrorMessage('닉네임을 입력해주세요.');
      return;
    }

    // 닉네임 길이 체크 (2자 이상 10자 이하)
    if (tempNickname.trim().length < 2 || tempNickname.trim().length > 10) {
      console.log('닉네임 길이 에러'); // 디버그 로그
      setErrorMessage('닉네임은 2자 이상 10자 이하로 입력해주세요.');
      return;
    }

    // 팀원 코드와 동일한 정규식 사용 (한글 자모음 포함)
    const nicknameRegex = /^[a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ]*$/;
    if (!nicknameRegex.test(tempNickname.trim())) {
      console.log('닉네임 정규식 에러'); // 디버그 로그
      setErrorMessage('닉네임은 한글, 영문, 숫자만 사용할 수 있습니다.');
      return;
    }

    console.log('검증 통과, Alert 표시 시도'); // 디버그 로그

    // 확인 다이얼로그 표시 (간단한 alert 사용)
    const isConfirmed = confirm('닉네임을 정말 수정하시겠습니까?');
    
    if (isConfirmed) {
      console.log('사용자가 확인을 선택함');
      await performNicknameUpdate();
    } else {
      console.log('사용자가 취소를 선택함');
    }
  };

  // 실제 닉네임 업데이트 수행
  const performNicknameUpdate = async () => {
    setIsSaving(true);
    setErrorMessage('');

    try {
      console.log('API 요청 시작:', {
        url: '/auth/user/update',
        data: { nickname: tempNickname.trim() }
      });

      const response = await api.put('/auth/user/update', { nickname: tempNickname.trim() });

      console.log('API 응답 성공:', response.status, response.data);

      if (response.status === 409) {
        setErrorMessage('이미 사용 중인 닉네임입니다. 다른 닉네임을 사용해주세요.');
        setIsSaving(false);
        return;
      }

      // 성공시 즉시 화면에 반영 - user 객체 직접 업데이트
      if (user) {
        user.nickname = tempNickname.trim();
      }

      // 부모 컴포넌트에도 알림
      if (onUpdateNickname) {
        onUpdateNickname(tempNickname.trim());
      }
      
      alert('닉네임이 성공적으로 변경되었습니다!');
      
      // 편집 모드만 종료 (모달은 열어둠)
      setIsEditingNickname(false);
      setErrorMessage('');
      
    } catch (error: any) {
      console.error('닉네임 업데이트 실패:', error);
      
      // 팀원 코드와 동일한 에러 처리 방식
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

  // 모달이 닫힐 때 편집 모드도 종료
  const handleModalClose = () => {
    setIsEditingNickname(false);
    setTempNickname(user.nickname);
    setErrorMessage('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={handleModalClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.profileModalBox}>
          <TouchableOpacity style={styles.closeIcon} onPress={handleModalClose}>
            <Ionicons name="close" size={24} color="#aaa" />
          </TouchableOpacity>
          
          <Image 
            source={user.picture ? { uri: user.picture } : require('../assets/images/default_profile.png')} 
            style={styles.profileImage} 
          />
          
          <View style={styles.profileTextContainer}>
            <View style={styles.nameContainer}>
              <Text style={styles.profileName}>{user.name}</Text>
            </View>
            
            <View style={styles.nicknameContainer}>
              {isEditingNickname ? (
                // 편집 모드: TextInput과 저장/취소 버튼
                <View style={styles.nicknameEditContainer}>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.nicknameInput, errorMessage ? styles.inputError : null]}
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
                          size={16} 
                          color={isSaving ? "#aaa" : "#4CAF50"} 
                        />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.cancelButton, isSaving && styles.disabledButton]} 
                        onPress={handleCancelEditNickname}
                        disabled={isSaving}
                      >
                        <Ionicons name="close" size={16} color="#f44336" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {errorMessage ? (
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  ) : null}
                </View>
              ) : (
                // 일반 모드: 닉네임과 편집 버튼
                <View style={styles.nicknameDisplayContainer}>
                  <Text style={styles.profileNickname}>({user.nickname})</Text>
                  <TouchableOpacity style={styles.editNicknameButton} onPress={handleStartEditNickname}>
                    <Ionicons name="pencil" size={16} color="#aaa" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            
            <Text style={styles.profileEmail}>{user.email || '이메일 정보 없음'}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// 이 컴포넌트에서만 사용하는 스타일을 여기에 정의합니다.
const styles = StyleSheet.create({
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  profileModalBox: {
    width: '90%',
    maxWidth: 380, // 350에서 380으로 증가
    backgroundColor: '#2a2d47',
    borderRadius: 16,
    padding: 24, // 20에서 24로 증가
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  closeIcon: { 
    position: 'absolute', 
    top: 10, 
    right: 10,
    padding: 5,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
    borderWidth: 2,
    borderColor: '#eee',
  },
  profileTextContainer: {
    flex: 1,
  },
  nameContainer: {
    marginBottom: 4,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'neodgm',
  },
  nicknameContainer: {
    marginBottom: 8,
  },
  nicknameDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileNickname: {
    fontSize: 18,
    color: '#fff',
    fontFamily: 'neodgm',
    marginRight: 8,
  },
  editNicknameButton: {
    padding: 4,
  },
  nicknameEditContainer: {
    flexDirection: 'column',
    flex: 1,
    minWidth: 0, // 추가: flexbox에서 텍스트 오버플로우 방지
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0, // 추가: flexbox에서 텍스트 오버플로우 방지
  },
  nicknameInput: {
    flex: 1,
    fontSize: 16, // 18에서 16으로 약간 줄임
    color: '#fff',
    fontFamily: 'neodgm',
    backgroundColor: '#1a1d35',
    borderRadius: 8,
    paddingHorizontal: 10, // 12에서 10으로 줄임
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#444',
    marginRight: 6, // 8에서 6으로 줄임
    minWidth: 0, // 추가: 텍스트 오버플로우 방지
  },
  inputError: {
    borderColor: '#f44336',
  },
  editButtonsContainer: {
    flexDirection: 'row',
  },
  saveButton: {
    padding: 4,
    marginRight: 4,
  },
  cancelButton: {
    padding: 4,
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
});

export default ProfileModal;