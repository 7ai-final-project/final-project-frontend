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
import { Character, charactersByTopic } from "@/data/characterData";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useWebSocket } from "@/components/context/WebSocketContext";
import { getSceneTemplate, renderSceneFromRound, getStatValue, statMapping,RoundResult, SceneRoundSpec, SceneTemplate, PerRoleResult, Grade } from "@/util/ttrpg";
import { endGame } from "@/services/api";
import { Audio } from "expo-av";

type Props = {
    roomId: string | string[];
    topic: string | string[];
    difficulty?: string | string[];
    selectedCharacter: Character;
    turnSeconds?: number;
};

type Phase = "intro" | "choice" | "sync" | "dice_roll" | "cinematic" | "end";

type EnglishStat = keyof typeof statMapping;

const statKrToEn = Object.fromEntries(
    Object.entries(statMapping).map(([en, kr]) => [kr, en])
);

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

    useEffect(() => {
        const loadSounds = async () => {
            try {
                const { sound: loadedClickSound } = await Audio.Sound.createAsync(
                    require('../../assets/sounds/click.mp3')
                );
                setClickSound(loadedClickSound);

                const { sound: loadedPageTurnSound } = await Audio.Sound.createAsync(
                    require('../../assets/sounds/page_turn.mp3')
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

        return () => {
            clickSound?.unloadAsync();
            pageTurnSound?.unloadAsync();
            diceRollSound?.unloadAsync();
        };
    }, []);
    

    const [sceneIndex, setSceneIndex] = useState(0);
    const [sceneTemplates, setSceneTemplates] = useState<SceneTemplate[]>([]);
    const [loadingScenes, setLoadingScenes] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [diceResult, setDiceResult] = useState<string | null>(null);
    const [isRolling, setIsRolling] = useState(false);
    const spinValue = useRef(new Animated.Value(0)).current;

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isResultsModalVisible, setIsResultsModalVisible] = useState(false);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
    });

    const phaseAnim = useRef(new Animated.Value(0)).current;

    const roundSpec: SceneRoundSpec | null = useMemo(() => {
        if (!sceneTemplates || sceneTemplates.length === 0) return null;
        const tpl = getSceneTemplate(sceneTemplates, sceneIndex);
        return tpl?.round ?? null;
    }, [sceneTemplates, sceneIndex]);

    const myRole = useMemo(() => {
        if (!sceneTemplates || sceneTemplates.length === 0) return null;
        const tpl = getSceneTemplate(sceneTemplates, sceneIndex);
        if (!tpl) return null;
        return tpl.roleMap?.[selectedCharacter.name] ?? null;
    }, [sceneTemplates, sceneIndex, selectedCharacter.name]);

    const [remaining, setRemaining] = useState(turnSeconds);
    const timerRef = useRef<NodeJS.Timeout | number | null>(null);
    const [myChoiceId, setMyChoiceId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [aiChoices, setAiChoices] = useState<{[role: string]: string}>({});
    const [allChoicesReady, setAllChoicesReady] = useState(false);

    const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
    const [cinematicText, setCinematicText] = useState<string>("");

    const timerAnim = useRef(new Animated.Value(turnSeconds)).current;

    const handleReturnToRoom = () => {
        setIsModalVisible(true);
    };

    const confirmReturnToRoom = async () => {
        setIsModalVisible(false);
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
        timerAnim.setValue(turnSeconds);
        Animated.timing(timerAnim, {
            toValue: 0,
            duration: turnSeconds * 1000,
            useNativeDriver: false,
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

    const rollDice = (sides: number = 20) => {
        return Math.floor(Math.random() * sides) + 1;
    };

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

            const myChoice = roundSpec?.choices[myRole!]?.find(c => c.id === myChoiceId);
            if (!myChoice) {
                setDiceResult("오류: 선택지를 찾을 수 없습니다.");
                setIsRolling(false);
                return;
            }

            const myDice = rollDice(20);
            const myAppliedStat = myChoice.appliedStat;
            const myAppliedStatKorean = myChoice.appliedStat;
            const myAppliedStatEnglish = statKrToEn[myAppliedStatKorean];
            const myStatValue = getStatValue(selectedCharacter, myAppliedStatEnglish as EnglishStat) ?? 0;
            const myModifier = myChoice.modifier;
            const myTotal = myDice + myStatValue + myModifier;
            const DC = getDC(difficulty);

            let myGrade: Grade = "F";
            let resultText = "";
            if (myDice === 20) {
                myGrade = "SP";
                resultText = "치명적 대성공 🎉 (Natural 20!)";
            } else if (myDice === 1) {
                myGrade = "SF";
                resultText = "치명적 실패 💀 (Natural 1...)";
            } else if (myTotal >= DC) {
                myGrade = "S";
                resultText = `성공 ✅ (목표 DC ${DC} 이상 달성)`;
            } else {
                myGrade = "F";
                resultText = `실패 ❌ (목표 DC ${DC} 미달)`;
            }

            // ✅ 수정: 표시되는 스탯 이름을 영문 키가 아닌 한글로 변경
            const myAppliedStatKr = statMapping[myAppliedStat] ?? myAppliedStat;
            setDiceResult(`🎲 d20: ${myDice} + ${myAppliedStatKorean}(${myStatValue}) + 보정(${myModifier}) = ${myTotal} → ${resultText}`);
            setIsRolling(false);

            const myResult: PerRoleResult = {
                role: myRole!,
                choiceId: myChoiceId!,
                grade: myGrade,
                dice: myDice,
                appliedStat: myAppliedStat,
                statValue: myStatValue,
                modifier: myModifier,
                total: myTotal,
            };

            // ✅ 수정: AI 결과 판정 로직
            const aiResults: PerRoleResult[] = Object.entries(aiChoices).map(([role, choiceId]) => {
                const choice = roundSpec?.choices[role]?.find(c => c.id === choiceId);
                if (!choice) {
                    return {
                        role: role, choiceId: choiceId, grade: "F",
                        dice: 1, appliedStat: "hp", statValue: 0, modifier: 0, total: 1,
                    };
                }

                const dice = rollDice(20);
                // ✅ 수정: AI 캐릭터의 스탯을 가져오는 로직 (임시)
                const aiCharacter = Object.values(charactersByTopic).flat().find(c => c.id === role);
                const appliedStatKorean = choice.appliedStat;
                const appliedStatEnglish = statKrToEn[appliedStatKorean];
                const statValue = aiCharacter ? getStatValue(aiCharacter, appliedStatEnglish as EnglishStat) ?? 0 : 2;
                const modifier = choice.modifier;
                const total = dice + statValue + modifier;

                let grade: Grade = "F";
                if (dice === 20) grade = "SP";
                else if (dice === 1) grade = "SF";
                else if (total >= DC) grade = "S";
                else grade = "F";

                return {
                    role: role,
                    choiceId: choiceId,
                    grade: grade,
                    dice: dice,
                    appliedStat: appliedStatKorean,
                    statValue: statValue,
                    modifier: modifier,
                    total: total,
                };
            });

            const finalResult: RoundResult = {
                sceneIndex: sceneIndex,
                results: [myResult, ...aiResults],
                logs: [`${myRole}이(가) 주사위 판정을 했습니다. 결과: ${resultText}`],
            };

            setRoundResult(finalResult);

            const tpl = getSceneTemplate(sceneTemplates, sceneIndex);
            if (tpl) {
                const text = renderSceneFromRound(tpl, finalResult);
                setCinematicText(text);
            }

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

    const autoPickAndSubmit = () => {
        if (!roundSpec || !myRole || submitting) return;
        const choices = roundSpec.choices[myRole] ?? [];
        if (choices.length === 0) return;
        const rnd = choices[Math.floor(Math.random() * choices.length)];
        submitChoice(rnd.id);
    };

    const generateAIChoices = () => {
        if (!roundSpec || !myRole) return;
        const newAiChoices: {[role: string]: string} = {};
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
        setSubmitting(true);
        setMyChoiceId(choiceId);
        console.log(`${myRole}이(가) ${choiceId} 선택함`);
        setTimeout(() => {
            setAllChoicesReady(true);
        }, 1000);
    };

    useEffect(() => {
        if (allChoicesReady) {
            stopTimer();
            Animated.timing(phaseAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start(() => {
                setPhase("dice_roll");
                setSubmitting(false);
                Animated.timing(phaseAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }).start();
            });
        }
    }, [allChoicesReady]);

    const fetchScenes = async () => {
        let timeoutId: NodeJS.Timeout | number | null = null;
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

    useEffect(() => {
        fetchScenes();
    }, []);

    useEffect(() => {
        if (loadingScenes || loadError) return;
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
    
    // (이하 렌더링 로직은 수정사항 없음)
    if (loadingScenes) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E2C044" />
                <Text style={styles.subtitle}>씬 데이터를 불러오는 중...</Text>
            </View>
        );
    }
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
                    {selectedCharacter.description && (
                        <Text style={styles.characterDescription}>
                            {selectedCharacter.description}
                        </Text>
                    )}
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

                <View style={styles.gamePanel}>
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
                                        적용 스탯: {statMapping[c.appliedStat] ?? c.appliedStat} (보정: {c.modifier >= 0 ? `+${c.modifier}` : c.modifier})
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

            <TouchableOpacity style={styles.returnButton} onPress={handleReturnToRoom}>
                <Ionicons name="exit-outline" size={24} color="#E0E0E0" />
            </TouchableOpacity>

            <Modal
                visible={isModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsModalVisible(false)}
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
                                // ✅ 수정: appliedStat 한글 매핑
                                const appliedStatKr = statMapping[result.appliedStat] ?? result.appliedStat;
                                return (
                                    <View key={index} style={styles.resultItem}>
                                        <Text style={styles.resultRole}>{result.role}</Text>
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
        top: 95,
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
});