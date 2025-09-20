import React from 'react';
import { View, Text, Modal, TouchableOpacity, Switch, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';

interface OptionsModalProps {
  visible: boolean;
  onClose: () => void;
  isBgmOn: boolean;
  setIsBgmOn: (value: boolean) => void;
  isSfxOn: boolean;
  setIsSfxOn: (value: boolean) => void;
  fontSizeMultiplier: number;
  setFontSizeMultiplier: (value: number) => void;
  backgroundColor: string;
  setBackgroundColor: (value: string) => void;
}

export default function OptionsModal({
  visible,
  onClose,
  isBgmOn,
  setIsBgmOn,
  isSfxOn,
  setIsSfxOn,
  fontSizeMultiplier,
  setFontSizeMultiplier,
  backgroundColor,
  setBackgroundColor,
}: OptionsModalProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [fontsLoaded, fontError] = useFonts({'neodgm': require('../assets/fonts/neodgm.ttf'),});

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={isMobile ? styles.modalBoxMobile : styles.modalBox}>
          <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
            <Ionicons name="close" size={isMobile ? 22 : 24} color="#aaa" />
          </TouchableOpacity>
          <Text style={isMobile ? styles.modalTitleMobile : styles.modalTitle}>설정</Text>

          {/* 배경 색상 선택 섹션 */}
          <View style={isMobile ? styles.optionSectionMobile : styles.optionSection}>
            <Text style={isMobile ? styles.optionLabelMobile : styles.optionLabel}>바탕화면 색상</Text>
            <View style={styles.colorOptionsContainer}>
              {['#0B1021', '#4A148C', '#004D40', '#3E2723'].map(color => (
                <TouchableOpacity 
                  key={color}
                  style={[styles.colorOption, isMobile ? styles.colorOptionMobile : {}, { backgroundColor: color, borderColor: backgroundColor === color ? '#E2C044' : 'rgba(255,255,255,0.3)' }]} 
                  onPress={() => setBackgroundColor(color)} 
                />
              ))}
            </View>
          </View>

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
            <View style={isMobile ? styles.fontSizeSelectorMobile : styles.fontSizeSelector}>
              <TouchableOpacity 
                onPress={() => setFontSizeMultiplier(0.9)} 
                style={[isMobile ? styles.fontSizeButtonMobile : styles.fontSizeButton, fontSizeMultiplier === 0.9 && styles.fontSizeButtonActive]}
              >
                <Text style={isMobile ? styles.fontSizeButtonTextMobile : styles.fontSizeButtonText}>작게</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setFontSizeMultiplier(1)} 
                style={[isMobile ? styles.fontSizeButtonMobile : styles.fontSizeButton, fontSizeMultiplier === 1 && styles.fontSizeButtonActive]}
              >
                <Text style={isMobile ? styles.fontSizeButtonTextMobile : styles.fontSizeButtonText}>보통</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setFontSizeMultiplier(1.1)} 
                style={[isMobile ? styles.fontSizeButtonMobile : styles.fontSizeButton, fontSizeMultiplier === 1.1 && styles.fontSizeButtonActive]}
              >
                <Text style={isMobile ? styles.fontSizeButtonTextMobile : styles.fontSizeButtonText}>크게</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    padding: 6 
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
  colorOptionsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    width: '100%',
    paddingVertical: 5,
  },
  colorOption: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    borderWidth: 3 
  },
  colorOptionMobile: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
  },
  fontSizeSelector: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    width: '100%', 
    backgroundColor: 'rgba(0,0,0,0.2)', 
    borderRadius: 8 
  },
  fontSizeSelectorMobile: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    width: '100%', 
    backgroundColor: 'rgba(0,0,0,0.2)', 
    borderRadius: 6,
  },
  fontSizeButton: { 
    flex: 1, 
    paddingVertical: 10, 
    alignItems: 'center', 
    borderRadius: 8 
  },
  fontSizeButtonMobile: {
    flex: 1, 
    paddingVertical: 7,
    alignItems: 'center', 
    borderRadius: 6, 
  },
  fontSizeButtonActive: { 
    backgroundColor: '#7C3AED' 
  },
  fontSizeButtonText: { 
    color: '#fff', 
    fontWeight: '600',
    fontFamily: 'neodgm',
  },
  fontSizeButtonTextMobile: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 13,
    fontFamily: 'neodgm',
  },
});