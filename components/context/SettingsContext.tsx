import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 설정의 타입 정의
interface Settings {
  isBgmOn: boolean;
  isSfxOn: boolean;
  fontSizeMultiplier: number;
}

// 컨텍스트가 제공할 값들의 타입 정의 (상태 + 상태 변경 함수)
interface SettingsContextType extends Settings {
  setIsBgmOn: (value: boolean) => void;
  setIsSfxOn: (value: boolean) => void;
  setFontSizeMultiplier: (value: number) => void;
  isLoading: boolean;
}

// 기본값으로 컨텍스트 생성
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// 앱을 감싸줄 Provider 컴포넌트
export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>({
    isBgmOn: true,
    isSfxOn: true,
    fontSizeMultiplier: 1,
  });

  // 앱 시작 시 AsyncStorage에서 저장된 설정 불러오기
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await AsyncStorage.getItem('appSettings');
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        }
      } catch (e) {
        console.error("Failed to load settings.", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  // 설정이 변경될 때마다 AsyncStorage에 저장하기
  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem('appSettings', JSON.stringify(settings));
    }
  }, [settings, isLoading]);
  
  // 각 상태를 업데이트하는 함수들
  const setIsBgmOn = (value: boolean) => setSettings(s => ({ ...s, isBgmOn: value }));
  const setIsSfxOn = (value: boolean) => setSettings(s => ({ ...s, isSfxOn: value }));
  const setFontSizeMultiplier = (value: number) => setSettings(s => ({ ...s, fontSizeMultiplier: value }));

  const value = {
    ...settings,
    setIsBgmOn,
    setIsSfxOn,
    setFontSizeMultiplier,
    isLoading,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

// 다른 컴포넌트에서 쉽게 컨텍스트를 사용하기 위한 커스텀 훅
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};