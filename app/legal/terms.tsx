import React from 'react'; 
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const termsContent = `
게임 서비스 이용약관

1. 서비스 개요
본 서비스는 테이블탑 롤플레잉 게임(TRPG) 플랫폼으로, 사용자들이 온라인에서 TRPG를 플레이할 수 있는 환경을 제공합니다

2. 약관의 동의
본 서비스를 이용함으로써 사용자는 본 약관에 동의한 것으로 간주됩니다. 약관에 동의하지 않는 경우 서비스 이용을 중단해야 합니다

3. 계정 및 회원가입

3.1 계정 생성
만 13세 이상의 사용자만 계정을 생성할 수 있습니다
정확하고 완전한 정보를 제공해야 합니다
계정 정보는 항상 최신 상태로 유지해야 합니다

3.2 계정 보안

계정 정보의 보안은 사용자의 책임입니다
계정 공유나 양도는 금지됩니다
의심스러운 활동은 즉시 신고해야 합니다

4. 서비스 이용 규칙
4.1 금지 행위
다음 행위는 엄격히 금지됩니다:

다른 사용자에 대한 괴롭힘, 협박, 차별적 발언
성적, 폭력적, 불법적 콘텐츠의 공유
저작권을 침해하는 자료의 업로드
서비스 운영을 방해하는 행위
부적절한 닉네임이나 캐릭터명 사용
실제 개인정보 공유 (풀네임, 주소, 전화번호 등)

4.2 게임 플레이 에티켓

GM(게임 마스터)과 플레이어는 서로를 존중해야 합니다
게임 세션 중 예의를 지켜야 합니다
다른 플레이어의 게임 경험을 해치는 행동을 삼가야 합니다
세션 이탈 시 사전 통보를 권장합니다

4.3 콘텐츠 가이드라인

업로드하는 모든 콘텐츠는 적절해야 합니다
저작권이 있는 자료 사용 시 출처를 명시해야 합니다
미성년자에게 부적절한 콘텐츠는 금지됩니다

5. 지적재산권
5.1 사용자 생성 콘텐츠

사용자가 생성한 콘텐츠의 소유권은 사용자에게 있습니다
서비스 제공을 위한 최소한의 라이선스를 회사에 부여합니다
타인의 지적재산권을 침해하지 않을 책임이 있습니다

5.2 서비스 제공 콘텐츠

서비스에서 제공하는 도구, 템플릿 등은 회사의 소유입니다
허가된 범위 내에서만 사용 가능합니다

6. 개인정보 보호

개인정보 처리방침에 따라 개인정보를 보호합니다
필요한 최소한의 정보만 수집합니다
사용자 동의 없이 제3자에게 개인정보를 제공하지 않습니다

7. 서비스 이용 제한
7.1 이용 제한 사유
다음의 경우 서비스 이용이 제한될 수 있습니다:

본 약관 위반 시
다른 사용자의 신고가 접수된 경우
법적 요구사항에 따라 필요한 경우

7.2 제재 수준

경고: 첫 번째 위반 시
일시 정지: 7일~30일
영구 정지: 심각하거나 반복적인 위반 시

7.3 이의제기

부당한 제재에 대해 이의제기할 수 있습니다
고객지원을 통해 신청 가능합니다

8. 서비스 변경 및 중단

서비스 개선을 위해 변경될 수 있습니다
중대한 변경사항은 사전 공지됩니다
기술적 문제로 인한 일시적 중단이 있을 수 있습니다

9. 면책 조항
9.1 서비스 제공 범위

서비스는 "있는 그대로" 제공됩니다
서비스의 완전성이나 정확성을 보장하지 않습니다
사용자 간의 분쟁에 대해 책임지지 않습니다

9.2 손해 배상 제한

서비스 이용으로 인한 직간접적 손해에 대해 책임을 지지 않습니다
다만, 법적으로 배제할 수 없는 책임은 예외입니다

10. 분쟁 해결

분쟁 발생 시 상호 협의를 통해 해결을 시도합니다
협의가 불가능한 경우 관련 법령 및 관할법원에 따릅니다

11. 약관의 변경

약관은 필요에 따라 변경될 수 있습니다
변경 시 서비스 내 공지를 통해 알려드립니다
변경된 약관은 공지 후 7일 뒤부터 효력을 가집니다

12. 연락처
서비스 관련 문의:

이메일: support@[서비스명].com
고객지원: [웹사이트 주소]/support
`;

export default function TermsScreen() {

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>이용약관</Text>
        <View style={{ width: 40 }} /> 
      </View>

      {/* 내용 */}
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* ★★★ 5. 로딩 상태 없이, 우리가 만든 텍스트를 바로 보여줍니다. ★★★ */}
        <Text style={styles.termsText}>{termsContent}</Text>
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontFamily: 'Dongle',
    fontWeight: 'bold',
  },
  contentContainer: {
    padding: 20,
  },
  termsText: {
    color: '#ddd',
    fontSize: 20,
    fontFamily: 'Dongle',
    lineHeight: 28,
  },
});