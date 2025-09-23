import React, { useState, useEffect, useRef, useMemo, ReactNode, useCallback } from 'react';
import { useWindowDimensions, View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Pressable, ImageBackground, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useKakaoAuth } from '../hooks/useKakaoAuth';
import { useMicrosoftAuth } from '../hooks/useMicrosoftAuth';
import { useFonts } from 'expo-font';
import ProfileModal from '../components/ProfileModal';
import OptionsModal from '../components/OptionsModal';
import NicknameInputModal from '../components/main/NicknameInputModal';
import { useSettings } from '../components/context/SettingsContext';
import { updateUserNickname } from '../services/api';
import { Audio } from 'expo-av'

interface MedievalButtonProps {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  size?: 'medium' | 'large';
  isMobile?: boolean; 
}

interface TypingTextProps {
  text: string;
  speed?: number;
  style?: any;
}

const StarryBackground = () => {
  const stars = useRef([...Array(30)].map(() => ({
    anim: new Animated.Value(0),
    style: {
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
    } as any,
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
          style={[styles.star, star.style, { opacity: star.anim }]}
        />
      ))}
    </View>
  );
};

function MedievalButton({
  children,
  onPress,
  disabled = false,
  size = 'medium',
  isMobile = false,
}: MedievalButtonProps) {
  const [isPressed, setIsPressed] = useState<boolean>(false);
  const scaleAnim = useState(new Animated.Value(1))[0];
  
  const buttonSizeStyle = isMobile  ? styles.mobileMediumButton : (size === 'large' ? styles.largeButton : styles.mediumButton);
  const textSizeStyle = isMobile ? styles.mobileMediumButtonText : (size === 'large' ? styles.largeButtonText : styles.mediumButtonText);
  
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
}

function TypingText({ text, speed = 50, style }: TypingTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    setDisplayedText(''); 
    setIsTyping(true);

    let i = 0;
    const typingInterval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(prev => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(typingInterval);
        setIsTyping(false); 
      }
    }, speed);

    return () => clearInterval(typingInterval);
  }, [text, speed]); 

  return (
    <Text style={style}>
      {displayedText}
      {isTyping && <Text style={{ opacity: 0.5 }}>|</Text>}
    </Text>
  );
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [fontsLoaded, fontError] = useFonts({'neodgm': require('../assets/fonts/neodgm.ttf'),});
  const soundRef = useRef<Audio.Sound | null>(null);
  
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false); 
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [nicknameInputModalVisible, setNicknameInputModalVisible] = useState(false);

  
  const { 
    isBgmOn, 
    setIsBgmOn, 
    isSfxOn, 
    setIsSfxOn, 
    isLoading: isSettingsLoading, 
    fontSizeMultiplier, 
    setFontSizeMultiplier 
  } = useSettings();
  
  const { user, setUser, loading, handleLogout } = useAuth();
  const [tempLoginUser, setTempLoginUser] = useState<any>(null);

  const handleNicknameUpdate = async (newNickname: string) => {
    if (!user) return;

    try {
      // 기존의 api.put(...)을 새로 만든 함수로 대체합니다.
      await updateUserNickname(newNickname);

      // API 호출이 성공하면 화면의 상태를 업데이트합니다.
      setUser({ ...user, nickname: newNickname });

    } catch (error) {
      console.error("닉네임 변경 실패:", error);
      Alert.alert("오류", "닉네임 변경 중 오류가 발생했습니다.");
    }
  };
  
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

  useFocusEffect(
    useCallback(() => {
      const manageMusic = async () => {
        // 🛑 BGM 설정이 꺼져있으면 음악을 멈춥니다.
        if (loading || !isBgmOn) {
          if (soundRef.current) {
            await soundRef.current.stopAsync();
          }
          return;
        }
  
        // ✅ BGM 설정이 켜져있으면 음악을 재생합니다.
        try {
          if (soundRef.current === null) {
            await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
            const { sound } = await Audio.Sound.createAsync(
              require('../assets/sounds/home_music.mp3'),
              { isLooping: true }
            );
            soundRef.current = sound;
          }
          await soundRef.current.playAsync();
        } catch (error) {
          console.error("음악 관리 중 오류:", error);
        }
      };
  
      manageMusic();
  
      return () => {
        if (soundRef.current) {
          soundRef.current.stopAsync();
        }
      };
    }, [loading, isBgmOn]) // ❗ 여기가 핵심입니다!
  );
  
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);
  
  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);
  
  const handleTermsPress = () => {
      setLoginModalVisible(false);
      router.push('/legal/terms');
  };

  const selectedBackgroundImage = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * backgroundImages.length);
    return backgroundImages[randomIndex];
  }, []);

  const handleNicknameSaved = async (newNickname: string) => {
    if(tempLoginUser) {
      const updatedUser = { ...tempLoginUser, nickname: newNickname };
      setUser(updatedUser); 
      setNicknameInputModalVisible(false); 
      setLoginModalVisible(false);  
      setTempLoginUser(null);       
    }
  };

  const handleSocialLoginSuccess = (loginUser: any) => {
    setLoginModalVisible(false); 

    if(!loginUser.nickname) {
      setTempLoginUser(loginUser);
      setNicknameInputModalVisible(true);
    } else {
      setUser(loginUser); 
    }
  };

  const handleNicknameInputModalClose = async (saved: boolean) => {
    setNicknameInputModalVisible(false); 

    if(!saved && tempLoginUser) {
      console.log('닉네임 입력 취소 또는 실패, 토큰 제거를 시도합니다.');
      await handleLogout();
      setTempLoginUser(null);       
      setLoginModalVisible(false);  
    }
  };

  const { microsoftPromptAsync } = useMicrosoftAuth(handleSocialLoginSuccess);
  const { googlePromptAsync } = useGoogleAuth(handleSocialLoginSuccess);
  const { kakaoPromptAsync } = useKakaoAuth(handleSocialLoginSuccess);

  if(loading || isSettingsLoading) {
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
        
        <View style={isMobile ? styles.headerMobile : styles.header}>
          <Text style={isMobile ? styles.logoMobile : styles.logo}>Story TRPG</Text>
          
          <View style={isMobile ? styles.headerRightMobile : styles.headerRight}>
            {user && user.nickname ? (
              <View style={isMobile ? styles.loggedInBoxMobile : styles.loggedInBox}>
                <Text style={[isMobile ? styles.loggedInTextMobile : styles.loggedInText, { fontSize: (isMobile ? 14 : 16) * fontSizeMultiplier }]}>{user.nickname}님</Text>
                <TouchableOpacity style={isMobile ? styles.profileButtonMobile : styles.profileButton} onPress={() => setProfileModalVisible(true)}>
                  <Ionicons name="person-circle-outline" size={isMobile ? 28 : 32} color="#F4E4BC" />
                </TouchableOpacity>

                <TouchableOpacity style={isMobile ? styles.logoutButtonMobile : styles.logoutButton} onPress={handleLogout}>
                  <Text style={isMobile ? styles.loginTextMobile : styles.loginText}>Logout</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={isMobile ? styles.loginButtonMobile : styles.loginButton} onPress={() => setLoginModalVisible(true)}>
                <Text style={isMobile ? styles.loginTextMobile : styles.loginText}>Login</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={isMobile ? styles.settingsButtonMobile : styles.settingsButton} onPress={() => setOptionsModalVisible(true)}>
              <Ionicons name="settings-sharp" size={isMobile ? 24 : 28} color="#E2C044" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={isMobile ? styles.mainMobile : styles.main}>
          {!user || !user.nickname ? (
            <> 
              <TypingText 
                text="전전래동화 기반 TRPG 세계에 오신 것을 환영합니다" 
                style={[isMobile ? styles.titleMobile : styles.title, { fontSize: (isMobile ? 18 : 22) * fontSizeMultiplier }]}
                speed={70} 
              />

              <View style={isMobile ? styles.newsContainerMobile : styles.newsContainer}>
                <Text style={isMobile ? styles.newsTitleMobile : styles.newsTitle}>✨ 로그인하여 모험을 시작하세요!✨ </Text>
              </View>
            </>
          ) : (
            <View style={isMobile ? styles.modeContainerMobile : styles.modeContainer}>
              <MedievalButton isMobile={isMobile} onPress={() => router.push('/storymode')}>
                스토리 모드
              </MedievalButton>
              <MedievalButton isMobile={isMobile} onPress={() => router.push('/game/single')}>
                싱글 모드
              </MedievalButton>
              <MedievalButton isMobile={isMobile} onPress={() => router.push('/game/multi')}>
                멀티 모드
              </MedievalButton>
            </View>
          )}
        </View>

       <Modal visible={loginModalVisible} animationType="fade" transparent={true} onRequestClose={() => setLoginModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={isMobile ? styles.modalBoxMobile : styles.modalBox}>
              <TouchableOpacity style={styles.closeIcon} onPress={() => setLoginModalVisible(false)}>
                <Ionicons name="close" size={24} color="#aaa" />
              </TouchableOpacity>
              
              <Text style={isMobile ? styles.modalTitleMobile : styles.modalTitle}>로그인</Text>

              <TouchableOpacity
                style={[isMobile ? styles.socialLoginButtonMobile : styles.socialLoginButton, styles.socialLoginButton]}
                onPress={() => microsoftPromptAsync()}
              >
                <View style={styles.socialIconContainer}>
                  <Ionicons name="logo-microsoft" size={24} color="#fff" />
                </View>
                <Text style={[isMobile ? styles.socialButtonTextMobile : styles.socialButtonText, styles.socialButtonText]}>Microsoft로 로그인</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[isMobile ? styles.socialLoginButtonMobile : styles.socialLoginButton, styles.googleButton]}
                onPress={() => googlePromptAsync()}
              >
                <View style={styles.socialIconContainer}>
                  <Ionicons name="logo-google" size={24} color="#333" />
                </View>
                <Text style={[isMobile ? styles.socialButtonTextMobile : styles.socialButtonText, styles.googleButtonText]}>Google로 로그인</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[isMobile ? styles.socialLoginButtonMobile : styles.socialLoginButton, styles.kakaoButton]}
                onPress={() => kakaoPromptAsync()}
              >
                <View style={[styles.socialIconContainer, styles.kakaoIconContainer]}>
                  <Text style={styles.kakaoIcon}>K</Text>
                </View>
                <Text style={[isMobile ? styles.socialButtonTextMobile : styles.socialButtonText, styles.kakaoButtonText]}>Kakao로 로그인</Text>
              </TouchableOpacity>
              <View style={isMobile ? styles.termsContainerMobile : styles.termsContainer}>
                <Text style={isMobile ? styles.termsTextMobile : styles.termsText}>로그인은 </Text>
                <TouchableOpacity onPress={handleTermsPress}>
                  <Text style={[isMobile ? styles.termsTextMobile : styles.termsText, styles.termsLink]}>이용약관</Text>
                </TouchableOpacity>
                <Text style={isMobile ? styles.termsTextMobile : styles.termsText}>에 동의하는 것으로 간주됩니다.</Text>
              </View>
            </View>
          </View>
        </Modal>

      <ProfileModal
          visible={profileModalVisible}
          onClose={() => setProfileModalVisible(false)}
          user={user}
          onUpdateNickname={handleNicknameUpdate}
        />

      <OptionsModal
        visible={optionsModalVisible}
        onClose={() => setOptionsModalVisible(false)}
        isBgmOn={isBgmOn}
        setIsBgmOn={setIsBgmOn}
        isSfxOn={isSfxOn}
        setIsSfxOn={setIsSfxOn}
        fontSizeMultiplier={fontSizeMultiplier}
        setFontSizeMultiplier={setFontSizeMultiplier}
      />

      <NicknameInputModal
        visible={nicknameInputModalVisible}
        onClose={handleNicknameInputModalClose}
        onSave={handleNicknameSaved}
        initialNickname={tempLoginUser?.nickname || ''}
      />
      </View>
    </ImageBackground> 
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  container: { flex: 1, paddingTop: 40 },
  main: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  mainMobile: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', fontSize: 18 , fontFamily: 'neodgm'},
  header: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 10, 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  headerMobile: {
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 8, 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  headerRightMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsButton: {
    padding: 5,
  },
  settingsButtonMobile: {
    padding: 3,
  },
  logo: { fontSize: 20, fontWeight: 'bold', color: '#E2C044', fontFamily: 'neodgm' },
  logoMobile: { fontSize: 18, fontWeight: 'bold', color: '#E2C044', fontFamily: 'neodgm' },
  loginButton: {
    paddingHorizontal: 16,
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    height: 40,                 
    justifyContent: 'center',   
    alignItems: 'center',       
    alignSelf: 'flex-start',   
  },
  loginButtonMobile: {
    paddingHorizontal: 12,
    backgroundColor: '#7C3AED',
    borderRadius: 6,
    height: 36,                
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  loginText: { 
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'neodgm',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginTextMobile: { color: '#fff', fontWeight: '600' , fontFamily: 'neodgm', fontSize: 14 },
  loggedInBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loggedInBoxMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  profileButton: {
    padding: 5,
  },
  profileButtonMobile: {
    padding: 3,
  },
  loggedInText: { 
    color: '#fff', 
    fontSize: 16, 
    fontFamily: 'neodgm',
    fontWeight: '600',
  },
  loggedInTextMobile: { 
    color: '#fff', 
    fontSize: 14, 
    fontFamily: 'neodgm',
    fontWeight: '600',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#DC2626',
    borderRadius: 8,
  },
  logoutButtonMobile: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#DC2626',
    borderRadius: 6,
  },
  profileInfoContainer: {
    width: '100%',
    paddingVertical: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  profileLabel: {
    color: '#D1C4E9',
    fontSize: 18,
    fontFamily: 'neodgm',
    marginBottom: 4,
  },
  profileValue: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'neodgm',
    fontWeight: '600',
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#F4E1D2', textAlign: 'center', marginBottom: 20 , fontFamily: 'neodgm',},
  titleMobile: { fontSize: 18, fontWeight: 'bold', color: '#F4E1D2', textAlign: 'center', marginBottom: 15 , fontFamily: 'neodgm',},
  newsContainer: { width: '30%', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: 15, borderRadius: 10, marginTop: 30, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  newsContainerMobile: { width: '90%', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: 10, borderRadius: 8, marginTop: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  newsTitle: { color: '#E2C044', fontWeight: 'bold', fontSize: 16, fontFamily: 'neodgm', textAlign: 'center', marginBottom: 5 },
  newsTitleMobile: { color: '#E2C044', fontWeight: 'bold', fontSize: 14, fontFamily: 'neodgm', textAlign: 'center', marginBottom: 5 },
  modeContainer: { flexDirection: 'column', marginTop: 30, gap: 20, alignItems: 'center' },
  modeContainerMobile: { flexDirection: 'column', marginTop: 20, gap: 15, alignItems: 'center' },
  buttonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
  },
  mediumButton: { width: 280, height: 70 },
  largeButton: { width: 320, height: 80 },
  mobileMediumButton: { width: 220, height: 60 },
  outerBorder: {
    position: 'absolute',
    width: '100%', height: '100%',
    backgroundColor: '#4a2c1a', 
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#2a180e',
  },  
  innerBorder: {
    position: 'absolute',
    width: '95%', height: '90%',
    backgroundColor: '#8B4513', 
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#c88a5a', 
  },
  buttonBody: {
    width: '90%', height: '80%',
    backgroundColor: '#6a381a', 
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 5,
  },
  pressed: {
    backgroundColor: '#4a2c1a', 
  },
  buttonText: {
    color: '#f0e6d2', 
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  mediumButtonText: { fontSize: 20,  fontFamily: 'neodgm', },
  largeButtonText: { fontSize: 24,  fontFamily: 'neodgm', },
  mobileMediumButtonText: { fontSize: 18, fontFamily: 'neodgm', },
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
    borderRadius: 16, padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    position: 'relative'
  },
  modalBoxMobile: {
     width: '95%',
     maxWidth: 350,
     backgroundColor: '#2a2d47',
     borderRadius: 12,
     padding: 20,
     alignItems: 'center',
     elevation: 10,
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.25,
     shadowRadius: 3.84,
     position: 'relative'
  },
  modalTitle: { fontSize: 20,  fontFamily: 'neodgm', fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  modalTitleMobile: { fontSize: 18,  fontFamily: 'neodgm', fontWeight: 'bold', color: '#fff', marginBottom: 15 },
  closeIcon: { position: 'absolute', top: 12, right: 12, padding: 6 },
  socialLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285f4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
    width: '100%',
    height: 48,
    elevation: 2,
  },
  socialLoginButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285f4',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 10,
    width: '100%',
    height: 44,
    elevation: 2,
  },
  googleButton: {
    backgroundColor: '#fff',
  },
  googleButtonText: {
    color: '#333',
  },
  kakaoButton: {
    backgroundColor: '#fee500',
  },
  socialIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  kakaoIconContainer: { backgroundColor: 'transparent' },
  kakaoIcon: {
    fontSize: 24,
    fontFamily: 'neodgm',
    fontWeight: 'bold',
    color: '#3c1e1e',
  },
  socialButtonText: {
    fontSize: 15,
    fontFamily: 'neodgm',
    fontWeight: '600',
    color: '#fff',
  },
  socialButtonTextMobile: {
    fontSize: 13,
    fontFamily: 'neodgm',
    fontWeight: '600',
    color: '#fff',
  },
  kakaoButtonText: {
    color: '#3c1e1e',
  },
  termsContainer: {
    flexDirection: 'row', 
    marginTop: 20,
    flexWrap: 'wrap', 
    justifyContent: 'center',
  },
  termsContainerMobile: {
    flexDirection: 'row', 
    marginTop: 15,
    flexWrap: 'wrap', 
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  termsText: {
    color: '#aaa',
    fontSize: 14, 
    fontFamily: 'neodgm',
  },
  termsTextMobile: {
    color: '#aaa',
    fontSize: 12, 
    fontFamily: 'neodgm',
  },
  termsLink: {
    color: '#61dafb', 
    textDecorationLine: 'underline', 
  },
  starContainer: { position: 'absolute', width: '100%', height: '100%', zIndex: 0 },
  star: { position: 'absolute', width: 2, height: 2, backgroundColor: 'white', borderRadius: 1 },
});