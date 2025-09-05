import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Image,
  Animated,
  Alert,
} from "react-native";
import { Character } from "@/data/characters";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useWebSocket } from "@/components/context/WebSocketContext";
import { getSceneTemplate, renderSceneFromRound } from "@/util/ttrpg";
import { RoundResult, SceneRoundSpec, SceneTemplate, PerRoleResult, Grade } from "@/util/ttrpg";
import { endGame } from "@/services/api";
import { Audio } from "expo-av";

type Props = {
  roomId: string | string[];
  topic: string | string[];
  difficulty?: string | string[];
  selectedCharacter: Character;
  turnSeconds?: number;
};

// Phase 순서 변경: cinematic과 dice_roll 위치 변경
type Phase = "intro" | "choice" | "sync" | "dice_roll" | "cinematic" | "end";


export default function GameEngineRealtime({
  roomId,
  topic,
  difficulty = "초급",
  selectedCharacter,
  turnSeconds = 20,
}: Props) {
  const { wsRef } = useWebSocket();
  const ws = wsRef?.current ?? null;

  const [phase, setPhase] = useState<Phase>("intro");

  const [clickSound, setClickSound] = useState<Audio.Sound | null>(null);
  const [pageTurnSound, setPageTurnSound] = useState<Audio.Sound | null>(null);
  const [diceRollSound, setDiceRollSound] = useState<Audio.Sound | null>(null);

  // ★★★ 2. 게임이 시작될 때 모든 '효과음'을 미리 로드합니다. ★★★
 useEffect(() => {
    const loadSounds = async () => {
        try {
            const { sound: loadedClickSound } = await Audio.Sound.createAsync(
               require('../../assets/sounds/click.mp3') // 사용자님의 경로 별명(@)에 맞게 수정
            );
            setClickSound(loadedClickSound);
            
            const { sound: loadedPageTurnSound } = await Audio.Sound.createAsync(
               require('../../assets/sounds/page_turn.mp3') // 사용자님의 경로 별명(@)에 맞게 수정
            );
            setPageTurnSound(loadedPageTurnSound);

            const { sound: loadedDiceRollSound } = await Audio.Sound.createAsync(
               require('@/assets/sounds/dice_roll.mp3')
            );
            setDiceRollSound(loadedDiceRollSound);

        } catch (error) {
            console.error("사운드 로딩 실패:", error);
        }
    };
    
    loadSounds();

    // 컴포넌트가 사라질 때 모든 사운드를 메모리에서 해제합니다.
    return () => {
        clickSound?.unloadAsync();
        pageTurnSound?.unloadAsync();
    };
  }, []); // 이 useEffect는 맨 처음에 딱 한 번만 실행됩니다.


  const [sceneIndex, setSceneIndex] = useState(0);
  const [sceneTemplates, setSceneTemplates] = useState<SceneTemplate[]>([]);
  const [loadingScenes, setLoadingScenes] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [diceResult, setDiceResult] = useState<string | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isResultsModalVisible, setIsResultsModalVisible] = useState(false); // ✅ 추가: 결과 상세 보기 모달 상태

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // ✅ 추가: 페이즈 전환 애니메이션 값
  const phaseAnim = useRef(new Animated.Value(0)).current;

  // 현재 라운드 스펙
  const roundSpec: SceneRoundSpec | null = useMemo(() => {
    if (!sceneTemplates || sceneTemplates.length === 0) return null;
    const tpl = getSceneTemplate(sceneTemplates, sceneIndex);
    return tpl?.round ?? null;
  }, [sceneTemplates, sceneIndex]);

  // 내 역할 식별
  const myRole = useMemo(() => {
    if (!sceneTemplates || sceneTemplates.length === 0) return null;
    const tpl = getSceneTemplate(sceneTemplates, sceneIndex);
    if (!tpl) return null;
    return tpl.roleMap?.[selectedCharacter.name] ?? null;
  }, [sceneTemplates, sceneIndex, selectedCharacter.name]);

  // 선택/타이머
  const [remaining, setRemaining] = useState(turnSeconds);
  const timerRef = useRef<number | null>(null);
  const [myChoiceId, setMyChoiceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // AI 자동 선택을 위한 상태
  const [aiChoices, setAiChoices] = useState<{[role: string]: string}>({});
  const [allChoicesReady, setAllChoicesReady] = useState(false);

  // 서버에서 합의된 라운드 결과
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [cinematicText, setCinematicText] = useState<string>("");

  const timerAnim = useRef(new Animated.Value(turnSeconds)).current;

  const handleReturnToRoom = () => {
    setIsModalVisible(true);
  };

  const confirmReturnToRoom = async () => {
    setIsModalVisible(false); // 먼저 모달을 닫습니다.
    
    const id = Array.isArray(roomId) ? roomId[0] : roomId;
    if (!id) {
      Alert.alert("알림", "방 ID가 유효하지 않습니다.");
      return;
    }

    try {
      await endGame(id); 
      router.replace(`/game/multi/room/${id}`);
    } catch (error) {
      console.error("방으로 돌아가는 중 오류 발생:", error);
      Alert.alert("오류", "오류가 발생하여 방으로 돌아갈 수 없습니다.");
    }
  };

  const startTimer = () => {
    stopTimer();
    setRemaining(turnSeconds);
    
    // 애니메이션 초기화 및 시작
    timerAnim.setValue(turnSeconds);
    Animated.timing(timerAnim, {
      toValue: 0,
      duration: turnSeconds * 1000,
      useNativeDriver: false, // width 속성은 네이티브 드라이버를 지원하지 않습니다.
    }).start();

    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          autoPickAndSubmit();
          stopTimer();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    timerAnim.stopAnimation();
  };

  // 난이도에 따른 목표 DC(Difficulty Class)를 가져오는 함수
  const getDC = (difficulty?: string | string[]) => {
    const diffStr = Array.isArray(difficulty) ? difficulty[0] : difficulty;
    switch (diffStr) {
      case "초급":
        return 10;
      case "중급":
        return 13;
      case "상급":
        return 16;
      default:
        return 10;
    }
  };

  // 주사위 굴리는 함수
  const rollDice = (sides: number = 20) => {
    return Math.floor(Math.random() * sides) + 1;
  };

  // [수정됨] 주사위 굴리기 시작 함수
  const startDiceRoll = () => {
    diceRollSound?.replayAsync();
    setIsRolling(true);
    setDiceResult(null);
    spinValue.setValue(0);
    
    const spinAnim = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      })
    );
    spinAnim.start();

    setTimeout(() => {
      spinAnim.stop();

      const choice = roundSpec?.choices[myRole!]?.find(c => c.id === myChoiceId);
      if (!choice) {
          setDiceResult("오류: 선택지를 찾을 수 없습니다.");
          setIsRolling(false);
          return;
      }

      const dice = rollDice(20);
      const appliedStat = choice.appliedStat as keyof Character['stats']; // 타입 단언 추가
      const statValue = selectedCharacter.stats[appliedStat] ?? 0;
      const modifier = choice.modifier;
      const total = dice + statValue + modifier;
      const DC = getDC(difficulty);

      let grade: Grade = "F";
      let resultText = "";
      if (dice === 20) {
        grade = "SP";
        resultText = "치명적 대성공 🎉 (Natural 20!)";
      } else if (dice === 1) {
        grade = "SF";
        resultText = "치명적 실패 💀 (Natural 1...)";
      } else if (total >= DC) {
        grade = "S";
        resultText = `성공 ✅ (목표 DC ${DC} 이상 달성)`;
      } else {
        grade = "F";
        resultText = `실패 ❌ (목표 DC ${DC} 미달)`;
      }

      setDiceResult(`🎲 d20: ${dice} + ${appliedStat}(${statValue}) + 보정(${modifier}) = ${total} → ${resultText}`);
      setIsRolling(false);
      
      const myResult: PerRoleResult = {
        role: myRole!,
        choiceId: myChoiceId!,
        grade: grade, // ✅ 실제 계산된 등급 사용
        dice: dice,
        appliedStat: appliedStat,
        statValue: statValue,
        modifier: modifier,
        total: total,
      };

      // ✅ [추가] AI 결과와 내 결과를 합쳐 최종 결과를 만듭니다.
      const aiResults: PerRoleResult[] = Object.entries(aiChoices).map(([role, choiceId]) => {
          const grades: Grade[] = ["SP", "S", "F", "SF"];
          return {
            role: role,
            choiceId: choiceId,
            grade: grades[Math.floor(Math.random() * grades.length)],
            dice: 10, appliedStat: "행운", statValue: 2, modifier: 0, total: 12,
          };
        });

      const finalResult: RoundResult = {
        sceneIndex: sceneIndex,
        results: [myResult, ...aiResults], // 내 결과와 AI 결과를 합침
        logs: [`${myRole}이(가) 주사위 판정을 했습니다. 결과: ${resultText}`],
      };
      
      setRoundResult(finalResult);

      const tpl = getSceneTemplate(sceneTemplates, sceneIndex);
      if (tpl) {
        const text = renderSceneFromRound(tpl, finalResult);
        setCinematicText(text);
      }
      
      // ✅ [수정] 페이즈 전환에 애니메이션 적용
      Animated.timing(phaseAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setPhase("cinematic");
        Animated.timing(phaseAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });

    }, 2000);
  };

  // 자동선택
  const autoPickAndSubmit = () => {
    if (!roundSpec || !myRole || submitting) return;
    const choices = roundSpec.choices[myRole] ?? [];
    if (choices.length === 0) return;
    const rnd = choices[Math.floor(Math.random() * choices.length)];
    submitChoice(rnd.id);
  };

  // AI 캐릭터들 자동 선택 (테스트용)
  const generateAIChoices = () => {
    if (!roundSpec || !myRole) return;
    
    const newAiChoices: {[role: string]: string} = {};
    
    // 모든 역할에 대해 자동 선택 (내 역할 제외)
    Object.keys(roundSpec.choices).forEach(role => {
      if (role !== myRole) {
        const choices = roundSpec.choices[role] ?? [];
        if (choices.length > 0) {
          const randomChoice = choices[Math.floor(Math.random() * choices.length)];
          newAiChoices[role] = randomChoice.id;
        }
      }
    });
    
    setAiChoices(newAiChoices);
    console.log("AI 자동 선택 완료:", newAiChoices);
  };

  const submitChoice = (choiceId: string) => {
     clickSound?.replayAsync();
    
     
    // 테스트용: 로컬에서 바로 처리
    setSubmitting(true);
    setMyChoiceId(choiceId);
    console.log(`${myRole}이(가) ${choiceId} 선택함`);
    
    // 모든 선택이 완료되었는지 확인
    setTimeout(() => {
      setAllChoicesReady(true);
    }, 1000); // 1초 후 결과 처리
  };

  // [수정됨] 모든 선택 완료시 결과 생성 (테스트용)
  useEffect(() => {
    if (allChoicesReady) {
      stopTimer();
      // ✅ 페이즈 전환에 애니메이션 적용
      Animated.timing(phaseAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setPhase("dice_roll"); // ✅ 선택 완료 후, 바로 주사위 굴리기 단계로 이동
        setSubmitting(false);
        Animated.timing(phaseAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [allChoicesReady]);
  
  // 씬 데이터 불러오기 함수
  const fetchScenes = async () => {
    let timeoutId: number | null = null;
    
    try {
      console.log("Fetching scenes...");
      setLoadingScenes(true);
      setLoadError(null);

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch("http://localhost:8000/game/api/scenes/", {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Scenes received:", data);
      
      if (data && data.scenes && Array.isArray(data.scenes)) {
        setSceneTemplates(data.scenes);
      } else if (Array.isArray(data)) {
        setSceneTemplates(data);
      } else {
        throw new Error("Invalid scene data format");
      }
    } catch (error: unknown) {
      if (timeoutId) clearTimeout(timeoutId);
      
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
        console.error("Request timed out");
        setLoadError("요청 시간이 초과되었습니다. 서버 연결을 확인해주세요.");
      } else {
        console.error("Failed to load scenes:", error);
        setLoadError(error instanceof Error ? error.message : "서버 연결에 실패했습니다.");
      }
      
      setSceneTemplates([]);
    } finally {
      setLoadingScenes(false);
    }
  };

  // 초기 씬 데이터 불러오기
  useEffect(() => {
    fetchScenes();
  }, []);

  // 씬 시작 → 선택 페이즈 진입
  useEffect(() => {
    if (loadingScenes || loadError) return;

// ★★★ 5. 새로운 씬(라운드)이 시작될 때 -> 페이지 넘김 사운드 재생 ★★★
    pageTurnSound?.replayAsync();

    const currentScene = getSceneTemplate(sceneTemplates, sceneIndex);
    if (!currentScene) {
      setPhase("end");
      return;
    }

    const currentMyRole = currentScene.roleMap?.[selectedCharacter.name] ?? null;
    const currentRoundSpec = currentScene.round ?? null;

    if (!currentRoundSpec || !currentMyRole) {
      setPhase("end");
      return;
    }

    // 씬이 바뀔 때마다 모든 관련 상태를 명확하게 초기화합니다.
    // ✅ 페이즈 전환에 애니메이션 적용
    Animated.timing(phaseAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setPhase("choice");
      setMyChoiceId(null);
      setRoundResult(null);
      setCinematicText("");
      setAiChoices({});
      setAllChoicesReady(false);
      setDiceResult(null);
      
      generateAIChoices();
      startTimer();
      
      Animated.timing(phaseAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
    
    return stopTimer;
  }, [sceneIndex, loadingScenes]);

  // 등급에 따라 색상을 반환하는 함수
  const getGradeColor = (grade: Grade) => {
    switch (grade) {
      case "SP": return "#FFD700"; // 골드
      case "S": return "#4CAF50";  // 그린
      case "F": return "#F44336";  // 레드
      case "SF": return "#B00020"; // 다크 레드
      default: return "#E0E0E0";
    }
  };

  // 등급에 따라 텍스트를 반환하는 함수
  const getGradeText = (grade: Grade) => {
    switch (grade) {
      case "SP": return "치명적 대성공 (SP)";
      case "S": return "성공 (S)";
      case "F": return "실패 (F)";
      case "SF": return "치명적 실패 (SF)";
      default: return "알 수 없음";
    }
  };
  
  // (이하 렌더링 로직)
  // 로딩 중
  if (loadingScenes) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E2C044" />
        <Text style={styles.subtitle}>씬 데이터를 불러오는 중...</Text>
      </View>
    );
  }

  // 로딩 에러
  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.warn}>씬 데이터 로딩 실패</Text>
        <Text style={styles.subtitle}>{loadError}</Text>
        <TouchableOpacity 
          style={styles.retryBtn}
          onPress={fetchScenes}
        >
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 게임 데이터가 없는 경우
  if (!roundSpec || !myRole) {
    return (
      <View style={styles.center}>
        <Text style={styles.warn}>게임 데이터를 불러올 수 없습니다.</Text>
        <Text style={styles.subtitle}>
          {sceneTemplates.length === 0 ? "씬 템플릿이 없습니다." : "현재 씬에 대한 역할을 찾을 수 없습니다."}
        </Text>
        <TouchableOpacity 
          style={styles.retryBtn}
          onPress={fetchScenes}
        >
        <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const myChoices = roundSpec.choices[myRole] ?? [];
  const title = roundSpec.title;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContainer}>
        <View style={styles.characterPanel}>
          <Text style={styles.characterName}>{selectedCharacter.name}</Text>
          <Image
            source={selectedCharacter.image}
            style={styles.characterImage}
            resizeMode="contain"
          />
          <Text style={styles.roleText}>{myRole}</Text>
          <View style={styles.statsBox}>
            <Text style={styles.statsTitle}>능력치</Text>
            {Object.entries(selectedCharacter.stats).map(([stat, value]) => (
              <Text key={stat} style={styles.statText}>
                {stat}: <Text style={{ color: "#E2C044", fontWeight: "bold" }}>{value}</Text>
              </Text>
            ))}
          </View>
        </View>

        {/* 게임 패널 */}
        <View style={styles.gamePanel}>
          {/* 페이즈별 Animated.View 적용 */}
          {phase === "choice" && (
            <Animated.View style={[styles.contentBox, { opacity: phaseAnim }]}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>
                {selectedCharacter.name} — {myRole} | 남은 시간: {remaining}s
              </Text>

              <View style={styles.timerContainer}>
                <Animated.View 
                  style={[
                    styles.timerBar, 
                    { 
                      width: timerAnim.interpolate({
                        inputRange: [0, turnSeconds],
                        outputRange: ['0%', '100%']
                      })
                    }
                  ]} 
                />
              </View>

              <Text style={styles.timerText}>남은 시간: {remaining}s</Text>

              {Object.keys(aiChoices).length > 0 && (
                <View style={styles.aiStatusBox}>
                  <Text style={styles.aiStatusTitle}>AI 캐릭터 선택 완료:</Text>
                  {Object.entries(aiChoices).map(([role, choiceId]) => (
                    <Text key={role} style={styles.aiStatusText}>
                      {role}: 선택 완료 ({choiceId})
                    </Text>
                  ))}
                </View>
              )}

              <View style={{ height: 16 }} />

              {myChoices.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.choiceBtn,
                    myChoiceId === c.id && styles.selectedChoiceBtn,
                  ]}
                  disabled={!!myChoiceId || submitting}
                  onPress={() => submitChoice(c.id)}
                >
                  <Text style={styles.choiceText}>{c.text}</Text>
                  <Text style={styles.hint}>
                    적용 스탯: {c.appliedStat} (보정: {c.modifier >= 0 ? `+${c.modifier}` : c.modifier})
                  </Text>
                </TouchableOpacity>
              ))}

              {!myChoiceId && (
                <TouchableOpacity style={styles.secondary} onPress={autoPickAndSubmit}>
                  <Text style={styles.secondaryText}>아무거나 고르기(랜덤)</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          )}

          {phase === "sync" && (
            <Animated.View style={[styles.center, { opacity: phaseAnim }]}>
              <ActivityIndicator size="large" />
              <Text style={styles.subtitle}>결과를 처리하는 중…</Text>
            </Animated.View>
          )}

          {phase === "dice_roll" && (
            <Animated.View style={[styles.center, { opacity: phaseAnim }]}>
              <Text style={styles.title}>주사위 판정</Text>
              <View style={{ height: 16 }} />
              {isRolling ? (
                <Animated.View style={{ transform: [{ rotate: spin }], marginBottom: 20 }}>
                  <Text style={{ fontSize: 50 }}>🎲</Text>
                </Animated.View>
              ) : (
                <TouchableOpacity style={styles.primary} onPress={startDiceRoll}>
                  <Text style={styles.primaryText}>주사위 굴리기</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          )}

          {phase === "cinematic" && (
            <Animated.View style={[styles.contentBox, { opacity: phaseAnim }]}>
              <Text style={styles.title}>{title}</Text>
              {diceResult && <Text style={styles.resultText}>{diceResult}</Text>}
              <ScrollView style={styles.cinematicBox}>
                <Text style={styles.cinematicText}>{cinematicText}</Text>
              </ScrollView>

              {/* ✅ 추가: 결과 상세 보기 버튼 */}
              <TouchableOpacity
                style={styles.secondary}
                onPress={() => setIsResultsModalVisible(true)}
              >
                <Text style={styles.secondaryText}>결과 상세 보기</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primary}
                onPress={() => {
                  const currentScene = getSceneTemplate(sceneTemplates, sceneIndex);
                  if (!currentScene) {
                    setPhase("end");
                    return;
                  }

                  const roundSpec = currentScene.round;
                  if (!roundSpec || !roundSpec.nextScene) { 
                    const nextIndex = sceneIndex + 1;
                    if (nextIndex < sceneTemplates.length) {
                      setSceneIndex(nextIndex);
                      setPhase("intro");
                    } else {
                      setPhase("end");
                    }
                    return;
                  }

                  const { routes, fallback } = roundSpec.nextScene;
                  let nextSceneIndex: number | null = null;

                  if (routes) {
                    for (const route of routes) {
                      let isMatch = true;
                      for (const [role, condition] of Object.entries(route.when)) {
                        const result = roundResult?.results.find(r => r.role === role);
                        if (!condition || !result) {
                          isMatch = false;
                          break;
                        }
                        if (condition.grade && !condition.grade.includes(result.grade)) {
                          isMatch = false;
                          break;
                        }
                        if (condition.choiceId && !condition.choiceId.includes(result.choiceId)) {
                          isMatch = false;
                          break;
                        }
                      }
                      if (isMatch) {
                        const goto = route.gotoIndex;
                        if (typeof goto === "string" && goto === "+1") {
                          nextSceneIndex = sceneIndex + 1;
                        } else if (typeof goto === "number") {
                          nextSceneIndex = goto;
                        }
                        break;
                      }
                    }
                  }

                  if (nextSceneIndex === null) {
                    if (fallback === "end") {
                      setPhase("end");
                      return;
                    }
                    if (typeof fallback === "number") {
                      nextSceneIndex = fallback;
                    } else if (typeof fallback === "string" && fallback === "+1") {
                      nextSceneIndex = sceneIndex + 1;
                    } else {
                      nextSceneIndex = sceneIndex + 1;
                    }
                  }

                  if (nextSceneIndex !== null && nextSceneIndex < sceneTemplates.length) {
                    setRoundResult(null);
                    setCinematicText("");
                    setMyChoiceId(null);
                    setAiChoices({});
                    setAllChoicesReady(false);
                    setSceneIndex(nextSceneIndex);
                    setPhase("intro");
                  } else {
                    setPhase("end");
                  }
                }}
              >
                <Text style={styles.primaryText}>다음 ▶</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {phase === "end" && (
            <Animated.View style={[styles.center, { opacity: phaseAnim }]}>
              <Text style={styles.title}>엔딩</Text>
              <Text style={styles.subtitle}>수고하셨습니다!</Text>
            </Animated.View>
          )}
        </View>
      </View>
      
      {/* ✅ 단일 부모 요소 내에 배치: mainContainer 바깥에 위치 */}
      <TouchableOpacity style={styles.returnButton} onPress={handleReturnToRoom}>
        <Ionicons name="exit-outline" size={24} color="#E0E0E0" />
      </TouchableOpacity>

      {/* 게임 종료 확인 모달 */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)} // 안드로이드 뒤로가기 버튼 처리
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>방으로 돌아가기</Text>
            <Text style={styles.modalMessage}>
              정말로 게임을 중단하고 방으로 돌아가시겠습니까?{"\n"}
              현재 게임 상태는 초기화됩니다.
            </Text>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmReturnToRoom}
              >
                <Text style={styles.modalButtonText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* ✅ 추가: 결과 상세 보기 모달 */}
      <Modal
        visible={isResultsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsResultsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>라운드 결과 요약</Text>
            <ScrollView style={styles.resultsScrollView}>
              {roundResult?.results?.map((result, index) => {
                const choiceText = roundSpec?.choices?.[result.role]?.find(c => c.id === result.choiceId)?.text || "선택 정보를 찾을 수 없음";
                return (
                  <View key={index} style={styles.resultItem}>
                    <Text style={styles.resultRole}>{result.role}</Text>
                    <Text style={styles.resultDetails}>
                      - 선택: "{choiceText}"
                    </Text>
                    <Text style={styles.resultDetails}>
                      - 판정: d20({result.dice}) + 스탯({result.statValue}) + 보정({result.modifier}) = 총합 {result.total}
                    </Text>
                    <Text style={[styles.resultGrade, { color: getGradeColor(result.grade) }]}>
                      ⭐ 등급: {getGradeText(result.grade)}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsResultsModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B1021",
  },
  mainContainer: {
    flex: 1,
    flexDirection: "row",
    padding: 20,
    gap: 20,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  warn: {
    color: "#ff6b6b",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  subtitle: {
    color: "#D4D4D4",
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
  // 새로운 스타일: 캐릭터 정보 패널
  characterPanel: {
    width: "30%", // 화면 너비의 30%
    backgroundColor: "#161B2E",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
  },
  characterImage: {
    width: "100%",
    height: 180,
  },
  characterName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#E0E0E0",
    marginBottom: 8,
  },
  roleText: {
    fontSize: 16,
    color: "#A0A0A0",
    fontStyle: "italic",
    marginBottom: 10,
  },
  statsBox: {
    width: "100%",
    marginTop: 15,
    padding: 15,
    backgroundColor: "#0B1021",
    borderRadius: 12,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#E0E0E0",
    marginBottom: 8,
    textAlign: "center",
  },
  statText: {
    color: "#D4D4D4",
    fontSize: 14,
    lineHeight: 22,
  },
  // 새로운 스타일: 게임 콘텐츠 패널
  gamePanel: {
    flex: 1, // 남은 공간 모두 사용
  },
  // 기존 스타일을 gamePanel에 맞게 조정
  contentBox: {
    flex: 1,
    backgroundColor: "#161B2E",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
  },
  title: {
    color: "#E0E0E0",
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  // 타이머 관련 스타일
  timerContainer: {
    height: 8,
    backgroundColor: "#333",
    borderRadius: 4,
    marginTop: 10,
    overflow: "hidden",
  },
  timerBar: {
    height: "100%",
    backgroundColor: "#7C3AED",
  },
  timerText: {
    color: "#888",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  // 선택 버튼 스타일 개선
  choiceBtn: {
    backgroundColor: "#2C344E",
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#444",
  },
  selectedChoiceBtn: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  choiceText: {
    color: "#E0E0E0",
    fontSize: 16,
    fontWeight: "bold",
  },
  hint: {
    color: "#A0A0A0",
    marginTop: 6,
    fontSize: 12,
  },
  secondary: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#666",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryText: {
    color: "#ddd",
    fontWeight: "bold",
  },
  primary: {
    marginTop: 20,
    backgroundColor: "#7C3AED",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  // 시네마틱 박스 스타일 개선
  cinematicBox: {
    flex: 1,
    marginTop: 16,
    backgroundColor: "#222736",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#444",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  cinematicText: {
    color: "#E0E0E0",
    fontSize: 15,
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: "#4CAF50",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontWeight: "bold",
  },
  // AI 상태 표시용 스타일
  aiStatusBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "rgba(76, 175, 80, 0.2)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  aiStatusTitle: {
    color: "#4CAF50",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  aiStatusText: {
    color: "#4CAF50",
    fontSize: 12,
    marginTop: 2,
  },
  resultText: {
    color: "#E0E0E0",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  returnButton: {
    position: 'absolute',
    top: 95,  
    right: 20, // ✅ 오른쪽에서 20px 떨어지게
    zIndex: 9999, // ✅ zIndex를 훨씬 더 높게 설정
    backgroundColor: 'rgba(44, 52, 78, 0.8)',
    padding: 8,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#444',
    justifyContent: 'center', // 아이콘 중앙 정렬
    alignItems: 'center',   // 아이콘 중앙 정렬
    width: 40,              // 버튼 크기 명확히 지정
    height: 40,             // 버튼 크기 명확히 지정
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    width: '40%',
    backgroundColor: '#161B2E',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#444',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E0E0E0',
    marginBottom: 15,
  },
  modalMessage: {
    fontSize: 16,
    color: '#D4D4D4',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 24,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  cancelButton: {
    backgroundColor: '#4A5568', // 회색 계열
  },
  confirmButton: {
    backgroundColor: '#E53E3E', // 빨간색 계열
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // ✅ 추가: 결과 상세 보기 모달 관련 스타일
  resultsScrollView: {
    maxHeight: 300,
    width: '100%',
    paddingHorizontal: 10,
  },
  resultItem: {
    backgroundColor: '#222736',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  resultRole: {
    color: '#E2C044',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  resultDetails: {
    color: '#D4D4D4',
    fontSize: 14,
    lineHeight: 20,
  },
  resultGrade: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  modalCloseButton: {
    marginTop: 20,
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    alignItems: 'center',
  },
});