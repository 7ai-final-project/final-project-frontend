// final-project-frontend/hooks/useNarrationTTS.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Speech from "expo-speech";

export type UseNarrationTTSOptions = {
  /** 기본 언어 (예: "ko-KR") */
  language?: string;
  /** 이 값이 변경될 때 자동으로 읽어줍니다 (enable=true일 때만) */
  autoSpeakText?: string;
  /** true일 때만 autoSpeakText 자동 발화 */
  enable?: boolean;
  /** 말하기 속도: iOS(0~1.0), Android(0~2.0) */
  rate?: number;
  /** 음높이: 0~2.0 */
  pitch?: number;
  /** 볼륨: 0~1.0 */
  volume?: number;
  onStart?: () => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
};

export type UseNarrationTTSReturn = {
  /** 사용 가능한 한국어(또는 지정 언어) 보이스의 identifier (없으면 undefined) */
  voiceId?: string;
  /** 보이스 고정 변경이 필요할 때 수동 지정 */
  setVoiceId: (id?: string) => void;
  /** 디바이스에서 TTS 사용 준비가 되었는지 (보이스 조회 시 true) */
  ready: boolean;
  /** 수동 재생 */
  speak: (text: string) => void;
  /** 중지 */
  stop: () => void;
};

function pickPreferredVoice(voices: Speech.Voice[], lang: string) {
  // lang이 "ko-KR"이면 ko-KR 우선, 없으면 "ko"로 시작하는 첫 보이스
  const exact = voices.find(v => v.language?.toLowerCase() === lang.toLowerCase());
  if (exact) return exact.identifier;
  const base = lang.split("-")[0].toLowerCase(); // "ko"
  const starts = voices.find(v => v.language?.toLowerCase().startsWith(base));
  return starts?.identifier;
}

export default function useNarrationTTS(opts?: UseNarrationTTSOptions): UseNarrationTTSReturn {
  const {
    language = "ko-KR",
    autoSpeakText,
    enable = true,
    rate = 1.0,
    pitch = 1.0,
    volume = 1.0,
    onStart,
    onDone,
    onError,
  } = opts || {};

  const [voiceId, setVoiceId] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const mountedRef = useRef(true);

  // 보이스 목록 1회 로드
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const chosen = pickPreferredVoice(voices ?? [], language);
        if (mountedRef.current) {
          setVoiceId(chosen);
          setReady(true);
        }
      } catch (e) {
        console.warn("[TTS] getAvailableVoicesAsync failed:", e);
        if (mountedRef.current) setReady(true); // 보이스 조회 실패해도 기본 엔진으로 시도
      }
    })();
    return () => {
      mountedRef.current = false;
      Speech.stop();
    };
  }, [language]);

  const stop = useCallback(() => {
    try { Speech.stop(); } catch {}
  }, []);

  const speak = useCallback((text: string) => {
    if (!text?.trim()) return;
    // 이전 발화 중지 후 새로 재생
    try { Speech.stop(); } catch {}
    Speech.speak(text, {
      language,
      voice: voiceId,
      rate,
      pitch,
      volume,
      onStart,
      onDone,
      onError: (e) => {
        console.warn("[TTS] onError:", e);
        onError?.(e);
      },
    });
  }, [language, voiceId, rate, pitch, volume, onStart, onDone, onError]);

  // autoSpeakText 변경 시 자동 발화
  useEffect(() => {
    if (!enable) return;
    if (!autoSpeakText?.trim()) return;
    // ready가 되었을 때만 실행(보이스 조회 완료)
    if (!ready) return;
    speak(autoSpeakText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSpeakText, enable, ready]);

  return useMemo(() => ({ voiceId, setVoiceId, ready, speak, stop }), [voiceId, ready, speak, stop]);
}
