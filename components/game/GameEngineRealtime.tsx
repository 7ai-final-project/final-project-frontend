// frontend/components/game/GameEngineRealtime.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, ActivityIndicator, Image, Animated,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { Character, endGame, getWebSocketNonce } from "@/services/api";
import {
  RoundResult, SceneRoundSpec, SceneTemplate, Grade, Choice,
  getStatValue, getStatLabel, normalizeToKo,
} from "@/util/ttrpg";

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
  const { myCharacter, allCharacters } = setupData;

  const wsRef = useRef<WebSocket | null>(null);
  const ws = wsRef.current;

  const [phase, setPhase] = useState<Phase>("intro");
  const [clickSound, setClickSound] = useState<Audio.Sound | null>(null);
  const [pageTurnSound, setPageTurnSound] = useState<Audio.Sound | null>(null);
  const [diceRollSound, setDiceRollSound] = useState<Audio.Sound | null>(null);

  const [currentScene, setCurrentScene] = useState<SceneTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [diceResult, setDiceResult] = useState<string | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;

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

        ws.onopen = () => {
          setIsLoading(true);
          ws?.send(JSON.stringify({
            type: "request_initial_scene",
            topic: Array.isArray(topic) ? topic[0] : topic,
            characters: allCharacters,
            isLoadedGame,
          }));
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

      const eff = getEffectFor(choice);
      const hasAdv = eff.advantage;

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

            {/* 능력치 */}
            <View style={styles.statsBox}>
              <Text style={styles.statsTitle}>능력치</Text>
              {displayStats.map(s => (
                <Text key={s.key} style={styles.statText}>
                  {s.label}: <Text style={{ color: "#E2C044", fontWeight: "bold" }}>{String(s.value)}</Text>
                </Text>
              ))}
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
