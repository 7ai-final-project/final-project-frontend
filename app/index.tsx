import React, { useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Pressable, Switch, ViewStyle, TextStyle, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useKakaoAuth } from '../hooks/useKakaoAuth';
import { useFonts } from 'expo-font';
import OptionsModal from '../components/OptionsModal';

// 텍스트가 영어인지 확인하는 헬퍼 함수를 만듭니다. 
 const isEnglish = (text: string): boolean => {
// 정규식을 사용하여 문자열에 영어 알파벳이 포함되어 있는지 확인합니다.
 const englishRegex = /[a-zA-Z]/;
 return englishRegex.test(text);
 };

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
  size?: 'medium' | 'large';
}

const MedievalButton: React.FC<MedievalButtonProps> = ({
  children,
  onPress,
  disabled = false,
  size = 'medium',
}) => {
  const [isPressed, setIsPressed] = useState<boolean>(false);
  const scaleAnim = useState(new Animated.Value(1))[0];

  const handlePressIn = (): void => {
    if (!disabled) {
      setIsPressed(true);
      Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
    }
  };
  const handlePressOut = (): void => {
    setIsPressed(false);
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };
  const handlePress = (): void => {
    if (!disabled && onPress) {
      onPress();
    }
  };


  // getButtonSize 함수를 제거하고, 스타일에서 직접 크기를 관리합니다.
  const buttonSizeStyle = size === 'large' ? styles.largeButton : styles.mediumButton;
  const textSizeStyle = size === 'large' ? styles.largeButtonText : styles.mediumButtonText;

  return (
    <Pressable 
      onPress={handlePress} 
      onPressIn={handlePressIn} 
      onPressOut={handlePressOut} 
      disabled={disabled}
    >
      <Animated.View style={[styles.buttonContainer, buttonSizeStyle, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.outerBorder} />
        <View style={styles.innerBorder} />
        <View style={[styles.buttonBody, isPressed && styles.pressed]}>
          <Text style={[styles.buttonText, textSizeStyle]}>{children}</Text>
        </View>
        <View style={[styles.chain, styles.chainTopLeft]}><View style={styles.chainPin} /></View>
        <View style={[styles.chain, styles.chainTopRight]}><View style={styles.chainPin} /></View>
        <View style={[styles.chain, styles.chainBottomLeft]}><View style={styles.chainPin} /></View>
        <View style={[styles.chain, styles.chainBottomRight]}><View style={styles.chainPin} /></View>
      </Animated.View>
    </Pressable>
  );
};

interface TypingTextProps {
  text: string;
  speed?: number; // 타이핑 속도 (ms)
  style?: TextStyle | TextStyle[];  // 텍스트 스타일을 적용하기 위한 prop
}

const TypingText: React.FC<TypingTextProps> = ({ text, speed = 50, style }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    // 컴포넌트가 나타날 때 타이핑을 시작합니다.
    setDisplayedText(''); // 텍스트 초기화
    setIsTyping(true);

    let i = 0;
    const typingInterval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(prev => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(typingInterval);
        setIsTyping(false); // 타이핑이 끝나면 isTyping을 false로 설정
      }
    }, speed);

    // 컴포넌트가 사라질 때 인터벌을 정리합니다 (메모리 누수 방지)
    return () => clearInterval(typingInterval);
  }, [text, speed]); // text나 speed prop이 바뀌면 효과를 다시 시작합니다.

  return (
    // Text 컴포넌트에 전달받은 스타일을 적용합니다.
    <Text style={style}>
      {displayedText}
      {/* 타이핑 중일 때만 깜빡이는 커서를 보여줍니다. */}
      {isTyping && <Text style={{ opacity: 0.5 }}>|</Text>}
    </Text>
  );
};

export default function HomeScreen() {
  // 1. 상태 변수 추가 및 이름 명확화
  const [fontsLoaded, fontError] = useFonts({
    'neodgm': require('../assets/fonts/neodgm.ttf'),
  });

   useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);


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
                  <Text style={styles.loginText}>Logout</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.loginButton} onPress={() => setLoginModalVisible(true)}>
                <Text style={styles.loginText}>Login</Text>
              </TouchableOpacity>
            )}
            {/* 톱니바퀴 모양의 설정 버튼을 추가합니다. */}
            <TouchableOpacity style={styles.settingsButton} onPress={() => setOptionsModalVisible(true)}>
              <Ionicons name="settings-sharp" size={28} color="#E2C044" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.main}>
        {/* user 상태가 'null' 또는 'undefined'일 때 (즉, 로그인하지 않았을 때)만 이 안의 내용을 보여줍니다. */}
          {!user && (
            <> 
              {/* ★★★ 2. 기존 Text를 TypingText 컴포넌트로 교체합니다! ★★★ */}
              <TypingText 
                text=" 전전래동화 기반 TRPG 세계에 오신 것을 환영합니다 " 
                style={[styles.title, { fontSize: 22 * fontSizeMultiplier }]}
                speed={70} // 타이핑 속도를 조절할 수 있습니다 (숫자가 작을수록 빠름)
              />
              {/* <TypingText 
                text="We offer a role-playing game (TRPG) based on Korean old tales. 
                Choose a story with your friends and embark on an adventure!!" 
                style={[styles.description, { fontSize: 32 * fontSizeMultiplier, lineHeight: 24 * fontSizeMultiplier }]}
                speed={30}
              />*/}

              <View style={styles.newsContainer}>
                <Text style={styles.newsTitle}>✨ 로그인하여 모험을 시작하세요!✨ </Text>
                {/*<Text style={[styles.newsText, { fontSize: 14 * fontSizeMultiplier }]}>- '멀티모드'에 신규 시나리오가 추가되었습니다!</Text>*/}
              </View>
            </>
          )}

          {user && (
            <View style={styles.modeContainer}>
              <MedievalButton onPress={() => router.push('/game/story')}>
                스토리 모드
              </MedievalButton>
              <MedievalButton onPress={() => router.push('/game/single')}>
                싱글 모드
              </MedievalButton>
              <MedievalButton onPress={() => router.push('/game/multi')}>
                멀티 모드
              </MedievalButton>
            </View>
          )}
        </View>

      {/* 로그인 모달 */}
       <Modal visible={loginModalVisible} animationType="fade" transparent={true} onRequestClose={() => setLoginModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <TouchableOpacity style={styles.closeIcon} onPress={() => setLoginModalVisible(false)}>
                <Ionicons name="close" size={24} color="#aaa" />
              </TouchableOpacity>
              
              <Text style={styles.modalTitle}>로그인</Text>
              
              {/* Google 로그인 버튼 */}
              <TouchableOpacity
                style={styles.socialLoginButton}
                onPress={() => googlePromptAsync()}
              >
                {/* 아이콘을 담을 View */}
                <View style={styles.socialIconContainer}>
                  <Ionicons name="logo-google" size={24} color="#fff" />
                </View>
                {/* 텍스트 */}
                <Text style={styles.socialButtonText}>Google로 로그인</Text>
              </TouchableOpacity>
              
              {/* Kakao 로그인 버튼 */}
              <TouchableOpacity
                style={[styles.socialLoginButton, styles.kakaoButton]}
                onPress={() => kakaoPromptAsync()}
              >
                {/* 아이콘을 담을 View */}
                <View style={[styles.socialIconContainer, styles.kakaoIconContainer]}>
                  {/* 카카오 로고는 아이콘 폰트에 없으므로, 텍스트로 'K'를 표현합니다. */}
                  <Text style={styles.kakaoIcon}>K</Text>
                </View>
                {/* 텍스트 */}
                <Text style={[styles.socialButtonText, styles.kakaoButtonText]}>Kakao로 로그인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>


      {/* 4. 옵션 모달 UI 구현 */}
      <OptionsModal
          visible={optionsModalVisible}
          onClose={() => setOptionsModalVisible(false)}
          isBgmOn={isBgmOn}
          setIsBgmOn={setIsBgmOn}
          isSfxOn={isSfxOn}
          setIsSfxOn={setIsSfxOn}
          fontSizeMultiplier={fontSizeMultiplier}
          setFontSizeMultiplier={setFontSizeMultiplier}
          backgroundColor={backgroundColor}
          setBackgroundColor={setBackgroundColor}
        />
      </View>
    </ImageBackground> 
  );
}

const styles = StyleSheet.create({
  // --- 기본 레이아웃 ---
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  container: { flex: 1, paddingTop: 40 },
  main: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', fontSize: 18 , fontFamily: 'neodgm'},
  vt323Font: {fontFamily: 'VT323'},

header: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 10, 
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
  logo: { fontSize: 20, fontWeight: 'bold', color: '#E2C044', fontFamily: 'neodgm' },
  loginButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 8,
  },
  loginText: { color: '#fff', fontWeight: '600' , fontFamily: 'neodgm' },
  loggedInBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loggedInText: { 
    color: '#fff', 
    fontSize: 16, 
    fontFamily: 'neodgm',
    fontWeight: '600',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#DC2626',
    borderRadius: 8,
  },

  // --- 메인 콘텐츠 (환영 메시지 & 소식 창) ---
  title: { fontSize: 22, fontWeight: 'bold', color: '#F4E1D2', textAlign: 'center', marginBottom: 20 , fontFamily: 'neodgm',},
  description: { fontSize: 16, fontFamily: 'neodgm', color: '#D1C4E9', textAlign: 'center', lineHeight: 24 },
  newsContainer: { width: '30%', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: 15, borderRadius: 10, marginTop: 30, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  newsTitle: { color: '#E2C044', fontWeight: 'bold', fontSize: 16, fontFamily: 'neodgm', textAlign: 'center', marginBottom: 5 },
  newsText: { color: '#D1C4E9' , fontFamily: 'neodgm', textAlign: 'center' },
  modeContainer: { flexDirection: 'column', marginTop: 30, gap: 20, alignItems: 'center' },

  // ★★★ 여기가 추가된 부분입니다! (중세 버튼 전체) ★★★
  // --- 중세 버튼 스타일 ---
  buttonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
  },
  mediumButton: { width: 280, height: 70 },
  largeButton: { width: 320, height: 80 },
  outerBorder: {
    position: 'absolute',
    width: '100%', height: '100%',
    backgroundColor: '#4a2c1a', // 아주 어두운 나무색
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#2a180e',
  },  
 innerBorder: {
    position: 'absolute',
    width: '95%', height: '90%',
    backgroundColor: '#8B4513', // 중간 나무색
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#c88a5a', // 밝은 하이라이트
  },
  buttonBody: {
    width: '90%', height: '80%',
    backgroundColor: '#6a381a', // 안쪽 어두운 판
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    // 그림자 효과
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 5,
  },
  pressed: {
    backgroundColor: '#4a2c1a', // 눌렸을 때 더 어두워짐
  },
  buttonText: {
    color: '#f0e6d2', // 밝은 양피지 색
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  mediumButtonText: { fontSize: 20,  fontFamily: 'neodgm', },
  largeButtonText: { fontSize: 24,  fontFamily: 'neodgm', },
  
  // 체인 장식 스타일
  chain: {
    position: 'absolute',
    width: 8,
    height: 16,
    backgroundColor: '#4a2c1a',
    borderWidth: 1,
    borderColor: '#2a180e',
  },
  chainTopLeft: { top: -8, left: 30, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  chainTopRight: { top: -8, right: 30, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  chainBottomLeft: { bottom: -8, left: 30, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  chainBottomRight: { bottom: -8, right: 30, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  chainPin: {
    position: 'absolute',
    top: -4, left: 0, right: 0,
    height: 8,
    backgroundColor: '#c88a5a',
    borderRadius: 4,
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

  // --- 모달 공통 ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '85%', maxWidth: 400, backgroundColor: '#2a2d47', borderRadius: 16, padding: 24, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, position: 'relative' },
  modalTitle: { fontSize: 20,  fontFamily: 'neodgm', fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  closeIcon: { position: 'absolute', top: 12, right: 12, padding: 6 },

  // --- 로그인 모달 (아이콘 포함) ---
  loginModalBox: { width: '85%', maxWidth: 400, backgroundColor: '#2a2d47', borderRadius: 16, padding: 24, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, position: 'relative' },
  socialLoginButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4285f4', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12, marginBottom: 16, width: '100%', elevation: 2 },
  kakaoButton: { backgroundColor: '#fee500' },
  socialIconContainer: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  kakaoIconContainer: { backgroundColor: 'transparent' },
  kakaoIcon: { fontSize: 20, fontFamily: 'neodgm', fontWeight: 'bold', color: '#3c1e1e' },
  socialButtonText: { fontSize: 16,  fontFamily: 'neodgm', fontWeight: '600', color: '#fff', flex: 1, textAlign: 'center' },
  kakaoButtonText: { color: '#3c1e1e' },

    // --- 배경 효과 ---
  starContainer: { position: 'absolute', width: '100%', height: '100%', zIndex: 0 },
  star: { position: 'absolute', width: 2, height: 2, backgroundColor: 'white', borderRadius: 1 },
});