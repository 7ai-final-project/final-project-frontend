import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { authService } from '../services/auth';

// 웹 브라우저 자동으로 닫힘 (앱 시작 시, 한 번만 호출)
WebBrowser.maybeCompleteAuthSession();

// 환경 변수 REST API 키
const KAKAO_REST_API_KEY = process.env.EXPO_PUBLIC_SOCIAL_AUTH_KAKAO_REST_API_KEY;
if(!KAKAO_REST_API_KEY) {
  console.error('KAKAO_REST_API_KEY 없음');
}

// 리다이렉트 URI 생성
const REDIRECT_URI = AuthSession.makeRedirectUri({
  useProxy: true,
});

export const useKakaoAuth = (onSuccess: (user: any) => void) => {
  const kakaoDiscovery = {
    authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
  };

  const [kakaoRequest, kakaoResponse, kakaoPromptAsync] = AuthSession.useAuthRequest({
    clientId: KAKAO_REST_API_KEY,
    redirectUri: REDIRECT_URI,
    scopes: ['profile_nickname', 'profile_image'],
    responseType: 'code',
    usePKCE: false,     // 카카오는 PKCE를 사용하지 않음
  }, kakaoDiscovery);

  useEffect(() => {
    console.log('Kakao Auth Response:', kakaoResponse);
    if(kakaoResponse?.type === 'success') {
      const { code } = kakaoResponse.params;
      if(!code) {
        console.error('카카오 로그인 실패 : code 없음');
        return;
      }

      // 백엔드 Kakao 콜백
      authService.handleSocialLoginCallback(
        '/auth/kakao/callback',
        code,
        REDIRECT_URI
      )
      .then(user => {
        if(user) {
          onSuccess(user);
        } else {
          console.error('카카오 로그인 성공, 데이터 없음');
        }
      })
      .catch(error => console.error('카카오 로그인 처리 에러', error));
    } else if(kakaoResponse?.type === 'error') {
      console.error('Kakao Auth Error:', kakaoResponse.error);
    }
  }, [kakaoResponse]);

  return { kakaoPromptAsync, kakaoRequest, kakaoResponse };
};