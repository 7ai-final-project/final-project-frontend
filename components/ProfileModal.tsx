// frontend/components/ProfileModal.tsx

import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 이 컴포넌트가 받을 Props의 타입을 정의합니다.
interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  // user 객체의 타입을 좀 더 명확하게 정의하면 좋습니다.
  user: {
    name?: string;
    email?: string;
    picture?: string;
  } | null;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ visible, onClose, user }) => {
  // user 데이터가 없으면 모달을 렌더링하지 않습니다. (안전장치)
  if (!user) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.profileModalBox}>
          <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
            <Ionicons name="close" size={24} color="#aaa" />
          </TouchableOpacity>
          
          <Image 
            source={user.picture ? { uri: user.picture } : require('../assets/images/default_profile.png')} 
            style={styles.profileImage} 
          />
          <View style={styles.profileTextContainer}>
            <Text style={styles.profileName}>{user.name || '이름 없음'}</Text>
            <Text style={styles.profileEmail}>{user.email || '이메일 정보 없음'}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// 이 컴포넌트에서만 사용하는 스타일을 여기에 정의합니다.
const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  profileModalBox: {
    width: '90%',
    maxWidth: 350,
    backgroundColor: '#2a2d47',
    borderRadius: 16,
    padding: 20,
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
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'neodgm',
  },
  profileEmail: {
    fontSize: 18,
    color: '#fff',
    marginTop: 4,
    fontFamily: 'neodgm',
  },
});

export default ProfileModal;