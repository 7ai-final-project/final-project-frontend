// frontend/components/game/GameEngineRealtime.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, ActivityIndicator, Image, Animated,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
<<<<<<< HEAD
import { Audio } from "expo-av";
import { Character, endGame, getWebSocketNonce } from "@/services/api";
import {
  RoundResult, SceneRoundSpec, SceneTemplate, Grade, Choice,
  getStatValue, getStatLabel, normalizeToKo,
} from "@/util/ttrpg";
=======
import { useWebSocket } from "@/components/context/WebSocketContext";
// [수정] API 서비스에서 Character 타입과 endGame 함수만 import 합니다.
import { Character, endGame, getWebSocketNonce, Skill, Item } from "@/services/api";
import { getStatValue, statMapping, RoundResult, SceneRoundSpec, SceneTemplate, PerRoleResult, Grade, ShariBlock, World, PartyEntry } from "@/util/ttrpg";
import { Audio } from "expo-av";
import { useAuth } from "@/hooks/useAuth";
import ShariHud from "./ShariHud";
>>>>>>> origin/develop

type Props = {
  roomId: string | string[];
  topic: string | string[];
  difficulty?: string | string[];
  setupData: {
    myCharacter: Character;
    aiCharacters: Character[];
    allCharacters: Character[];
  };
  turnSeconds?: number;
  isLoadedGame: boolean;
};

type Phase = "intro" | "choice" | "sync" | "dice_roll" | "cinematic" | "end";

// 간단 스킬/아이템 타입
type Skill = {
  id?: string; name: string; desc?: string;
  appliesTo?: { stat?: string; tags?: string[] };
  bonus?: number; advantage?: boolean; cooldown?: number;
};
type Item = {
  id?: string; name: string; desc?: string; type?: "consumable" | "equip" | "misc";
  appliesTo?: { stat?: string; tags?: string[] };
  bonus?: number; advantage?: boolean; uses?: number;
};

const makeSafeId = (id: string | undefined, name: string, idx: number, prefix: string) =>
  String(id ?? `${prefix}_${name.replace(/\s+/g, "_")}_${idx}`);

export default function GameEngineRealtime({
  roomId, topic, difficulty = "초급", setupData, turnSeconds = 20, isLoadedGame,
}: Props) {
<<<<<<< HEAD
  const { myCharacter, allCharacters } = setupData;

  const wsRef = useRef<WebSocket | null>(null);
  const ws = wsRef.current;
=======
    // [수정] setupData에서 필요한 정보를 구조 분해 할당합니다.
    const { user } = useAuth();
    const { myCharacter, aiCharacters, allCharacters } = setupData;

    console.log("내 캐릭터 데이터:", JSON.stringify(myCharacter, null, 2));

    const wsRef = useRef<WebSocket | null>(null);
    const ws = wsRef?.current ?? null;
>>>>>>> origin/develop

  const [phase, setPhase] = useState<Phase>("intro");
  const [clickSound, setClickSound] = useState<Audio.Sound | null>(null);
  const [pageTurnSound, setPageTurnSound] = useState<Audio.Sound | null>(null);
  const [diceRollSound, setDiceRollSound] = useState<Audio.Sound | null>(null);

<<<<<<< HEAD
  const [currentScene, setCurrentScene] = useState<SceneTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [diceResult, setDiceResult] = useState<string | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;
=======
    const [clickSound, setClickSound] = useState<Audio.Sound | null>(null);
    const [pageTurnSound, setPageTurnSound] = useState<Audio.Sound | null>(null);
    const [diceRollSound, setDiceRollSound] = useState<Audio.Sound | null>(null);
    
    // [수정] sceneTemplates 배열 대신, 현재 씬 객체 하나만 관리합니다.
    const [currentScene, setCurrentScene] = useState<SceneTemplate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [isStatsVisible, setIsStatsVisible] = useState(true);
    const [isSkillsVisible, setIsSkillsVisible] = useState(true);
    const [isItemsVisible, setIsItemsVisible] = useState(true);
>>>>>>> origin/develop

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isResultsModalVisible, setIsResultsModalVisible] = useState(false);
  const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
  const [saveModalMessage, setSaveModalMessage] = useState("");
  const [isGeneratingNextScene, setIsGeneratingNextScene] = useState(false);

  const phaseAnim = useRef(new Animated.Value(0)).current;
  const timerAnim = useRef(new Animated.Value(turnSeconds)).current;

  const roundSpec: SceneRoundSpec | null = useMemo(
    () => currentScene?.round ?? null,
    [currentScene]
  );
  const myRole = useMemo(() => {
    if (!currentScene) return null;
    return (currentScene.roleMap as any)?.[(myCharacter as any).name] ?? null;
  }, [currentScene, myCharacter]);

  const [remaining, setRemaining] = useState(turnSeconds);
  const timerRef = useRef<number | null>(null);
  const [myChoiceId, setMyChoiceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [cinematicText, setCinematicText] = useState<string>("");

  // ── 스킬/아이템(배타적 선택) ─────────────────────────────────────
  const rawSkills: Skill[] = (myCharacter as any).skills ?? [];
  const rawItems: Item[]  = (myCharacter as any).items ?? [];
  const skills = rawSkills.map((s, i) => ({ ...s, id: makeSafeId(s.id, s.name, i, "skill") }));
  const items  = rawItems.map((it, i) => ({ ...it, id: makeSafeId(it.id, it.name, i, "item") }));

  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedSkill = useMemo(() => skills.find(s => s.id === selectedSkillId) ?? null, [selectedSkillId, skills]);
  const selectedItem = useMemo(() => items.find(i => i.id === selectedItemId) ?? null, [selectedItemId, items]);

  // 좌측 패널 능력치 표시: 캐릭터의 실제 stats 키를 기준으로
  const displayStats = useMemo(() => {
    const s = (myCharacter as any)?.stats ?? {};
    return Object.entries(s)
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => ({ key: k, label: getStatLabel(k), value: v as number }));
  }, [myCharacter]);

  // 적용 효과(한 번 판정에만)
  const getEffectFor = (choice: Choice) => {
    const target = selectedSkill ?? selectedItem;
    if (!target) return { bonus: 0, advantage: false, source: null as null | string };
    const ap = target.appliesTo ?? {};
    const statOk = !ap.stat || normalizeToKo(ap.stat) === normalizeToKo(choice.appliedStat);
    const tags = Array.isArray(choice.tags) ? choice.tags : [];
    const tagsOk = !ap.tags || ap.tags.some(t => tags.includes(t));
    if (!statOk || !tagsOk) return { bonus: 0, advantage: false, source: null };
    return {
      bonus: target.bonus ?? 0,
      advantage: !!target.advantage,
      source: selectedSkill ? `스킬: ${selectedSkill.name}` : `아이템: ${selectedItem?.name}`,
    };
  };

  // ── WS ───────────────────────────────────────────────────────────
  useEffect(() => {
    let ws: WebSocket | null = null;
    const connect = async () => {
      try {
        const nonceRes = await getWebSocketNonce();
        const nonce = nonceRes.data.nonce;
        const scheme = "ws";
        const backendHost = "127.0.0.1:8000";
        const url = `${scheme}://${backendHost}/ws/multi_game/${roomId}/?nonce=${nonce}`;
        ws = new WebSocket(url);
        wsRef.current = ws;

<<<<<<< HEAD
        ws.onopen = () => {
          setIsLoading(true);
          ws?.send(JSON.stringify({
            type: "request_initial_scene",
            topic: Array.isArray(topic) ? topic[0] : topic,
            characters: allCharacters,
            isLoadedGame,
          }));
=======
    const [usedItems, setUsedItems] = useState<Set<string>>(new Set()); // 사용한 아이템 이름 저장 (1회용)
    const [skillCooldowns, setSkillCooldowns] = useState<Record<string, number>>({}); // 스킬별 재사용 가능한 씬 인덱스 저장
    const [pendingUsage, setPendingUsage] = useState<{ type: 'skill' | 'item'; data: Skill | Item } | null>(null); // 다음 씬 요청 시 보낼 사용 정보
    const SKILL_COOLDOWN_SCENES = 2;

    const timerAnim = useRef(new Animated.Value(turnSeconds)).current;

    const [amIReadyForNext, setAmIReadyForNext] = useState(false);
    const [nextSceneReadyState, setNextSceneReadyState] = useState({ ready_users: [], total_users: 0 });
    const [turnWaitingState, setTurnWaitingState] = useState({ submitted_users: [], total_users: 0 });

    const [worldState, setWorldState] = useState<World | undefined>(undefined);
    const [partyState, setPartyState] = useState<PartyEntry[] | undefined>(undefined);
    const [shariBlockData, setShariBlockData] = useState<ShariBlock | undefined>(undefined);

    const [isHudModalVisible, setIsHudModalVisible] = useState(false);
    const [hasNewHudInfo, setHasNewHudInfo] = useState(false);

    useEffect(() => {
        if (shariBlockData?.update && Object.keys(shariBlockData.update).length > 0) {
            setHasNewHudInfo(true);
        }
    }, [shariBlockData]);

    useEffect(() => {
        let ws: WebSocket | null = null;

        const connect = async () => {
            try {
                const nonceResponse = await getWebSocketNonce();
                const nonce = nonceResponse.data.nonce;
                const scheme = "ws";
                const backendHost = "127.0.0.1:8000";
                const url = `${scheme}://${backendHost}/ws/multi_game/${roomId}/?nonce=${nonce}`;
                
                ws = new WebSocket(url);
                wsRef.current = ws;

                ws.onopen = () => {
                    console.log("✅ GameEngineRealtime WebSocket Connected");
                    setIsLoading(true);

                    // --- ⬇️ [핵심 수정] ⬇️ ---
                    // isLoadedGame 플래그를 기반으로 서버에 첫 장면을 요청합니다.
                    // 이제 'continue_game' 메시지는 사용하지 않습니다.
                    const logMessage = isLoadedGame
                        ? "🚀 (불러온 게임) 첫 장면을 요청합니다."
                        : "🚀 (새 게임) 첫 장면을 요청합니다.";
                    console.log(logMessage);

                    ws?.send(JSON.stringify({
                        type: "request_initial_scene",
                        topic: Array.isArray(topic) ? topic[0] : topic,
                        characters: allCharacters, // 캐릭터 전체 정보 전달
                        isLoadedGame: isLoadedGame,  // ✅ '깃발'을 여기에 포함하여 전송
                    }));
                };

                ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    console.log("GameEngine received message:", data);

                    if (data.type === "game_update" && data.payload.event === "turn_waiting") {
                        setTurnWaitingState(data.payload);
                    }

                    if (data.type === "game_update" && data.payload.event === "next_scene_ready_state_update") {
                        setNextSceneReadyState(data.payload);
                    }

                    if (data.type === "game_update" && data.payload.event === "scene_update") {
                        setCurrentScene(data.payload.scene);
                        setPhase("choice");
                        setMyChoiceId(null);
                        setRoundResult(null);
                        setCinematicText("");
                        setSubmitting(false);
                        setAiChoices({});
                        setIsLoading(false);
                        setPartyState(undefined);
                        setShariBlockData(undefined);
                        setIsGeneratingNextScene(false);
                        setAmIReadyForNext(false); // 👈 내 준비 상태 초기화
                        setNextSceneReadyState({ ready_users: [], total_users: 0 });
                        pageTurnSound?.replayAsync();
                        phaseAnim.setValue(0);
                        Animated.timing(phaseAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
                        } else if (data.type === "game_update" && data.payload.event === "game_loaded") {
                        const { scene, playerState } = data.payload;
                        setCurrentScene(scene); // 씬 정보 설정
 
                        // 불러온 스킬/아이템 상태 복원
                        if (playerState) {
                            setUsedItems(new Set(playerState.usedItems || [])); // Array를 Set으로 변환
                            setSkillCooldowns(playerState.skillCooldowns || {});
                        }
 
                        // 새 씬 시작과 동일한 공통 로직 수행
                        setPhase("choice");
                        setMyChoiceId(null);
                        setRoundResult(null);
                        setDiceResult(null);
                        setCinematicText("");
                        setSubmitting(false);
                        setAiChoices({});
                        setIsLoading(false);
                        setIsGeneratingNextScene(false);
                        pageTurnSound?.replayAsync();
                        phaseAnim.setValue(0);
                        Animated.timing(phaseAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

                    } else if (data.type === "game_update" && data.payload.event === "turn_resolved") {
                        const { narration, roundResult, world_update, party_update, shari, personal_narrations } = data.payload;
                        setCinematicText(narration);
                        setRoundResult(roundResult);
                        if (world_update) setWorldState(world_update);
                        if (party_update) setPartyState(party_update);
                        if (shari) setShariBlockData(shari);
                        setTurnWaitingState({ submitted_users: [], total_users: 0 }); // 대기 상태 초기화
                        setPhase("cinematic");
                        phaseAnim.setValue(0);
                        Animated.timing(phaseAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
                    } else if (data.type === "save_success") {
                        setSaveModalMessage(data.message);
                        setIsSaveModalVisible(true);
                    } else if (data.type === "error") {
                        setError(data.message);
                        setIsLoading(false);
                        setIsGeneratingNextScene(false);
                    }
                };

                ws.onerror = (error) => {
                    console.error("GameEngine WebSocket Error:", error);
                    setError("웹소켓 연결 중 오류가 발생했습니다.");
                    setIsLoading(false);
                };

                ws.onclose = () => {
                    console.log("❌ GameEngineRealtime WebSocket Disconnected");
                };

            } catch (error) {
                console.error("GameEngine WebSocket connection failed:", error);
                setError("웹소켓 서버에 연결할 수 없습니다.");
                setIsLoading(false);
            }
>>>>>>> origin/develop
        };
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === "game_update" && data.payload.event === "scene_update") {
            setCurrentScene(data.payload.scene);
            setPhase("choice"); setMyChoiceId(null);
            setRoundResult(null); setCinematicText("");
            setSubmitting(false); setIsLoading(false);
            setIsGeneratingNextScene(false);
            pageTurnSound?.replayAsync?.();
            phaseAnim.setValue(0);
            Animated.timing(phaseAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
          } else if (data.type === "game_update" && data.payload.event === "turn_resolved") {
            setCinematicText(data.payload.narration);
            setRoundResult(data.payload.roundResult);
            setPhase("cinematic");
            phaseAnim.setValue(0);
            Animated.timing(phaseAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
          } else if (data.type === "save_success") {
            setSaveModalMessage(data.message); setIsSaveModalVisible(true);
          } else if (data.type === "error") {
            setError(data.message); setIsLoading(false); setIsGeneratingNextScene(false);
          }
        };
        ws.onerror = (e) => {
          console.error("WS error:", e);
          setError("웹소켓 연결 중 오류가 발생했습니다.");
          setIsLoading(false);
        };
      } catch (e) {
        console.error("WS connect failed:", e);
        setError("웹소켓 서버에 연결할 수 없습니다.");
        setIsLoading(false);
      }
    };
    connect();
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      stopTimer();
    };
  }, [roomId, topic, setupData, isLoadedGame]);

  // ── 사운드 ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const { sound: s1 } = await Audio.Sound.createAsync(require("../../assets/sounds/click.mp3"));
        setClickSound(s1);
        const { sound: s2 } = await Audio.Sound.createAsync(require("../../assets/sounds/page_turn.mp3"));
        setPageTurnSound(s2);
        const { sound: s3 } = await Audio.Sound.createAsync(require("@/assets/sounds/dice_roll.mp3"));
        setDiceRollSound(s3);
      } catch (e) { console.error("sound load failed:", e); }
    };
    load();
    return () => { clickSound?.unloadAsync(); pageTurnSound?.unloadAsync(); diceRollSound?.unloadAsync(); };
  }, []);

  // ── 타이머 ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "choice" && !myChoiceId) startTimer();
    else stopTimer();
    return () => stopTimer();
  }, [phase, myChoiceId]);

  const startTimer = () => {
    stopTimer();
    setRemaining(turnSeconds);
    timerAnim.setValue(turnSeconds);
    Animated.timing(timerAnim, { toValue: 0, duration: turnSeconds * 1000, useNativeDriver: false }).start();
    // @ts-ignore
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { stopTimer(); autoPickAndSubmit(); return 0; }
        return r - 1;
      });
    }, 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    timerAnim.stopAnimation();
  };

  const getDC = (diff?: string | string[]) => {
    const d = Array.isArray(diff) ? diff[0] : diff;
    if (d === "중급") return 13;
    if (d === "상급") return 16;
    return 10;
  };
  const rollD20 = () => Math.floor(Math.random() * 20) + 1;

  const submitChoice = (choiceId: string) => {
    setMyChoiceId(choiceId);
    stopTimer();
    setPhase("dice_roll");
  };
  const autoPickAndSubmit = () => {
    const myChoices = roundSpec?.choices[myRole!] ?? [];
    if (submitting || myChoices.length === 0) return;
    const r = myChoices[Math.floor(Math.random() * myChoices.length)];
    submitChoice(r.id);
  };

  // ── 주사위 판정(배타적 버프 적용) ───────────────────────────────────
  const startDiceRoll = () => {
    diceRollSound?.replayAsync?.();
    setIsRolling(true); setDiceResult(null);
    Animated.loop(Animated.timing(spinValue, { toValue: 1, duration: 400, useNativeDriver: true })).start();

    setTimeout(() => {
      Animated.timing(spinValue, { toValue: 0, duration: 0, useNativeDriver: true }).stop();

      const choice = roundSpec?.choices[myRole!]?.find(c => c.id === myChoiceId) as Choice | undefined;
      if (!choice || !myRole || !wsRef.current) {
        setDiceResult("오류: 선택지를 찾을 수 없습니다."); setIsRolling(false); return;
      }

<<<<<<< HEAD
      const eff = getEffectFor(choice);
      const hasAdv = eff.advantage;
=======
            const playerResult: PerRoleResult = {
                role: myRole!,
                choiceId: myChoiceId!,
                grade: myGrade,
                dice: myDice,
                appliedStat: myAppliedStatKorean,
                statValue: myStatValue,
                modifier: myModifier,
                total: myTotal,
                characterName: myCharacter.name, // 내 캐릭터 이름 추가
                characterId: myCharacter.id,
            };
            
            setDiceResult(`🎲 d20: ${myDice} + ${myAppliedStatKorean}(${myStatValue}) + 보정(${myModifier}) = ${myTotal} → ${resultText}`);
            setIsRolling(false);
            
             ws.send(JSON.stringify({
                type: "submit_player_choice",
                player_result: playerResult,
                all_characters: allCharacters.map(c => ({
                    ...c,
                    role_id: currentScene?.roleMap[c.name]
                })),
            }));
>>>>>>> origin/develop

      let d1 = rollD20();
      if (hasAdv) { const d2 = rollD20(); d1 = Math.max(d1, d2); }

      const statKey = choice.appliedStat;
      const statValue = getStatValue(myCharacter, statKey);
      const total = d1 + statValue + choice.modifier + (eff.bonus ?? 0);
      const DC = getDC(difficulty);

      let grade: Grade = "F";
      let resultText = "";
      if (d1 === 20) { grade = "SP"; resultText = "치명적 대성공 🎉 (Natural 20!)"; }
      else if (d1 === 1) { grade = "SF"; resultText = "치명적 실패 💀 (Natural 1...)"; }
      else if (total >= DC) { grade = "S"; resultText = `성공 ✅ (목표 DC ${DC} 이상 달성)`; }
      else { grade = "F"; resultText = `실패 ❌ (목표 DC ${DC} 미달)`; }

      const playerResult = {
        role: myRole!, choiceId: myChoiceId!, grade, dice: d1, appliedStat: statKey,
        statValue, modifier: choice.modifier + (eff.bonus ?? 0), total,
        characterName: (myCharacter as any).name,
        usedSkillId: selectedSkill?.id ?? null, usedItemId: selectedItem?.id ?? null,
        usedEffects: { advantage: hasAdv, extraBonus: (eff.bonus ?? 0), source: eff.source },
      };

<<<<<<< HEAD
      const label = getStatLabel(statKey);
      const buffText = eff.source ? ` · ${eff.source}${hasAdv ? " (이점)" : ""}${eff.bonus ? `, +${eff.bonus}` : ""}` : "";
      setDiceResult(`🎲 d20: ${d1} + ${label}(${statValue}) + 보정(${choice.modifier}${eff.bonus ? ` +${eff.bonus}` : ""}) = ${total}${buffText}`);
      setIsRolling(false);

      wsRef.current.send(JSON.stringify({
        type: "submit_player_choice",
        player_result: playerResult,
        all_characters: allCharacters.map(c => ({ ...c, role_id: (currentScene as any)?.roleMap[c.name] })),
      }));

      // 다음 턴 대비 선택 리셋
      setSelectedSkillId(null);
      setSelectedItemId(null);
      setPhase("sync");
    }, 1400);
  };

  const handleNextScene = () => {
    if (!wsRef.current || !myRole || !myChoiceId || !currentScene || isGeneratingNextScene) return;
    setIsGeneratingNextScene(true);
    const myChoices = roundSpec?.choices[myRole] ?? [];
    const lastChoice = myChoices.find(c => c.id === myChoiceId);
    if (!lastChoice) { setIsGeneratingNextScene(false); return; }
    wsRef.current.send(JSON.stringify({
      type: "request_next_scene",
      history: { lastChoice: { role: myRole, text: lastChoice.text }, lastNarration: cinematicText, sceneIndex: currentScene.index }
    }));
  };

  const handleSaveGame = () => {
    if (!wsRef.current || !currentScene || !myRole || !myChoiceId) {
      setSaveModalMessage("저장할 수 있는 정보가 부족합니다."); setIsSaveModalVisible(true); return;
=======
    const autoPickAndSubmit = () => {
        if (submitting || myChoices.length === 0) return;
        const randomChoice = myChoices[Math.floor(Math.random() * myChoices.length)];
        submitChoice(randomChoice.id);
    };

    const handleUseSkill = (skill: Skill) => {
        if (!currentScene) return;
        const cooldownEndSceneIndex = currentScene.index + SKILL_COOLDOWN_SCENES;
        setSkillCooldowns(prev => ({ ...prev, [skill.name]: cooldownEndSceneIndex }));
        setPendingUsage({ type: 'skill', data: skill });
        Alert.alert("스킬 준비 완료", `'${skill.name}' 스킬을 다음 행동에 사용합니다.`);
    };

    const handleUseItem = (item: Item) => {
        setUsedItems(prev => new Set(prev).add(item.name));
        setPendingUsage({ type: 'item', data: item });
        Alert.alert("아이템 사용", `'${item.name}' 아이템을 사용했습니다. (1회성)`);
    };
    
    const handleReadyForNextScene = () => {
        if (!ws || !myRole || !myChoiceId || !currentScene || amIReadyForNext) return;

        setAmIReadyForNext(true); // 내 상태를 '준비됨'으로 변경
        setIsGeneratingNextScene(true); // UI를 '대기 중'으로 변경

        const myLastChoice = myChoices.find(c => c.id === myChoiceId);
        if (!myLastChoice) {
            setAmIReadyForNext(false);
            setIsGeneratingNextScene(false);
            return;
        }

        // ✅ [수정] 'ready_for_next_scene' 액션을 서버에 전송
        ws.send(JSON.stringify({
            type: "ready_for_next_scene",
            history: { 
                lastChoice: { role: myRole, text: myLastChoice.text },
                lastNarration: cinematicText,
                sceneIndex: currentScene.index,
                usage: pendingUsage,
            }
        }));
        setPendingUsage(null);
    };

    const handleSaveGame = () => {
        if (!ws || !currentScene || !myRole || !myChoiceId) {
            setSaveModalMessage("저장할 수 있는 정보가 부족합니다.");
            setIsSaveModalVisible(true);
            return;
        }

        const myCurrentChoices = roundSpec?.choices[myRole] ?? [];
        const selectedChoiceObj = myCurrentChoices.find(c => c.id === myChoiceId);

        if (!selectedChoiceObj) {
            setSaveModalMessage("선택한 항목을 찾을 수 없습니다.");
            setIsSaveModalVisible(true);
            return;
        }

        // 백엔드로 보낼 데이터를 지정된 포맷에 맞게 가공
        const choicesFormatted = myCurrentChoices.reduce((acc, choice, index) => {
            acc[index] = choice.text;
            return acc;
        }, {} as { [key: number]: string });
        
        const selectedChoiceFormatted = {
            [myCurrentChoices.indexOf(selectedChoiceObj)]: selectedChoiceObj.text
        };

        const saveData = {
            title: roundSpec?.title,
            description: roundSpec?.title, // 현재 템플릿에서는 title이 주된 설명이므로 동일하게 사용
            choices: choicesFormatted,
            selectedChoice: selectedChoiceFormatted,
            sceneIndex: currentScene.index,
            playerState: {
                usedItems: Array.from(usedItems), // Set을 Array로 변환하여 JSON 직렬화
                skillCooldowns: skillCooldowns,
            }
        };

        // 웹소켓으로 데이터 전송
        ws.send(JSON.stringify({
            type: "save_game_state",
            data: saveData
        }));
    };

    const getGradeColor = (grade: Grade) => {
        switch (grade) {
            case "SP": return "#FFD700";
            case "S": return "#4CAF50";
            case "F": return "#F44336";
            case "SF": return "#B00020";
            default: return "#E0E0E0";
        }
    };

    const getGradeText = (grade: Grade) => {
        switch (grade) {
            case "SP": return "치명적 대성공 (SP)";
            case "S": return "성공 (S)";
            case "F": return "실패 (F)";
            case "SF": return "치명적 실패 (SF)";
            default: return "알 수 없음";
        }
    };
    if (isLoading && !currentScene) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E2C044" />
                <Text style={styles.subtitle}>LLM이 새로운 세계를 창조하는 중...</Text>
            </View>
        );
    }
    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.warn}>오류 발생</Text>
                <Text style={styles.subtitle}>{error}</Text>
                <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={confirmReturnToRoom} // 오류 시 방으로 돌아가기
                >
                    <Text style={styles.retryText}>대기실로 돌아가기</Text>
                </TouchableOpacity>
            </View>
        );
    }
    
    // [수정] roundSpec과 myRole을 currentScene 기반으로 확인합니다.
    if (!roundSpec || !myRole) {
        return (
            <View style={styles.center}>
                <Text style={styles.warn}>게임 데이터를 불러올 수 없습니다.</Text>
                <Text style={styles.subtitle}>
                    현재 씬에 대한 정보를 받지 못했거나, 당신의 역할이 지정되지 않았습니다.
                </Text>
                <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={confirmReturnToRoom}
                >
                    <Text style={styles.retryText}>대기실로 돌아가기</Text>
                </TouchableOpacity>
            </View>
        );
>>>>>>> origin/develop
    }
    const myCurrentChoices = roundSpec?.choices[myRole] ?? [];
    const selectedChoiceObj = myCurrentChoices.find(c => c.id === myChoiceId);
    if (!selectedChoiceObj) { setSaveModalMessage("선택한 항목을 찾을 수 없습니다."); setIsSaveModalVisible(true); return; }

    const choicesFormatted = myCurrentChoices.reduce((acc, c, i) => ({ ...acc, [i]: c.text }), {} as any);
    const selectedChoiceFormatted = { [myCurrentChoices.indexOf(selectedChoiceObj)]: selectedChoiceObj.text };
    const saveData = { title: roundSpec?.title, description: roundSpec?.title, choices: choicesFormatted, selectedChoice: selectedChoiceFormatted, sceneIndex: currentScene.index };
    wsRef.current.send(JSON.stringify({ type: "save_game_state", data: saveData }));
  };

  const getGradeColor = (g: Grade) => g === "SP" ? "#FFD700" : g === "S" ? "#4CAF50" : g === "F" ? "#F44336" : "#B00020";
  const getGradeText  = (g: Grade) => g === "SP" ? "치명적 대성공 (SP)" : g === "S" ? "성공 (S)" : g === "F" ? "실패 (F)" : "치명적 실패 (SF)";

  // ── 렌더 ─────────────────────────────────────────────────────────────
  if (isLoading && !currentScene) {
    return (<View style={styles.center}><ActivityIndicator size="large" color="#E2C044" /><Text style={styles.subtitle}>LLM이 새로운 세계를 창조하는 중...</Text></View>);
  }
  if (error) {
    return (
<<<<<<< HEAD
      <View style={styles.center}>
        <Text style={styles.warn}>오류 발생</Text><Text style={styles.subtitle}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace(`/game/multi`)}>
          <Text style={styles.retryText}>대기실로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!roundSpec || !myRole) {
    return (
      <View style={styles.center}>
        <Text style={styles.warn}>게임 데이터를 불러올 수 없습니다.</Text>
        <Text style={styles.subtitle}>현재 씬 정보 또는 당신의 역할이 비어 있습니다.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace(`/game/multi`)}>
          <Text style={styles.retryText}>대기실로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }
=======
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.mainContainer}>
                <TouchableOpacity 
                    style={styles.hudIconContainer} 
                    onPress={() => {
                        setIsHudModalVisible(true);
                        setHasNewHudInfo(false); // 모달을 열면 '새 정보' 알림을 끔
                    }}
                >
                    <Ionicons name="information-circle-outline" size={28} color="#E0E0E0" />
                    {/* 새로운 정보가 있을 때 느낌표(!) 배지 표시 */}
                    {hasNewHudInfo && (
                        <View style={styles.notificationBadge}>
                            <Text style={styles.notificationText}>!</Text>
                        </View>
                    )}
                </TouchableOpacity>
                {/* [수정] selectedCharacter 대신 myCharacter 사용 */}
                <View style={styles.characterPanel}>
                    <Text style={styles.characterName}>{myCharacter.name}</Text>
                    <Image
                        source={myCharacter.image}
                        style={styles.characterImage}
                        resizeMode="contain"
                    />
                    {myCharacter.description && (
                        <Text style={styles.characterDescription}>
                            {myCharacter.description}
                        </Text>
                    )}

                   <ScrollView 
                       style={{width: '100%', flex: 1}} 
                       showsVerticalScrollIndicator={false}
                   >
                       <View style={styles.collapsibleContainer}>
                            <TouchableOpacity style={styles.collapsibleHeader} onPress={() => setIsStatsVisible(!isStatsVisible)}>
                                <Text style={styles.skillsItemsTitle}>능력치</Text>
                                <Ionicons name={isStatsVisible ? "chevron-up" : "chevron-down"} size={20} color="#E0E0E0" />
                            </TouchableOpacity>
                            {isStatsVisible && (
                                <View style={styles.collapsibleContent}>
                                    {Object.entries(myCharacter.stats).map(([stat, value]) => (
                                        <Text key={stat} style={styles.statText}>
                                            {stat}: <Text style={{ color: "#E2C044", fontWeight: "bold" }}>{value}</Text>
                                        </Text>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* ✨ 스킬 토글 섹션 */}
                        {myCharacter.skills && myCharacter.skills.length > 0 && (
                            <View style={styles.collapsibleContainer}>
                                <TouchableOpacity style={styles.collapsibleHeader} onPress={() => setIsSkillsVisible(!isSkillsVisible)}>
                                    <Text style={styles.skillsItemsTitle}>스킬</Text>
                                    <Ionicons name={isSkillsVisible ? "chevron-up" : "chevron-down"} size={20} color="#E0E0E0" />
                                </TouchableOpacity>
                                {isSkillsVisible && (
                                    <View style={styles.collapsibleContent}>
                                        {myCharacter.skills.map((skill) => {
                                            const isOnCooldown = (skillCooldowns[skill.name] ?? 0) > (currentScene?.index ?? 0);
                                            return (
                                                <View key={skill.name} style={styles.skillItem}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.skillItemName}>- {skill.name}</Text>
                                                        <Text style={styles.skillItemDesc}>{skill.description}</Text>
                                                    </View>
                                                    <TouchableOpacity 
                                                        style={[styles.useButton, (isOnCooldown || pendingUsage) && styles.disabledUseButton]}
                                                        disabled={isOnCooldown || !!pendingUsage}
                                                        onPress={() => handleUseSkill(skill)}
                                                    >
                                                        <Text style={styles.useButtonText}>
                                                            {isOnCooldown 
                                                                ? `대기중(${skillCooldowns[skill.name] - (currentScene?.index ?? 0)}턴)` 
                                                                : "사용"}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ✨ 아이템 토글 섹션 */}
                        {myCharacter.items && myCharacter.items.length > 0 && (
                            <View style={styles.collapsibleContainer}>
                                <TouchableOpacity style={styles.collapsibleHeader} onPress={() => setIsItemsVisible(!isItemsVisible)}>
                                    <Text style={styles.skillsItemsTitle}>아이템</Text>
                                    <Ionicons name={isItemsVisible ? "chevron-up" : "chevron-down"} size={20} color="#E0E0E0" />
                                </TouchableOpacity>
                                {isItemsVisible && (
                                    <View style={styles.collapsibleContent}>
                                        {myCharacter.items.map((item) => {
                                            const isUsed = usedItems.has(item.name);
                                            return (
                                                <View key={item.name} style={styles.skillItem}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.skillItemName}>- {item.name}</Text>
                                                        <Text style={styles.skillItemDesc}>{item.description}</Text>
                                                    </View>
                                                    <TouchableOpacity 
                                                        style={[styles.useButton, (isUsed || pendingUsage) && styles.disabledUseButton]}
                                                        disabled={isUsed || !!pendingUsage}
                                                        onPress={() => handleUseItem(item)}
                                                    >
                                                        <Text style={styles.useButtonText}>{isUsed ? "사용완료" : "사용"}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </View>
>>>>>>> origin/develop

  const myChoices = roundSpec.choices[myRole] ?? [];
  const title = roundSpec.title;

  const ActiveBuff = () => {
    const src = selectedSkill ? `스킬: ${selectedSkill.name}` : selectedItem ? `아이템: ${selectedItem.name}` : null;
    const eff = myChoices[0] ? getEffectFor(myChoices[0]) : { bonus: 0, advantage: false, source: null };
    if (!src) return null;
    return (
      <View style={styles.buffBar}>
        <Ionicons name="flame" size={16} color="#E2C044" />
        <Text style={styles.buffText}>
          {src} 적용 예정
          {eff.advantage ? " · 이점" : ""}{eff.bonus ? ` · 보정 +${eff.bonus}` : ""}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContainer}>
        {/* 좌측 패널(스크롤) */}
        <View style={styles.characterPanel}>
          <ScrollView contentContainerStyle={styles.characterPanelScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.characterName}>{(myCharacter as any).name}</Text>
            <Image source={(myCharacter as any).image} style={styles.characterImage} resizeMode="contain" />
            {(myCharacter as any).description && (<Text style={styles.characterDescription}>{(myCharacter as any).description}</Text>)}
            <Text style={styles.roleText}>{myRole}</Text>

<<<<<<< HEAD
            {/* 능력치 */}
            <View style={styles.statsBox}>
              <Text style={styles.statsTitle}>능력치</Text>
              {displayStats.map(s => (
                <Text key={s.key} style={styles.statText}>
                  {s.label}: <Text style={{ color: "#E2C044", fontWeight: "bold" }}>{String(s.value)}</Text>
                </Text>
              ))}
=======
                            <ScrollView style={{ flex: 1, width: '100%' }}>
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
                                            적용 스탯: {statMapping[c.appliedStat as EnglishStat] ?? c.appliedStat} (보정: {c.modifier >= 0 ? `+${c.modifier}` : c.modifier})
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {!myChoiceId && (
                                <TouchableOpacity style={styles.secondary} onPress={autoPickAndSubmit}>
                                    <Text style={styles.secondaryText}>아무거나 고르기(랜덤)</Text>
                                </TouchableOpacity>
                            )}
                        </Animated.View>
                    )}

                    {phase === "sync" && (
                        <Animated.View style={[styles.center, { opacity: phaseAnim }]}>
                            <ActivityIndicator size="large" color="#E2C044"/>
                            <Text style={styles.subtitle}>다른 플레이어의 행동을 기다리는 중...</Text>
                            {/* ✅ [추가] 대기 현황 텍스트 */}
                            <Text style={styles.subtitle}>
                                ({turnWaitingState.submitted_users.length}/{turnWaitingState.total_users}명 제출 완료)
                            </Text>
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

                            <TouchableOpacity
                                style={styles.secondary}
                                onPress={() => setIsResultsModalVisible(true)}
                            >
                                <Text style={styles.secondaryText}>결과 상세 보기</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                                style={styles.saveButton} // 새로운 스타일 적용 필요
                                onPress={handleSaveGame}
                            >
                                <Text style={styles.primaryText}>지금까지 내용 저장하기</Text>
                            </TouchableOpacity>

                            {/* [수정] 다음 씬으로 넘어가는 버튼 */}
                            <TouchableOpacity
                                style={[styles.primary, (amIReadyForNext || isGeneratingNextScene) && styles.disabledButton]}
                                onPress={handleReadyForNextScene}
                                disabled={amIReadyForNext || isGeneratingNextScene}
                            >
                                <Text style={styles.primaryText}>
                                    {amIReadyForNext ? "다른 플레이어 대기 중..." : "다음 이야기 준비 완료"}
                                </Text>
                            </TouchableOpacity>

                            {/* ✅ [추가] 현재 준비 상태를 보여주는 UI */}
                            {isGeneratingNextScene && (
                                <Text style={styles.subtitle}>
                                    ({nextSceneReadyState.ready_users.length}/{nextSceneReadyState.total_users}명 준비 완료)
                                </Text>
                            )}
                        </Animated.View>
                    )}

                    {phase === "end" && (
                        <Animated.View style={[styles.center, { opacity: phaseAnim }]}>
                            <Text style={styles.title}>엔딩</Text>
                            <Text style={styles.subtitle}>수고하셨습니다!</Text>
                            <TouchableOpacity style={styles.primary} onPress={confirmReturnToRoom}>
                                <Text style={styles.primaryText}>대기실로 돌아가기</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}
                </View>
>>>>>>> origin/develop
            </View>

            {/* 스킬 (배타적 선택) */}
            {(skills?.length ?? 0) > 0 && (
              <View style={styles.panelSection}>
                <Text style={styles.sectionTitle}>스킬</Text>
                {skills.map((s, idx) => {
                  const sid = s.id!;
                  const isSel = selectedSkillId === sid;
                  return (
                    <TouchableOpacity
                      key={sid}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSel }}
                      style={[styles.skillBtn, isSel && styles.skillBtnSelected]}
                      onPress={() => {
                        setSelectedSkillId(isSel ? null : sid);
                        setSelectedItemId(null); // 배타적
                        clickSound?.replayAsync?.();
                      }}
                    >
                      <View style={styles.skillRow}>
                        <Text style={styles.skillName}>{s.name}</Text>
                        {isSel ? <Ionicons name="checkmark-circle" size={18} color="#E2C044" /> : <View style={{ width: 18 }} />}
                      </View>
                      {!!s.desc && <Text style={styles.smallHint}>{s.desc}</Text>}
                      {(s.advantage || s.bonus) && (
                        <View style={styles.badgeRow}>
                          {s.advantage && <Text style={styles.badge}>이점</Text>}
                          {s.bonus ? <Text style={styles.badge}>+{s.bonus}</Text> : null}
                          {s.appliesTo?.stat && <Text style={styles.badge}>스탯:{getStatLabel(s.appliesTo.stat)}</Text>}
                          {s.appliesTo?.tags?.length ? <Text style={styles.badge}>태그:{s.appliesTo.tags.join(",")}</Text> : null}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

<<<<<<< HEAD
            {/* 아이템 (배타적 선택) */}
            {(items?.length ?? 0) > 0 && (
              <View style={styles.panelSection}>
                <Text style={styles.sectionTitle}>아이템</Text>
                {items.map((i, idx) => {
                  const iid = i.id!;
                  const isSel = selectedItemId === iid;
                  const disabled = typeof i.uses === "number" && i.uses <= 0;
                  return (
                    <TouchableOpacity
                      key={iid}
                      disabled={disabled}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSel, disabled }}
                      style={[styles.itemBtn, isSel && styles.itemBtnSelected, disabled && styles.itemBtnDisabled]}
                      onPress={() => {
                        setSelectedItemId(isSel ? null : iid);
                        setSelectedSkillId(null); // 배타적
                        clickSound?.replayAsync?.();
                      }}
                    >
                      <View style={styles.skillRow}>
                        <Text style={styles.skillName}>{i.name}{typeof i.uses === "number" ? ` (${i.uses})` : ""}</Text>
                        {isSel ? <Ionicons name="checkmark-circle" size={18} color="#E2C044" /> : <View style={{ width: 18 }} />}
                      </View>
                      {!!i.desc && <Text style={styles.smallHint}>{i.desc}</Text>}
                      {(i.advantage || i.bonus) && (
                        <View style={styles.badgeRow}>
                          {i.advantage && <Text style={styles.badge}>이점</Text>}
                          {i.bonus ? <Text style={styles.badge}>+{i.bonus}</Text> : null}
                          {i.appliesTo?.stat && <Text style={styles.badge}>스탯:{getStatLabel(i.appliesTo.stat)}</Text>}
                          {i.appliesTo?.tags?.length ? <Text style={styles.badge}>태그:{i.appliesTo.tags.join(",")}</Text> : null}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>

        {/* 우측 패널 */}
        <View style={styles.gamePanel}>
          {phase === "choice" && (
            <Animated.View style={[styles.contentBox, { opacity: phaseAnim }]}>
              <Text style={styles.title}>{title}</Text>
              <ScrollView style={styles.descriptionBox}><Text style={styles.descriptionText}>{roundSpec.description}</Text></ScrollView>
              <Text style={styles.subtitle}>{(myCharacter as any).name} — {myRole}</Text>

              {/* 활성 버프 바 */}
              <ActiveBuff />

              <View style={styles.timerContainer}>
                <Animated.View style={[styles.timerBar, {
                  width: timerAnim.interpolate({ inputRange: [0, turnSeconds], outputRange: ["0%", "100%"] }),
                }]} />
              </View>
              <Text style={styles.timerText}>남은 시간: {remaining}s</Text>

              <ScrollView style={{ flex: 1, width: "100%" }}>
                {myChoices.map((c) => {
                  const eff = getEffectFor(c);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.choiceBtn, myChoiceId === c.id && styles.selectedChoiceBtn]}
                      disabled={!!myChoiceId || submitting}
                      onPress={() => submitChoice(c.id)}
                    >
                      <Text style={styles.choiceText}>{c.text}</Text>
                      <View style={styles.choiceHintRow}>
                        <Text style={styles.hint}>
                          적용 스탯: {getStatLabel(c.appliedStat)} · 기본 보정 {c.modifier >= 0 ? `+${c.modifier}` : c.modifier}
=======
            <Modal
                visible={isResultsModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsResultsModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>라운드 결과 요약</Text>
                        <ScrollView 
                            style={styles.resultsScrollView}
                            showsVerticalScrollIndicator={false} 
                        >
                            {roundResult?.results?.map((result, index) => {
                                const choiceText = roundSpec?.choices?.[result.role]?.find(c => c.id === result.choiceId)?.text || "선택 정보를 찾을 수 없음";
                                const appliedStatKr = statMapping[result.appliedStat as EnglishStat] ?? result.appliedStat;
                                return (
                                    <View key={index} style={styles.resultItem}>
                                        <Text style={styles.resultRole}>
                                            {result.characterName} {result.characterName === myCharacter.name ? '(나)' : ''}
                                        </Text>
                                        <Text style={styles.resultDetails}>
                                            - 선택: "{choiceText}"
                                        </Text>
                                        <Text style={styles.resultDetails}>
                                            - 판정: d20({result.dice}) + {appliedStatKr}({result.statValue}) + 보정({result.modifier}) = 총합 {result.total}
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

            <Modal
                visible={isHudModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsHudModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    {/* ShariHud 컴포넌트를 모달 내부에 렌더링 */}
                    <ShariHud
                        world={worldState}
                        party={partyState}
                        shari={shariBlockData}
                        allCharacters={allCharacters}
                        onClose={() => setIsHudModalVisible(false)} // 닫기 버튼용 함수 전달
                    />
                </View>
            </Modal>

            <Modal
                visible={isSaveModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsSaveModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>알림</Text>
                        <Text style={styles.modalMessage}>
                            {saveModalMessage}
>>>>>>> origin/develop
                        </Text>
                        {(eff.advantage || eff.bonus) && (
                          <View style={styles.badgeRowRight}>
                            {eff.advantage && <Text style={styles.badge}>이점</Text>}
                            {eff.bonus ? <Text style={styles.badge}>+{eff.bonus}</Text> : null}
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {!myChoiceId && (
                <TouchableOpacity style={styles.secondary} onPress={autoPickAndSubmit}>
                  <Text style={styles.secondaryText}>아무거나 고르기(랜덤)</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          )}

          {phase === "sync" && (
            <Animated.View style={[styles.center, { opacity: phaseAnim }]}>
              <ActivityIndicator size="large" color="#E2C044"/>
              <Text style={styles.subtitle}>GM이 다음 이야기를 준비하는 중...</Text>
            </Animated.View>
          )}

          {phase === "dice_roll" && (
            <Animated.View style={[styles.center, { opacity: phaseAnim }]}>
              <Text style={styles.title}>주사위 판정</Text>
              <View style={{ height: 16 }} />
              {isRolling ? (
                <Animated.View style={{ transform: [{ rotate: spinValue.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }], marginBottom: 20 }}>
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
              <ScrollView style={styles.cinematicBox}><Text style={styles.cinematicText}>{cinematicText}</Text></ScrollView>

              <TouchableOpacity style={styles.secondary} onPress={() => setIsResultsModalVisible(true)}>
                <Text style={styles.secondaryText}>결과 상세 보기</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveGame}>
                <Text style={styles.primaryText}>지금까지 내용 저장하기</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.primary, isGeneratingNextScene && styles.disabledButton]} onPress={handleNextScene} disabled={isGeneratingNextScene}>
                <Text style={styles.primaryText}>{isGeneratingNextScene ? "이야기 생성 중..." : "다음 ▶"}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>

      {/* 나가기/결과/저장 모달 */}
      <TouchableOpacity style={styles.returnButton} onPress={() => setIsModalVisible(true)}>
        <Ionicons name="exit-outline" size={24} color="#E0E0E0" />
      </TouchableOpacity>

      <Modal visible={isModalVisible} transparent animationType="fade" onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>방으로 돌아가기</Text>
            <Text style={styles.modalMessage}>정말로 중단하고 방으로 돌아가시겠습니까?{"\n"}현재 게임 상태는 초기화됩니다.</Text>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.modalButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={async () => { setIsModalVisible(false); const id = Array.isArray(roomId) ? roomId[0] : roomId; try { await endGame(id); router.replace(`/game/multi/room/${id}`); } catch { router.replace(`/game/multi`); } }}>
                <Text style={styles.modalButtonText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isResultsModalVisible} transparent animationType="slide" onRequestClose={() => setIsResultsModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>라운드 결과 요약</Text>
            <ScrollView style={styles.resultsScrollView}>
              {roundResult?.results?.map((r, idx) => {
                const choiceText = roundSpec?.choices?.[r.role]?.find(c => c.id === r.choiceId)?.text || "선택 정보를 찾을 수 없음";
                const label = getStatLabel(r.appliedStat);
                return (
                  <View key={idx} style={styles.resultItem}>
                    <Text style={styles.resultRole}>{r.characterName} {r.characterName === (myCharacter as any).name ? "(나)" : ""}</Text>
                    <Text style={styles.resultDetails}>- 선택: "{choiceText}"</Text>
                    <Text style={styles.resultDetails}>- 판정: d20({r.dice}) + {label}({r.statValue}) + 보정({r.modifier}) = 총합 {r.total}</Text>
                    <Text style={[styles.resultGrade, { color: getGradeColor(r.grade) }]}>⭐ 등급: {getGradeText(r.grade)}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsResultsModalVisible(false)}>
              <Text style={styles.modalButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isSaveModalVisible} transparent animationType="fade" onRequestClose={() => setIsSaveModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>알림</Text>
            <Text style={styles.modalMessage}>{saveModalMessage}</Text>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsSaveModalVisible(false)}>
              <Text style={styles.modalButtonText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  safeArea: { flex: 1, backgroundColor: "#0B1021" },
  mainContainer: { flex: 1, flexDirection: "row", padding: 20, gap: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  warn: { color: "#ff6b6b", fontSize: 18, fontWeight: "bold", textAlign: "center" },
  subtitle: { color: "#D4D4D4", fontSize: 14, marginTop: 4, textAlign: "center" },

  characterPanel: { width: "30%", backgroundColor: "#161B2E", borderRadius: 20, padding: 20, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 8 },
  characterPanelScroll: { paddingBottom: 24 },
  characterImage: { width: "100%", height: 180 },
  characterName: { fontSize: 22, fontWeight: "bold", color: "#E0E0E0", marginBottom: 8 },
  characterDescription: { fontSize: 14, color: "#A0A0A0", textAlign: "center", marginBottom: 10, lineHeight: 20 },
  roleText: { fontSize: 16, color: "#A0A0A0", fontStyle: "italic", marginBottom: 10 },

  statsBox: { width: "100%", marginTop: 15, padding: 15, backgroundColor: "#0B1021", borderRadius: 12 },
  statsTitle: { fontSize: 16, fontWeight: "bold", color: "#E0E0E0", marginBottom: 8, textAlign: "center" },
  statText: { color: "#D4D4D4", fontSize: 14, lineHeight: 22 },

  // 스킬/아이템 카드: 선택/비선택을 명확히
  panelSection: { width: "100%", marginTop: 14, padding: 12, backgroundColor: "#0B1021", borderRadius: 12, borderWidth: 1, borderColor: "#1e2542", gap: 8 },
  sectionTitle: { color: "#E0E0E0", fontWeight: "bold", fontSize: 16, marginBottom: 4 },

  skillBtn: { backgroundColor: "#1A2036", borderWidth: 1, borderColor: "#2C344E", borderRadius: 12, padding: 12 },
  skillBtnSelected: { backgroundColor: "rgba(124,58,237,0.25)", borderColor: "#7C3AED", shadowColor: "#7C3AED", shadowOpacity: 0.35, shadowRadius: 8 },
  itemBtn: { backgroundColor: "#161E33", borderWidth: 1, borderColor: "#2C344E", borderRadius: 12, padding: 12 },
  itemBtnSelected: { backgroundColor: "rgba(30,144,255,0.18)", borderColor: "#1D9BF0", shadowColor: "#1D9BF0", shadowOpacity: 0.35, shadowRadius: 8 },
  itemBtnDisabled: { opacity: 0.5 },

  skillRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skillName: { color: "#E0E0E0", fontWeight: "700", fontSize: 15 },
  smallHint: { color: "#A0A0A0", fontSize: 12, marginTop: 6 },

  badgeRow: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  badgeRowRight: { flexDirection: "row", gap: 6, marginLeft: 8 },
  badge: { color: "#0B1021", backgroundColor: "#E2C044", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 11, overflow: "hidden" },

  gamePanel: { flex: 1 },
  contentBox: { flex: 1, backgroundColor: "#161B2E", borderRadius: 20, padding: 20, shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 8 },
  title: { color: "#E0E0E0", fontSize: 26, fontWeight: "bold", marginBottom: 8, textAlign: "center" },

  // 버프 바
  buffBar: { marginTop: 8, marginBottom: 6, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(124,58,237,0.12)",
    borderWidth: 1, borderColor: "#7C3AED", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  buffText: { color: "#E2C044", fontSize: 12 },

  timerContainer: { height: 8, backgroundColor: "#333", borderRadius: 4, marginTop: 10, overflow: "hidden" },
  timerBar: { height: "100%", backgroundColor: "#7C3AED" },
  timerText: { color: "#888", fontSize: 12, textAlign: "center", marginTop: 4 },

  choiceBtn: { backgroundColor: "#2C344E", padding: 16, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: "#444" },
  selectedChoiceBtn: { backgroundColor: "#4CAF50", borderColor: "#4CAF50" },
  choiceText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  choiceHintRow: { marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hint: { color: "#A0A0E0", fontSize: 12 },

  secondary: { marginTop: 16, borderWidth: 1, borderColor: "#666", paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  secondaryText: { color: "#ddd", fontWeight: "bold" },
  primary: { marginTop: 20, backgroundColor: "#7C3AED", paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  disabledButton: { backgroundColor: "#5A5A5A" },

  cinematicBox: { flex: 1, marginTop: 16, backgroundColor: "#222736", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#444",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  cinematicText: { color: "#E0E0E0", fontSize: 15, lineHeight: 22 },

  retryBtn: { marginTop: 16, backgroundColor: "#4CAF50", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: "#fff", fontWeight: "bold" },

  resultText: { color: "#E0E0E0", fontSize: 18, fontWeight: "bold", textAlign: "center", marginBottom: 20 },

  returnButton: { position: "absolute", top: 95, right: 20, zIndex: 9999, backgroundColor: "rgba(44, 52, 78, 0.8)",
    padding: 8, borderRadius: 50, borderWidth: 1, borderColor: "#444", justifyContent: "center", alignItems: "center", width: 40, height: 40 },

  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.7)" },
  modalContent: { width: "40%", backgroundColor: "#161B2E", borderRadius: 20, padding: 25, alignItems: "center", borderWidth: 1, borderColor: "#444" },
  modalTitle: { fontSize: 22, fontWeight: "bold", color: "#E0E0E0", marginBottom: 15 },
  modalMessage: { fontSize: 16, color: "#D4D4D4", textAlign: "center", marginBottom: 25, lineHeight: 24 },
  modalButtonContainer: { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", marginHorizontal: 10 },
  cancelButton: { backgroundColor: "#4A5568" },
  confirmButton: { backgroundColor: "#E53E3E" },
  modalButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },

  resultsScrollView: { maxHeight: 300, width: "100%", paddingHorizontal: 10 },
  resultItem: { backgroundColor: "#222736", borderRadius: 10, padding: 15, marginBottom: 10 },
  resultRole: { color: "#E2C044", fontSize: 18, fontWeight: "bold", marginBottom: 5 },
  resultDetails: { color: "#D4D4D4", fontSize: 14, lineHeight: 20 },
  resultGrade: { fontSize: 16, fontWeight: "bold", marginTop: 8 },

  modalCloseButton: { marginTop: 20, backgroundColor: "#7C3AED", paddingVertical: 12, paddingHorizontal: 25, borderRadius: 10, alignItems: "center" },

  descriptionBox: { maxHeight: 100, marginVertical: 12, padding: 12, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 8 },
  descriptionText: { color: "#D4D4D4", fontSize: 15, lineHeight: 22 },

  saveButton: { marginTop: 12, backgroundColor: "#1D4ED8", paddingVertical: 14, borderRadius: 10, alignItems: "center" },
});
=======
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
    characterPanel: {
        width: "30%",
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
    characterDescription: {
        fontSize: 14,
        color: "#A0A0A0",
        textAlign: "center",
        marginBottom: 10,
        lineHeight: 20,
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
    skillsItemsBox: {
        width: "100%",
        marginBottom: 15,
        padding: 15,
        backgroundColor: "#0B1021",
        borderRadius: 12,
    },
    skillItem: {
        marginBottom: 12,
        flexDirection: 'row', // 가로 정렬
        alignItems: 'center', // 세로 중앙 정렬
        justifyContent: 'space-between',
    },
    skillItemName: {
        color: "#E2C044", // 노란색으로 강조
        fontWeight: "bold",
        fontSize: 14,
        marginBottom: 4,
    },
    skillItemDesc: {
        color: "#A0A0A0", // 회색으로 설명 표시
        fontSize: 13,
        lineHeight: 18,
        paddingLeft: 8, // 이름과 맞추기 위해 살짝 들여쓰기
    },
    useButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginLeft: 10,
    },
    disabledUseButton: {
        backgroundColor: '#5A5A5A',
    },
    useButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 12,
    },
    gamePanel: {
        flex: 1,
    },
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
        color: "#FFFFFF", 
        fontSize: 16,
        fontWeight: "bold",
    },
    hint: {
        color: "#A0A0E0",
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
    disabledButton: {
        backgroundColor: '#5A5A5A',
    },
    saveButton: { // [추가] 저장 버튼 스타일
        marginTop: 12,
        backgroundColor: "#1D4ED8", // 다른 색상으로 구분
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: "center",
    },
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
        top: 145,
        right: 20,
        zIndex: 9999,
        backgroundColor: 'rgba(44, 52, 78, 0.8)',
        padding: 8,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: '#444',
        justifyContent: 'center',
        alignItems: 'center',
        width: 40,
        height: 40,
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
        backgroundColor: '#4A5568',
    },
    confirmButton: {
        backgroundColor: '#E53E3E',
    },
    modalButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
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
    descriptionBox: {
        maxHeight: 100, // 설명이 너무 길 경우를 대비해 최대 높이 설정
        marginVertical: 12,
        padding: 12,
        backgroundColor: "rgba(0,0,0,0.2)",
        borderRadius: 8,
    },
    descriptionText: {
        color: '#D4D4D4',
        fontSize: 15,
        lineHeight: 22,
    },
    collapsibleContainer: {
        width: "100%",
        backgroundColor: "#0B1021",
        borderRadius: 12,
        marginBottom: 15,
        padding: 15,
    },
    collapsibleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    collapsibleContent: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#444',
    },
    skillsItemsTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#E0E0E0",
    },
    hudIconContainer: {
        position: 'absolute',
        top: 90,
        right: 20,
        zIndex: 100,
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(44, 52, 78, 0.8)',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#444',
    },
    notificationBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#E53E3E',
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
});
>>>>>>> origin/develop
