import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { authService } from '../services/auth';

// 웹 브라우저 자동으로 닫힘 (앱 시작 시, 한 번만 호출)
WebBrowser.maybeCompleteAuthSession();

// 환경 변수 클라이언트 ID
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_SOCIAL_AUTH_GOOGLE_CLIENT_ID;
if(!GOOGLE_CLIENT_ID) {
  console.error('GOOGLE_CLIENT_ID 없음');
}

// 리다이렉트 URI 생성
const REDIRECT_URI = AuthSession.makeRedirectUri({
  useProxy: true,
});

export const useGoogleAuth = (onSuccess: (user: any) => void) => {
  const googleDiscovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token'
  };
  
  const [googleRequest, googleResponse, googlePromptAsync] = AuthSession.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri: REDIRECT_URI,
    scopes: ['openid', 'profile', 'email'],
    responseType: 'code',
    usePKCE: true,      // Google은 PKCE 권장
  }, googleDiscovery);
  
  useEffect(() => {
    console.log('Google Auth Response:', googleResponse);
    if(googleResponse?.type === 'success') {
      const { code } = googleResponse.params;
      if(!code) {
        console.error('구글 로그인 실패 : code 없음');
        return;
      }

      // 백엔드 Google 콜백
      authService.handleSocialLoginCallback(
        '/auth/google/callback',
        code,
        REDIRECT_URI,
        googleRequest?.codeVerifier
      )
      .then(user => {
        if(user) {
          onSuccess(user);
        } else {
          console.error('구글 로그인 성공, 데이터 없음');
        }
      })
      .catch(error => console.error('구글 로그인 처리 에러', error));
    } else if(googleResponse?.type === 'error') {
      console.error('Google Auth Error:', googleResponse.error);
    }
  }, [googleResponse]);

  return { googlePromptAsync, googleRequest, googleResponse };
};