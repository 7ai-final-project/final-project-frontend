import { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { authService } from '../services/auth';

interface User {
  id: string;
  name: string;
  email?: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 로그인 상태 확인 및 관리
  const checkLoginStatus = async () => {
    setLoading(true);
    let accessToken = await storage.getItem('access_token');
    const refreshToken = await storage.getItem('refresh_token');

    if(!accessToken && !refreshToken) {
      setUser(null);
      setLoading(false);
      console.log('토큰 없음, 로그인 상태 아님');
      return;
    }
    
    // 액세스 토큰으로 사용자 정보 조회 시도
    if(accessToken) {
      const currentUser = await authService.fetchCurrentUser(accessToken);
      if(currentUser) {
        setUser(currentUser);
        setLoading(false);
        console.log('액세스 토큰으로 로그인 상태 확인');
        return;
      }
    }
    
    // 액세스 토큰이 없거나 만료되었을 경우, 리프레시 토큰으로 갱신 시도
    if(refreshToken) {
      console.log('액세스 토큰 만료, 리프레시 토큰으로 갱신 시도...');
      const newAccessToken = await authService.refreshAccessToken(refreshToken);
      
      if(newAccessToken) {
        const currentUser = await authService.fetchCurrentUser(newAccessToken);
        if(currentUser) {
          setUser(currentUser);
          setLoading(false);
          console.log('토큰 갱신 성공 및 사용자 정보 조회');
          return;
        }
      }
    }

    // 모든 시도 실패 시, 로그인 정보 삭제
    await authService.clearAuthTokens();
    setUser(null);
    setLoading(false);
    console.log('로그인 상태 아님: 토큰 갱신 실패 또는 사용자 정보 조회 실패');
  };

  // 페이지 로딩 시, 로그인 상태 체크
  useEffect(() => {
    checkLoginStatus();
  }, []);

  // 로그아웃
  const handleLogout = async () => {
    const refreshToken = await storage.getItem('refresh_token');
    await authService.logout(refreshToken);
    setUser(null);
  };

  return { user, setUser, loading, checkLoginStatus, handleLogout };
};