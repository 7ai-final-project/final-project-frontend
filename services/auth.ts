import { storage } from './storage';

// API 기본 URL
const BASE_API_URL = 'http://20.196.72.38';

interface User {
  id: string;
  name: string;
  nickname: string;
  email?: string;
}

interface AuthTokens {
  access_token: string;
  refresh_token?: string;
}

export const authService = {
  // 액세스 토큰 재발급
  refreshAccessToken: async (refreshToken: string): Promise<string | null> => {
    try {
      const response = await fetch(`${BASE_API_URL}/auth/token/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if(response.ok) {
        const data: AuthTokens = await response.json();
        await storage.setItem('access_token', data.access_token);
        console.log('액세스 토큰 갱신 성공');
        return data.access_token;
      } else {
        console.log('액세스 토큰 갱신 실패', response.status);
        await authService.clearAuthTokens();
        return null;
      }
    } catch(error) {
      console.error('액세스 토큰 갱신 에러', error);
      await authService.clearAuthTokens();
      return null;
    }
  },

  // 현재 사용자 정보 가져오기
  fetchCurrentUser: async (accessToken: string): Promise<User | null> => {
    try {
      const response = await fetch(`${BASE_API_URL}/auth/user/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });

      if(response.ok) {
        const data = await response.json();
        const user: User = data.user || data;
        return user;
      } else if(response.status === 401) {
        console.log('액세스 토큰 만료 또는 유효하지 않음');
        return null;
      } else {
        console.log('사용자 정보 조회 실패', response.status);
        return null;
      }
    } catch(error) {
      console.error('사용자 정보 조회 에러', error);
      return null;
    }
  },

  // 모든 인증 토큰 삭제
  clearAuthTokens: async () => {
    await storage.deleteItem('access_token');
    await storage.deleteItem('refresh_token');
    console.log('모든 인증 토큰 및 사용자 정보 삭제');
  },

  // 로그아웃
  logout: async (refreshToken: string | null) => {
    if(refreshToken) {
      try {
        await fetch(`${BASE_API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
        console.log('백엔드 로그아웃 요청 완료');
      } catch (error) {
        console.error('백엔드 로그아웃 에러', error);
      }
    }
    await authService.clearAuthTokens();
    console.log('클라이언트 로그아웃 완료');
  },

  // 소셜 로그인 콜백 처리 (공통)
  handleSocialLoginCallback: async (
    providerCallbackPath: string,
    code: string,
    redirectUri: string,
    codeVerifier?: string     // PKCE를 사용하는 경우 (Google)
  ): Promise<User | null> => {
    try {
      const body: any = { code, redirect_uri: redirectUri };
      if(codeVerifier) {
        body.code_verifier = codeVerifier;
      }

      const response = await fetch(`${BASE_API_URL}${providerCallbackPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if(!response.ok) {
        const errorData = await response.json();
        throw new Error(`소셜 로그인 실패 : ${response.status} - ${errorData.detail || JSON.stringify(errorData)}`);
      }

      const data: AuthTokens & { user?: User } = await response.json();
      await storage.setItem('access_token', data.access_token);
      
      if(data.refresh_token) {
        await storage.setItem('refresh_token', data.refresh_token);
      }

      return data.user || null;
    } catch(error) {
      console.error('소셜 로그인 콜백 처리 에러', error);
      await authService.clearAuthTokens();
      return null;
    }
  }
};