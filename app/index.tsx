import React, { useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Pressable, Switch, ViewStyle, TextStyle, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useKakaoAuth } from '../hooks/useKakaoAuth';


const StarryBackground = () => {
  const stars = useRef([...Array(30)].map(() => ({
    anim: new Animated.Value(0),
    style: {
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
    } as ViewStyle,
  }))).current;

  useEffect(() => {
    const animations = stars.map(star => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(star.anim, {
            toValue: 1,
            duration: Math.random() * 2000 + 1500,
            useNativeDriver: true,
          }),
          Animated.timing(star.anim, {
            toValue: 0,
            duration: Math.random() * 2000 + 1500,
            useNativeDriver: true,
          }),
        ])
      );
    });
    Animated.parallel(animations).start();
  }, []);

  return (
    <View style={styles.starContainer}>
      {stars.map((star, index) => (
        <Animated.View
          key={index}
          style={[
            styles.star,
            star.style,
            {
              opacity: star.anim,
            },
          ]}
        />
      ))}
    </View>
  );
};

interface MedievalButtonProps {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'small' | 'medium' | 'large';
}

const MedievalButton: React.FC<MedievalButtonProps> = ({
  children,
  onPress,
  disabled = false,
  style = {},
  textStyle = {},
  size = 'medium',
}) => {
  const [isPressed, setIsPressed] = useState<boolean>(false);
  const scaleAnim = useState(new Animated.Value(1))[0];

  const handlePressIn = (): void => {
    if (!disabled) {
      setIsPressed(true);
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = (): void => {
    setIsPressed(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = (): void => {
    if (!disabled && onPress) {
      onPress();
    }
  };

  const getButtonSize = () => {
    switch (size) {
      case 'small':
        return {
          width: 200,
          height: 50,
          fontSize: 14,
        };
      case 'large':
        return {
          width: 300,
          height: 80,
          fontSize: 20,
        };
      default:
        return {
          width: 250,
          height: 65,
          fontSize: 16,
        };
    }
  };

  const buttonSize = getButtonSize();

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.8}
        style={[
          styles.container,
          {
            width: buttonSize.width,
            height: buttonSize.height,
          },
          disabled && styles.disabled,
          style,
        ]}
      >
        {/* 외부 테두리 */}
        <View style={[styles.outerBorder, { width: buttonSize.width + 16, height: buttonSize.height + 16 }]} />
        
        {/* 내부 테두리 */}
        <View style={[styles.innerBorder, { width: buttonSize.width + 8, height: buttonSize.height + 8 }]} />
        
        {/* 체인 장식 */}
        <View style={[styles.chainLeft, { top: -25 }]}>
          <View style={styles.chainRing} />
        </View>
        <View style={[styles.chainRight, { top: -25 }]}>
          <View style={styles.chainRing} />
        </View>
        
        {/* 메인 버튼 영역 */}
        <View style={[
          styles.buttonBody,
          {
            width: buttonSize.width,
            height: buttonSize.height,
          },
          isPressed && styles.pressed,
          disabled && styles.disabledBody,
        ]}>
          <Text style={[
            styles.buttonText,
            {
              fontSize: buttonSize.fontSize,
            },
            disabled && styles.disabledText,
            textStyle,
          ]}>
            {children}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function HomeScreen() {
  // 1. 상태 변수 추가 및 이름 명확화
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false); // 옵션 모달 상태
  const [backgroundColor, setBackgroundColor] = useState('#0B1021'); // 배경색 상태

  const [isBgmOn, setIsBgmOn] = useState(true);
  const [isSfxOn, setIsSfxOn] = useState(true);
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState(1); // 0.9: 작게, 1: 보통, 1.1: 크게

  const { user, setUser, loading, handleLogout } = useAuth();

  const backgroundImages = [
    require('../assets/images/main/background_image1.jpg'), 
    require('../assets/images/main/background_image2.jpg'), 
    require('../assets/images/main/background_image3.jpg'), 
    require('../assets/images/main/background_image4.jpg'), 
    require('../assets/images/main/background_image5.jpg'), 
    require('../assets/images/main/background_image6.jpg'), 
    require('../assets/images/main/background_image7.jpg'), 
    require('../assets/images/main/background_image8.jpg'), 
  ];

  const selectedBackgroundImage = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * backgroundImages.length);
    return backgroundImages[randomIndex];
  }, []);
  const handleSocialLoginSuccess = (loginUser: any) => {
    setUser(loginUser);
    setLoginModalVisible(false); // 로그인 모달창 닫기
  };

  const { googlePromptAsync } = useGoogleAuth(handleSocialLoginSuccess);
  const { kakaoPromptAsync } = useKakaoAuth(handleSocialLoginSuccess);

  if (loading) {
   return (
    <ImageBackground 
      source={selectedBackgroundImage}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
   <View style={[styles.container, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>로그인 상태 확인 중...</Text>
          </View>
        </View>
      </ImageBackground>
    );
  }


return (
<ImageBackground 
    source={selectedBackgroundImage}
    style={styles.backgroundImage}
    resizeMode="cover"
  >
 <View style={styles.container}>
        <StarryBackground />
        
        <View style={styles.header}>
          <Text style={styles.logo}>Story TRPG</Text>
          
          {/* ★★★ 3. 로그인/설정 버튼 영역을 새로 구성합니다. ★★★ */}
          <View style={styles.headerRight}>
            {user ? (
              <View style={styles.loggedInBox}>
                <Text style={[styles.loggedInText, { fontSize: 16 * fontSizeMultiplier }]}>{user.name}님</Text>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                  <Text style={styles.loginText}>로그아웃</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.loginButton} onPress={() => setLoginModalVisible(true)}>
                <Text style={styles.loginText}>로그인</Text>
              </TouchableOpacity>
            )}
            {/* 톱니바퀴 모양의 설정 버튼을 추가합니다. */}
            <TouchableOpacity style={styles.settingsButton} onPress={() => setOptionsModalVisible(true)}>
              <Ionicons name="settings-sharp" size={28} color="#E2C044" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.main}>
          {/* ★★★ 1 & 2. 환영 메시지와 소식 창을 삭제했습니다. ★★★ */}
          
          <View style={styles.modeContainer}>
            <MedievalButton onPress={() => router.push('/image_gen')}>
              이미지 생성
            </MedievalButton>
            <MedievalButton onPress={() => router.push('/game/story')}>
              스토리 모드
            </MedievalButton>
          </View>

          {user && (
            <View style={styles.modeContainer}>
              <MedievalButton onPress={() => router.push('/game/single')}>
                싱글 모드
              </MedievalButton>
              {/* 옵션 버튼은 헤더로 이동했으므로 여기서 삭제합니다. */}
            </View>
          )}

          {user && (
            <View style={styles.modeContainer}>
              <MedievalButton onPress={() => router.push('/game/multi')}>
                멀티 모드
              </MedievalButton>
              {/* 옵션 버튼은 헤더로 이동했으므로 여기서 삭제합니다. */}
            </View>
          )}
        </View>

      {/* 로그인 모달 */}
      <Modal visible={loginModalVisible} animationType="none" transparent={true} onRequestClose={() => setLoginModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <TouchableOpacity style={styles.closeIcon} onPress={() => setLoginModalVisible(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>로그인</Text>
            <TouchableOpacity style={[styles.socialButton, { backgroundColor: '#1877F2' }]} onPress={() => googlePromptAsync()}>
              <Text style={styles.socialText}>구글로 로그인</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.socialButton, { backgroundColor: '#FEE500' }]} onPress={() => kakaoPromptAsync()}>
              <Text style={[styles.socialText, { color: '#000' }]}>카카오로 로그인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 4. 옵션 모달 UI 구현 */}
      <Modal visible={optionsModalVisible} animationType="fade" transparent={true} onRequestClose={() => setOptionsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <TouchableOpacity style={styles.closeIcon} onPress={() => setOptionsModalVisible(false)}>
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
    </View>
  </ImageBackground> 
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: { 
    flex: 1,
  },
header: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 10, // 패딩 약간 조절
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  // ★★★ 3. 헤더 오른쪽 영역과 설정 버튼 스타일을 추가합니다. ★★★
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  settingsButton: {
    padding: 5,
  },
  main: { 
    flex: 1, 
    justifyContent: 'center', // 환영 메시지가 사라졌으므로, 버튼들을 중앙에 위치시킵니다.
    alignItems: 'center', 
    paddingHorizontal: 30 
  },
  logo: { fontSize: 20, fontWeight: 'bold', color: '#E2C044' },
  loginButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 8,
  },
  loginText: { color: '#fff', fontWeight: '600' },
  loggedInBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loggedInText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#DC2626',
    borderRadius: 8,
  },
    modeContainer: {
    flexDirection: 'column',
    marginTop: 30,
    gap: 20,
    alignItems: 'center',
  },
  modeButton: {
    width: 200,
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 10,
    backgroundColor: '#E2C044',
  },
  modeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0B1021',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '80%',
    backgroundColor: '#2B355E',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  socialButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  socialText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  closeIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
  },
  starContainer: { position: 'absolute', width: '100%', height: '100%', zIndex: 0 },
  star: { position: 'absolute', width: 2, height: 2, backgroundColor: 'white', borderRadius: 1, },
  newsContainer: { width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: 15, borderRadius: 10, marginTop: 30, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  newsTitle: { color: '#E2C044', fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
  newsText: { color: '#D1C4E9' },
  optionSection: { width: '100%', marginBottom: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 15, },
  optionLabel: { color: '#D1C4E9', fontSize: 16, marginBottom: 15, fontWeight: '600' },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 5 },
  optionText: { color: '#fff', fontSize: 16 },
  colorOptionsContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  colorOption: { width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
  fontSizeSelector: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8 },
  fontSizeButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  fontSizeButtonActive: { backgroundColor: '#7C3AED' },
  fontSizeButtonText: { color: '#fff', fontWeight: '600' },

 medievalButtonWrapper: {
    minWidth: 240,
    height: 60,
    marginVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    // 그림자는 iOS에서만 작동합니다.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    // Android에서는 elevation으로 비슷한 효과를 냅니다.
    elevation: 8,
  },
  medievalButtonFrame: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#654321', // 어두운 나무색
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#2F1B14', // 더 어두운 테두리
  },
  medievalButtonCore: {
    position: 'absolute',
    top: 4, left: 4, right: 4, bottom: 4,
    backgroundColor: '#8B4513', // 중간 나무색
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CD853F', // 밝은 테두리 하이라이트
    justifyContent: 'center',
    alignItems: 'center',
  },
  medievalButtonText: {
    color: '#F4E4BC', // 밝은 양피지 색
    fontSize: 18,
    fontWeight: '600',
  },

  outerBorder: {
    position: 'absolute',
    backgroundColor: '#654321',
    borderRadius: 12,
    top: -8,
    left: -8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#2F1B14',
  },
  
  innerBorder: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderRadius: 8,
    top: -4,
    left: -4,
    borderWidth: 2,
    borderColor: '#2F1B14',
    shadowColor: '#CD853F',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.8,
    shadowRadius: 0,
    elevation: 2,
  },
  
  chainLeft: {
    position: 'absolute',
    left: 15,
    width: 8,
    height: 20,
    backgroundColor: '#8B4513',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2F1B14',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  
  chainRight: {
    position: 'absolute',
    right: 15,
    width: 8,
    height: 20,
    backgroundColor: '#8B4513',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2F1B14',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  
  chainRing: {
    position: 'absolute',
    top: -8,
    left: -2,
    width: 12,
    height: 8,
    backgroundColor: '#CD853F',
    borderRadius: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderColor: '#2F1B14',
  },
  
  buttonBody: {
    backgroundColor: '#8B4513',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2F1B14',
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
    // 나무 질감을 위한 그라데이션 효과 (React Native에서는 LinearGradient 컴포넌트 사용 권장)
    borderWidth: 1,
    borderColor: '#654321',
  },
  
  pressed: {
    backgroundColor: '#654321',
    shadowOffset: {
      width: 1,
      height: 1,
    },
    elevation: 2,
  },
  
  buttonText: {
    color: '#F4E4BC',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: '#2F1B14',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
    // React Native에서는 다중 텍스트 그림자가 제한적이므로 단일 그림자 사용
  },
  
  disabled: {
    opacity: 0.6,
  },
  
  disabledBody: {
    backgroundColor: '#696969',
  },
  
  disabledText: {
    color: '#A0A0A0',
  },
});