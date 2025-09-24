import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import api from '../../services/api';

interface NicknameInputModalProps {
  visible: boolean;
  onClose: (saved: boolean) => void; 
  onSave: (nickname: string) => void;
  initialNickname?: string;
}

export default function NicknameInputModal({
  visible,
  onClose,
  onSave,
  initialNickname = '',
}: NicknameInputModalProps) {
  const [nickname, setNickname] = useState(initialNickname);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [fontsLoaded] = useFonts({
    'neodgm': require('../../assets/fonts/neodgm.ttf'),
  });

  useEffect(() => {
    if (visible) {
      setNickname(initialNickname);
      setErrorMessage('');
      setIsSaving(false);
    }
  }, [visible, initialNickname]);

  const handleSave = async () => {
    if (isSaving) return;

    if (!nickname.trim()) {
      setErrorMessage('닉네임을 입력해주세요.');
      return;
    }

    if (nickname.trim().length < 2 || nickname.trim().length > 10) {
      setErrorMessage('닉네임은 2자 이상 10자 이하로 입력해주세요.');
      return;
    }

    const nicknameRegex = /^[a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ]*$/;
    if (!nicknameRegex.test(nickname.trim())) {
      setErrorMessage('닉네임은 한글, 영문, 숫자만 사용할 수 있습니다.');
      return;
    }

    setIsSaving(true);

    try {
      const response = await api.put(`/auth/user/update`, { nickname: nickname.trim() });
      
      if (response.status === 409) {
        setErrorMessage('이미 사용 중인 닉네임입니다. 다른 닉네임을 사용해주세요.');
        setIsSaving(false);
        return;
      }

      onSave(nickname.trim());
      alert('닉네임이 성공적으로 설정되었습니다!');
      onClose(true);
    } catch (error: any) {
      console.error("닉네임 업데이트 중 오류 발생: ", error);
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('닉네임 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      onRequestClose={() => onClose(false)}
    >
      <KeyboardAvoidingView
        style={styles.overlayWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* 배경을 터치하면 닫히도록 */}
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => onClose(false)}
        >
          {/* 모달 안쪽은 터치 이벤트 전파 막기 */}
          <TouchableWithoutFeedback>
            <View style={styles.modalBox}>
              <TouchableOpacity
                style={styles.closeIcon}
                onPress={() => onClose(false)}
              >
                <Ionicons name="close" size={24} color="#aaa" />
              </TouchableOpacity>

              <Text style={styles.modalTitle}>닉네임 설정</Text>
              <Text style={styles.modalDescription}>
                모험을 시작하기 전에 멋진 닉네임을 설정해주세요!
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.nicknameInput}
                  placeholder="여기에 닉네임을 입력하세요"
                  placeholderTextColor="#888"
                  value={nickname}
                  onChangeText={setNickname}
                  maxLength={10}
                  autoCapitalize="none"
                  keyboardAppearance="dark"
                />
              </View>

              {errorMessage ? (
                <Text style={styles.errorMessage}>{errorMessage}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Text style={styles.saveButtonText}>저장 중...</Text>
                ) : (
                  <Text style={styles.saveButtonText}>닉네임 저장</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalBox: {
    width: '85%',
    maxWidth: 500,
    backgroundColor: '#2a2d47',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    position: 'relative',
    borderWidth: 2,
    borderColor: '#4a4e69',
  },
  closeIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 6,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'neodgm',
    fontWeight: 'bold',
    color: '#E2C044',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 16,
    fontFamily: 'neodgm',
    color: '#D1C4E9',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 15,
    backgroundColor: '#3a3f5a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5a5f7f',
  },
  nicknameInput: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: 'neodgm',
    color: '#F4E4BC',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    fontFamily: 'neodgm',
    color: '#FF6B6B',
    marginBottom: 15,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 12,
    width: '80%',
    alignItems: 'center',
    marginTop: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  saveButtonDisabled: {
    backgroundColor: '#5a2c9e',
  },
  saveButtonText: {
    fontSize: 18,
    fontFamily: 'neodgm',
    fontWeight: 'bold',
    color: '#fff',
  },
});