import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { authService } from '../services/auth';

// 웹 브라우저 자동으로 닫힘 (앱 시작 시, 한 번만 호출)
WebBrowser.maybeCompleteAuthSession();

// 환경 변수 클라이언트 ID
const MICROSOFT_TENANT_ID = process.env.EXPO_PUBLIC_SOCIAL_AUTH_MICROSOFT_TENANT_ID;
if(!MICROSOFT_TENANT_ID) {
  console.error('MICROSOFT_TENANT_ID 없음');
}
const MICROSOFT_CLIENT_ID = process.env.EXPO_PUBLIC_SOCIAL_AUTH_MICROSOFT_CLIENT_ID;
if(!MICROSOFT_CLIENT_ID) {
  console.error('MICROSOFT_CLIENT_ID 없음');
}

// 리다이렉트 URI 생성
const REDIRECT_URI = AuthSession.makeRedirectUri({});

export const useMicrosoftAuth = (onSuccess: (user: any) => void) => {
  const microsoftDiscovery = {
    authorizationEndpoint: `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`,
  };

  const [microsoftRequest, microsoftResponse, microsoftPromptAsync] = AuthSession.useAuthRequest({
    clientId: MICROSOFT_CLIENT_ID,
    redirectUri: REDIRECT_URI,
    scopes: ['User.Read', 'openid', 'profile', 'email'],
    responseType: 'code',
    usePKCE: true,
  }, microsoftDiscovery);

  useEffect(() => {
    console.log('Microsoft Auth Response:', microsoftResponse);
    if(microsoftResponse?.type === 'success') {
      const { code } = microsoftResponse.params;
      if(!code) {
        console.error('마이크로소프트 로그인 실패 : code 없음');
        return;
      }

      // 백엔드 Microsoft 콜백
      authService.handleSocialLoginCallback(
        '/auth/microsoft/callback',
        code,
        REDIRECT_URI,
        microsoftRequest?.codeVerifier
      )
      .then(user => {
        if(user) {
          onSuccess(user);
        } else {
          console.error('마이크로소프트 로그인 성공, 데이터 없음');
        }
      })
      .catch(error => console.error('마이크로소프트 로그인 처리 에러', error));
    } else if(microsoftResponse?.type === 'error') {
      console.error('Google Auth Error:', microsoftResponse.error);
    }
  }, [microsoftResponse]);

  return { microsoftPromptAsync, microsoftRequest, microsoftResponse };
};