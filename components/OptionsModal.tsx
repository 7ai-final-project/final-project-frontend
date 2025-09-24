import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, Switch, StyleSheet, useWindowDimensions, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { useSettings } from './context/SettingsContext'; 

interface OptionsModalProps {
  visible: boolean;
  onClose: () => void;
}

// --- 3. 토스트 컴포넌트 추가 ---
const Toast: React.FC<{ message: string; visible: boolean; onHide: () => void; }> = ({ message, visible, onHide }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
            const timer = setTimeout(() => {
                Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onHide());
            }, 1000); // 1.0초 후 사라짐
            return () => clearTimeout(timer);
        }
    }, [visible, fadeAnim, onHide]);

    if (!visible) return null;

    return (
        <Animated.View style={[styles.toastContainer, { opacity: fadeAnim }]}>
            <Text style={styles.toastText}>{message}</Text>
        </Animated.View>
    );
};


export default function OptionsModal({ visible, onClose }: OptionsModalProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const {
    isBgmOn, setIsBgmOn, isSfxOn, setIsSfxOn,
    fontSizeMultiplier, setFontSizeMultiplier, language,
  } = useSettings();
  
  // --- 3. 토스트 상태 추가 ---
  const [toast, setToast] = useState({ visible: false, message: '' });

  const [fontsLoaded, fontError] = useFonts({'neodgm': require('../assets/fonts/neodgm.ttf'),});

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      {/* --- 1. 뒷배경 클릭 시 닫기 기능 추가 (Pressable 사용) --- */}
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={isMobile ? styles.modalBoxMobile : styles.modalBox}>
          <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
            <Ionicons name="close" size={isMobile ? 22 : 24} color="#aaa" />
          </TouchableOpacity>
          <Text style={isMobile ? styles.modalTitleMobile : styles.modalTitle}>설정</Text>

          {/* 사운드 설정 섹션 */}
          <View style={isMobile ? styles.optionSectionMobile : styles.optionSection}>
            <Text style={isMobile ? styles.optionLabelMobile : styles.optionLabel}>사운드</Text>
            <View style={isMobile ? styles.optionRowMobile : styles.optionRow}>
              <Text style={isMobile ? styles.optionTextMobile : styles.optionText}>배경음악 (BGM)</Text>
              <Switch 
                trackColor={{ false: "#767577", true: "#E2C044" }} 
                thumbColor={isBgmOn ? "#f4f3f4" : "#f4f3f4"} 
                ios_backgroundColor="#3e3e3e"
                onValueChange={setIsBgmOn} 
                value={isBgmOn} 
              />
            </View>
            <View style={isMobile ? styles.optionRowMobile : styles.optionRow}>
              <Text style={isMobile ? styles.optionTextMobile : styles.optionText}>효과음 (SFX)</Text>
              <Switch 
                trackColor={{ false: "#767577", true: "#E2C044" }} 
                thumbColor={isSfxOn ? "#f4f3f4" : "#f4f3f4"} 
                ios_backgroundColor="#3e3e3e"
                onValueChange={setIsSfxOn} 
                value={isSfxOn} 
              />
            </View>
          </View>

          {/* 글자 크기 섹션 */}
          <View style={isMobile ? styles.optionSectionMobile : styles.optionSection}>
            <Text style={isMobile ? styles.optionLabelMobile : styles.optionLabel}>글자 크기</Text>
            <View style={isMobile ? styles.selectorContainerMobile : styles.selectorContainer}>
              <TouchableOpacity onPress={() => setFontSizeMultiplier(0.9)} style={[isMobile ? styles.selectorButtonMobile : styles.selectorButton, fontSizeMultiplier === 0.9 && styles.selectorButtonActive]}>
                <Text style={isMobile ? styles.selectorButtonTextMobile : styles.selectorButtonText}>작게</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFontSizeMultiplier(1)} style={[isMobile ? styles.selectorButtonMobile : styles.selectorButton, fontSizeMultiplier === 1 && styles.selectorButtonActive]}>
                <Text style={isMobile ? styles.selectorButtonTextMobile : styles.selectorButtonText}>보통</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFontSizeMultiplier(1.1)} style={[isMobile ? styles.selectorButtonMobile : styles.selectorButton, fontSizeMultiplier === 1.1 && styles.selectorButtonActive]}>
                <Text style={isMobile ? styles.selectorButtonTextMobile : styles.selectorButtonText}>크게</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 언어 선택 섹션 */}
          <View style={isMobile ? styles.optionSectionMobile : styles.optionSection}>
            <View style={styles.labelWithComingSoon}>
              <Text style={isMobile ? styles.optionLabelMobile : styles.optionLabel}>언어</Text>
              <Text style={styles.comingSoonText}>(개발 예정입니다)</Text>
            </View>
            <View style={isMobile ? styles.selectorContainerMobile : styles.selectorContainer}>
              <TouchableOpacity style={[isMobile ? styles.selectorButtonMobile : styles.selectorButton, styles.selectorButtonActive]}>
                <Text style={isMobile ? styles.selectorButtonTextMobile : styles.selectorButtonText}>한국어</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setToast({ visible: true, message: '개발 예정입니다.' })} 
                style={[isMobile ? styles.selectorButtonMobile : styles.selectorButton]}
              >
                <Text style={isMobile ? styles.selectorButtonTextMobile : styles.selectorButtonText}>English</Text>
              </TouchableOpacity>
            </View>
          </View>

        </Pressable>
        {/* --- 3. 토스트 컴포넌트 렌더링 (모달 위에 나타나도록) --- */}
        <Toast
          message={toast.message}
          visible={toast.visible}
          onHide={() => setToast({ ...toast, visible: false })}
        />
      </Pressable>
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
  modalBox: { 
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
  modalBoxMobile: { 
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
    position: 'relative' ,
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
    padding: 6,
    zIndex: 1,
  },
  optionSection: { 
    width: '100%', 
    marginBottom: 15, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.1)', 
    paddingTop: 15 
  },
  optionSectionMobile: {
    width: '100%', 
    marginBottom: 10,
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.1)', 
    paddingTop: 10
  },
  optionLabel: { 
    color: '#D1C4E9', 
    fontSize: 16, 
    marginBottom: 15, 
    fontWeight: '600',
    fontFamily: 'neodgm',
  },
  optionLabelMobile: {
    color: '#D1C4E9', 
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '600',
    fontFamily: 'neodgm',
  },
  labelWithComingSoon: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  comingSoonText: {
    color: '#A0AEC0',
    fontSize: 12,
    fontFamily: 'neodgm',
    marginLeft: 8,
    paddingBottom: 13, // optionLabel의 marginBottom과 맞추기 위함
  },
  optionRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    width: '100%', 
    paddingVertical: 5 
  },
  optionRowMobile: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    width: '100%', 
    paddingVertical: 3,
  },
  optionText: { 
    color: '#fff', 
    fontSize: 16,
    fontFamily: 'neodgm',
  },
  optionTextMobile: { 
    color: '#fff', 
    fontSize: 13,
    fontFamily: 'neodgm',
  },
  selectorContainer: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    width: '100%', 
    backgroundColor: 'rgba(0,0,0,0.2)', 
    borderRadius: 8 
  },
  selectorContainerMobile: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    width: '100%', 
    backgroundColor: 'rgba(0,0,0,0.2)', 
    borderRadius: 6,
  },
  selectorButton: {
    flex: 1, 
    paddingVertical: 10, 
    alignItems: 'center', 
    borderRadius: 8 
  },
  selectorButtonMobile: {
    flex: 1, 
    paddingVertical: 7,
    alignItems: 'center', 
    borderRadius: 6, 
  },
  selectorButtonActive: {
    backgroundColor: '#7C3AED' 
  },
  selectorButtonText: {
    color: '#fff', 
    fontWeight: '600',
    fontFamily: 'neodgm',
  },
  selectorButtonTextMobile: {
    color: '#fff', 
    fontWeight: '600',
    fontSize: 13,
    fontFamily: 'neodgm',
  },
  toastContainer: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 25,
    elevation: 10,
    zIndex: 9999, // 모달 위에 확실히 보이도록 zIndex 추가
  },
  toastText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'neodgm',
    fontWeight: 'bold',
  },
});