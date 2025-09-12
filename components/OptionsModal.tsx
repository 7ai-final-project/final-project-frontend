import React from 'react';
import { View, Text, Modal, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// 이 컴포넌트가 받을 Props의 타입을 정의합니다.
interface OptionsModalProps {
visible: boolean;
onClose: () => void;
// 각 설정 값과 그 값을 변경하는 함수들을 Props로 받습니다.
isBgmOn: boolean;
setIsBgmOn: (value: boolean) => void;
isSfxOn: boolean;
setIsSfxOn: (value: boolean) => void;
fontSizeMultiplier: number;
setFontSizeMultiplier: (value: number) => void;
backgroundColor: string;
setBackgroundColor: (value: string) => void;
}
const OptionsModal: React.FC<OptionsModalProps> = ({
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
}) => {
return (
<Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
<View style={styles.modalOverlay}>
<View style={styles.modalBox}>
<TouchableOpacity style={styles.closeIcon} onPress={onClose}>
<Ionicons name="close" size={24} color="#fff" />
</TouchableOpacity>
<Text style={styles.modalTitle}>설정</Text>
<View style={styles.optionSection}>
        <Text style={styles.optionLabel}>바탕화면 색상</Text>
        <View style={styles.colorOptionsContainer}>
          {['#0B1021', '#4A148C', '#004D40', '#3E2723'].map(color => (
            <TouchableOpacity 
              key={color}
              style={[styles.colorOption, { backgroundColor: color, borderColor: backgroundColor === color ? '#E2C044' : '#fff' }]} 
              onPress={() => setBackgroundColor(color)} 
            />
          ))}
        </View>
      </View>

      <View style={styles.optionSection}>
        <Text style={styles.optionLabel}>사운드</Text>
        <View style={styles.optionRow}>
          <Text style={styles.optionText}>배경음악 (BGM)</Text>
          <Switch trackColor={{ false: "#767577", true: "#E2C044" }} thumbColor={isBgmOn ? "#f4f3f4" : "#f4f3f4"} onValueChange={setIsBgmOn} value={isBgmOn} />
        </View>
        <View style={styles.optionRow}>
          <Text style={styles.optionText}>효과음 (SFX)</Text>
          <Switch trackColor={{ false: "#767577", true: "#E2C044" }} thumbColor={isSfxOn ? "#f4f3f4" : "#f4f3f4"} onValueChange={setIsSfxOn} value={isSfxOn} />
        </View>
      </View>

      <View style={styles.optionSection}>
        <Text style={styles.optionLabel}>글자 크기</Text>
        <View style={styles.fontSizeSelector}>
          <TouchableOpacity onPress={() => setFontSizeMultiplier(0.9)} style={[styles.fontSizeButton, fontSizeMultiplier === 0.9 && styles.fontSizeButtonActive]}>
            <Text style={styles.fontSizeButtonText}>작게</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFontSizeMultiplier(1)} style={[styles.fontSizeButton, fontSizeMultiplier === 1 && styles.fontSizeButtonActive]}>
            <Text style={styles.fontSizeButtonText}>보통</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFontSizeMultiplier(1.1)} style={[styles.fontSizeButton, fontSizeMultiplier === 1.1 && styles.fontSizeButtonActive]}>
            <Text style={styles.fontSizeButtonText}>크게</Text>
          </TouchableOpacity>
        </View>
      </View>

    </View>
  </View>
</Modal>
);
};
// 이 컴포넌트에서만 사용하는 스타일을 여기에 정의합니다.
const styles = StyleSheet.create({
modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
modalBox: { width: '85%', maxWidth: 400, backgroundColor: '#2a2d47', borderRadius: 16, padding: 24, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, position: 'relative' },
modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
closeIcon: { position: 'absolute', top: 12, right: 12, padding: 6 },
optionSection: { width: '100%', marginBottom: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 15 },
optionLabel: { color: '#D1C4E9', fontSize: 16, marginBottom: 15, fontWeight: '600' },
optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 5 },
optionText: { color: '#fff', fontSize: 16 },
colorOptionsContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
colorOption: { width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
fontSizeSelector: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8 },
fontSizeButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
fontSizeButtonActive: { backgroundColor: '#7C3AED' },
fontSizeButtonText: { color: '#fff', fontWeight: '600' },
});
export default OptionsModal;