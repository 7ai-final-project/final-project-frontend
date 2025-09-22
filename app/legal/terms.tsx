import React, { useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';

const termsContent = `
1. 서비스 개요
본 서비스는 테이블탑 롤플레잉 게임(TRPG) 플랫폼으로, 사용자들이 온라인에서 TRPG를 플레이할 수 있는 환경을 제공합니다.

2. 약관의 동의
본 서비스를 이용함으로써 사용자는 본 약관에 동의한 것으로 간주됩니다. 약관에 동의하지 않는 경우 서비스 이용을 중단해야 합니다.

3. 계정 생성 및 로그인
3.1 계정 생성
본 서비스는 별도의 회원가입 절차 없이, 소셜 로그인 방식을 통해 계정을 생성하고 이용할 수 있습니다.
소셜 계정을 보유한 만 13세 이상의 사용자만 서비스를 이용할 수 있습니다.
계정 생성 시 소셜 로그인 과정에서 제공되는 이름, 이메일, 닉네임 외의 개인정보는 수집하지 않습니다.

3.2 계정 보안
계정 정보의 보안은 사용자의 책임입니다.
계정 공유나 양도는 금지됩니다.
의심스러운 활동은 즉시 신고해야 합니다.

4. 서비스 이용 규칙
4.1 금지 행위
다음 행위는 엄격히 금지됩니다:
- 다른 사용자에 대한 괴롭힘, 협박, 차별적 발언
- 성적, 폭력적, 불법적 콘텐츠의 공유
- 저작권을 침해하는 자료의 무단 사용
- 서비스 운영을 방해하는 행위
- 부적절한 닉네임이나 캐릭터명 사용
- 실제 개인정보 공유 (풀네임, 주소, 전화번호 등)

4.2 게임 플레이 에티켓
- GM(게임 마스터)과 플레이어는 서로를 존중해야 합니다.
- 게임 세션 중 예의를 지켜야 합니다.
- 다른 플레이어의 게임 경험을 해치는 행동을 삼가야 합니다.
- 세션 이탈 시 사전 통보를 권장합니다.

5. 지적재산권
5.1 서비스 제공 콘텐츠
서비스에서 제공하는 게임 시스템, 도구, 템플릿, 기록 데이터 등은 회사의 소유입니다.
사용자는 회사가 허가한 범위 내에서만 이를 이용할 수 있습니다.

6. 개인정보 보호
당사는 서비스 제공을 위해 필요한 최소한의 개인정보(이름, 이메일, 닉네임)만 수집합니다.
사용자의 게임 이용 기록은 최대 6개월간 보관되며, 이후 자동으로 삭제됩니다.
개인정보는 관련 법령 및 개인정보 처리방침에 따라 보호됩니다.
사용자 동의 없이 제3자에게 개인정보를 제공하지 않습니다.

7. 서비스 이용 제한
7.1 이용 제한 사유
다음의 경우 서비스 이용이 제한될 수 있습니다:
- 본 약관 위반 시
- 다른 사용자의 신고가 접수된 경우
- 법적 요구사항에 따라 필요한 경우

7.2 제재 수준
- 경고: 첫 번째 위반 시
- 일시 정지: 7일~30일
- 영구 정지: 심각하거나 반복적인 위반 시

7.3 이의제기
부당한 제재에 대해 이의제기할 수 있습니다.
고객지원을 통해 신청 가능합니다.

8. 서비스 변경 및 중단
서비스 개선을 위해 변경될 수 있습니다.
중대한 변경사항은 사전 공지됩니다.
기술적 문제로 인한 일시적 중단이 있을 수 있습니다.

9. 면책 조항
9.1 서비스 제공 범위
서비스는 "있는 그대로" 제공됩니다.
서비스의 완전성이나 정확성을 보장하지 않습니다.
사용자 간의 분쟁에 대해 책임지지 않습니다.

9.2 손해 배상 제한
서비스 이용으로 인한 직간접적 손해에 대해 책임을 지지 않습니다.
다만, 법적으로 배제할 수 없는 책임은 예외입니다.

10. 분쟁 해결
분쟁 발생 시 상호 협의를 통해 해결을 시도합니다.
협의가 불가능한 경우 관련 법령 및 관할법원에 따릅니다.

11. 약관의 변경
약관은 필요에 따라 변경될 수 있습니다.
변경 시 서비스 내 공지를 통해 알려드립니다.
변경된 약관은 공지 후 7일 뒤부터 효력을 가집니다.

12. 연락처
서비스 관련 문의:
이메일: support@[서비스명].com
고객지원: [웹사이트 주소]/support
`;

export default function TermsScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [fontsLoaded, fontError] = useFonts({ neodgm: require('../../assets/fonts/neodgm.ttf') });

  useEffect(() => {
    if (fontError) console.log(fontError);
  }, [fontError]);

  const parseTermsContent = useCallback((content: string, currentIsMobile: boolean) => {
    return content
      .trim()
      .split(/\n{2,}/) // 2줄 이상 공백 기준으로 섹션 나누기
      .map((section, idx) => {
        const lines = section.trim().split('\n').filter(Boolean);
        if (lines.length === 0) return null;

        const titleLine = lines[0];
        const restLines = lines.slice(1);

        return (
          <View key={idx} style={styles.section}>
            <Text style={currentIsMobile ? styles.sectionTitleMobile : styles.sectionTitle}>{titleLine}</Text>
            {restLines.map((line, i) => (
              <Text key={i} style={currentIsMobile ? styles.termsTextMobile : styles.termsText}>
                {line}
              </Text>
            ))}
          </View>
        );
      });
  }, []);

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <View style={isMobile ? styles.headerMobile : styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={isMobile ? 22 : 28} color="#E2C044" />
        </TouchableOpacity>
        <Text style={isMobile ? styles.headerTitleMobile : styles.headerTitle}>이용약관</Text>
        <View style={{ width: isMobile ? 32 : 40 }} />
      </View>

      <ScrollView contentContainerStyle={isMobile ? styles.contentContainerMobile : styles.contentContainer}>
        {parseTermsContent(termsContent, isMobile)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1021', paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  headerMobile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  backButton: { padding: 5 },
  headerTitle: { color: '#E2C044', fontSize: 28, fontFamily: 'neodgm', fontWeight: 'bold' },
  headerTitleMobile: { color: '#E2C044', fontSize: 22, fontFamily: 'neodgm', fontWeight: 'bold' },
  contentContainer: { padding: 30 },
  contentContainerMobile: { padding: 15 },
  section: { marginBottom: 20 },
  sectionTitle: { color: '#E2C044', fontSize: 22, fontFamily: 'neodgm', fontWeight: 'bold', marginBottom: 10 },
  sectionTitleMobile: { color: '#E2C044', fontSize: 18, fontFamily: 'neodgm', fontWeight: 'bold', marginBottom: 8 },
  termsText: { color: '#D1C4E9', fontSize: 18, fontFamily: 'neodgm', lineHeight: 28, marginBottom: 3 },
  termsTextMobile: { color: '#D1C4E9', fontSize: 14, fontFamily: 'neodgm', lineHeight: 22, marginBottom: 2 },
});