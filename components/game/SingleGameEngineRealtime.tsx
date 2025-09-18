// frontend\components\game\SingleGameEngineRealtime.tsx

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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Character, Skill, Item, getInitialScene, saveGame, resolveTurn, getNextScene } from "@/services/api";
import { getStatValue, statMapping, RoundResult, SceneRoundSpec, SceneTemplate, PerRoleResult, Grade, ShariBlock, World, PartyEntry } from "@/util/ttrpg";
import { Audio } from "expo-av";
import ShariHud from "./ShariHud";

interface LoadedSessionData {
    choice_history: any;
    character_history: any;
}

interface Props {
    topic: string | string[];
    difficulty?: string | string[];
    genre?: string | string[];
    mode?: string | string[];
    setupData: {
        myCharacter: Character;
        aiCharacters: Character[];
        allCharacters: Character[];
    };
    isLoadedGame: boolean;
    initialScene?: SceneTemplate | null;
    initialGameState?: any | null;
    initialPlayerState?: { usedItems: string[], skillCooldowns: Record<string, number> } | null;
    turnSeconds?: number;
};
type Phase = "intro" | "choice" | "dice_roll" | "cinematic" | "end";
type EnglishStat = keyof typeof statMapping;

const statKrToEn = Object.fromEntries(
    Object.entries(statMapping).map(([en, kr]) => [kr, en])
);

export default function GameEngineRealtime({
    topic,
    difficulty = "초급",
    genre = "판타지",
    mode = "동시 선택",
    setupData,
    isLoadedGame,
    initialScene = null,
    initialGameState = null,
    initialPlayerState = null,
    turnSeconds = 20,
}: Props) {
    const { myCharacter, aiCharacters, allCharacters } = setupData;

    console.log("내 캐릭터 데이터:", JSON.stringify(myCharacter, null, 2));

    const [phase, setPhase] = useState<Phase>("intro");
    const [clickSound, setClickSound] = useState<Audio.Sound | null>(null);
    const [pageTurnSound, setPageTurnSound] = useState<Audio.Sound | null>(null);
    const [diceRollSound, setDiceRollSound] = useState<Audio.Sound | null>(null);
    
    const [currentScene, setCurrentScene] = useState<SceneTemplate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [gameState, setGameState] = useState<any | null>(null);

    const [isStatsVisible, setIsStatsVisible] = useState(true);
    const [isSkillsVisible, setIsSkillsVisible] = useState(true);
    const [isItemsVisible, setIsItemsVisible] = useState(true);

    const [diceResult, setDiceResult] = useState<string | null>(null);
    const [isRolling, setIsRolling] = useState(false);
    const spinValue = useRef(new Animated.Value(0)).current;

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isResultsModalVisible, setIsResultsModalVisible] = useState(false);

    const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
    const [saveModalMessage, setSaveModalMessage] = useState("");

    const [isGeneratingNextScene, setIsGeneratingNextScene] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
    });

    const phaseAnim = useRef(new Animated.Value(0)).current;

    const roundSpec: SceneRoundSpec | null = useMemo(() => {
        return currentScene?.round ?? null;
    }, [currentScene]);

    const myRole = useMemo(() => {
        if (!currentScene) return null;
        return currentScene.roleMap?.[myCharacter.name] ?? null;
    }, [currentScene, myCharacter.name]);

    const [remaining, setRemaining] = useState(turnSeconds);
    const timerRef = useRef<number | null>(null);
    const [myChoiceId, setMyChoiceId] = useState<string | null>(null);

    const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
    const [cinematicText, setCinematicText] = useState<string>("");

    const [usedItems, setUsedItems] = useState<Set<string>>(new Set());
    const [skillCooldowns, setSkillCooldowns] = useState<Record<string, number>>({});
    const [pendingUsage, setPendingUsage] = useState<{ type: 'skill' | 'item'; data: Skill | Item } | null>(null);
    const SKILL_COOLDOWN_SCENES = 2;

    const timerAnim = useRef(new Animated.Value(turnSeconds)).current;

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
        if (isLoadedGame && initialPlayerState) {
            console.log("플레이어 상태 복원:", initialPlayerState);
            setUsedItems(new Set(initialPlayerState.usedItems || []));
            setSkillCooldowns(initialPlayerState.skillCooldowns || {});
        }
    }, [isLoadedGame, initialPlayerState]);

    useEffect(() => {
        // '이어하기'이고, 초기 데이터가 props로 전달된 경우
        if (isLoadedGame && initialScene && initialGameState) {
            console.log("✅ [GameEngine] 불러온 데이터로 게임을 시작합니다.");
            setCurrentScene(initialScene);
            setGameState(initialGameState);
            if (initialPlayerState) {
                setUsedItems(new Set(initialPlayerState.usedItems || []));
                setSkillCooldowns(initialPlayerState.skillCooldowns || {});
            }
            setPhase("choice");
            setIsLoading(false);
        }
        // '새 게임'인 경우
        else if (!isLoadedGame) {
            console.log("🚀 [GameEngine] 새 게임을 위해 첫 씬을 요청합니다.");
            const fetchInitialScene = async () => {
                setIsLoading(true);
                setError(null);
                try {
                    const response = await getInitialScene({
                        topic: Array.isArray(topic) ? topic[0] : topic,
                        myCharacter: setupData.myCharacter,
                        allCharacters: setupData.allCharacters,
                        isLoadedGame: false,
                    });
                    setCurrentScene(response.data.scene);
                    setGameState(response.data.initial_state);
                    setPhase("choice");
                } catch (err) {
                    console.error("초기 씬 로딩 실패:", err);
                    setError("게임을 불러오는 데 실패했습니다.");
                } finally {
                    setIsLoading(false);
                }
            };
            fetchInitialScene();
        }
    }, []);
    
    useEffect(() => {
        if (phase !== 'intro') {
            phaseAnim.setValue(0);
            Animated.timing(phaseAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        }
    }, [phase]);

    useEffect(() => {
        const loadSounds = async () => {
            try {
                const { sound: loadedClickSound } = await Audio.Sound.createAsync(require('../../assets/sounds/click.mp3'));
                setClickSound(loadedClickSound);
                const { sound: loadedPageTurnSound } = await Audio.Sound.createAsync(require('../../assets/sounds/page_turn.mp3'));
                setPageTurnSound(loadedPageTurnSound);
                const { sound: loadedDiceRollSound } = await Audio.Sound.createAsync(require('../../assets/sounds/dice_roll.mp3'));
                setDiceRollSound(loadedDiceRollSound);
            } catch (error) { console.error("사운드 로딩 실패:", error); }
        };
        loadSounds();
        return () => {
            clickSound?.unloadAsync();
            pageTurnSound?.unloadAsync();
            diceRollSound?.unloadAsync();
        };
    }, []);

    useEffect(() => {
        if (phase === "choice" && !myChoiceId) {
            startTimer();
        } else {
            stopTimer();
        }
        return () => stopTimer();
    }, [phase, myChoiceId]);

    const handleReturnToRoom = () => setIsModalVisible(true);

    const exitGame = () => {
        setIsModalVisible(false);
        router.replace(`/game/single`);
    };

    const startTimer = () => {
        stopTimer();
        setRemaining(turnSeconds);
        timerAnim.setValue(turnSeconds);
        Animated.timing(timerAnim, { toValue: 0, duration: turnSeconds * 1000, useNativeDriver: false }).start();
        timerRef.current = setInterval(() => {
            setRemaining((r) => {
                if (r <= 1) {
                    stopTimer();
                    autoPickAndSubmit();
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
            case "초급": return 10;
            case "중급": return 13;
            case "상급": return 16;
            default: return 10;
        }
    };

    const rollDice = (sides: number = 20) => Math.floor(Math.random() * sides) + 1;

    const startDiceRoll = () => {
        if (submitting) return;
        setSubmitting(true);
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

        setTimeout(async () => {
            spinAnim.stop();

            const myChoice = roundSpec?.choices[myRole!]?.find(
                (c) => c.id === myChoiceId
            );
            if (!myChoice || !myRole) {
                setDiceResult("오류: 선택지를 찾을 수 없습니다.");
                setIsRolling(false);
                setSubmitting(false);
                return;
            }

            const myDice = rollDice(20);
            const myAppliedStatKorean = myChoice.appliedStat;
            const myStatValue = myCharacter.stats[myAppliedStatKorean] ?? 0;
            const myModifier = myChoice.modifier;
            const myTotal = myDice + myStatValue + myModifier;
            const DC = getDC(difficulty);

            let myGrade: Grade = "F";
            let resultText = "";
            if (myDice === 20) { myGrade = "SP"; resultText = "치명적 대성공 🎉 (Natural 20!)"; } 
            else if (myDice === 1) { myGrade = "SF"; resultText = "치명적 실패 💀 (Natural 1...)"; }
            else if (myTotal >= DC) { myGrade = "S"; resultText = `성공 ✅ (목표 DC ${DC} 이상 달성)`; }
            else { myGrade = "F"; resultText = `실패 ❌ (목표 DC ${DC} 미달)`; }

            const playerResult: PerRoleResult = {
                role: myRole!, choiceId: myChoiceId!, grade: myGrade, dice: myDice,
                appliedStat: myAppliedStatKorean, statValue: myStatValue, modifier: myModifier,
                total: myTotal, characterName: myCharacter.name, characterId: myCharacter.id,
            };

            setDiceResult(`🎲 d20: ${myDice} + ${myAppliedStatKorean}(${myStatValue}) + 보정(${myModifier}) = ${myTotal} → ${resultText}`);
            setIsRolling(false);
            setIsGeneratingNextScene(true);

            try {
                const response = await resolveTurn({
                    playerResult: playerResult,
                    aiCharacters: aiCharacters,
                    currentScene: currentScene,
                    usage: pendingUsage,
                    gameState: gameState,
                });

                const { narration, roundResult, nextGameState, shari } = response.data;

                setCinematicText(narration);
                setRoundResult(roundResult);
                setGameState(nextGameState);
                if (shari) { // ✅ shari 데이터가 있으면 상태를 업데이트합니다.
                    setShariBlockData(shari);
                    setWorldState(prev => ({ ...prev, ...shari.update }));
                }
                setPhase("cinematic");

            } catch (err) {
                console.error("턴 결과 처리 오류:", err);
                setError("행동 결과를 처리하는 중 오류가 발생했습니다.");
            } finally {
                setPendingUsage(null);
                setSubmitting(false);
                setIsGeneratingNextScene(false);
            }
        }, 2000);
    };

    const submitChoice = (choiceId: string) => {
        const choice = roundSpec?.choices[myRole!]?.find(c => c.id === choiceId);
        if (!choice) return;

        clickSound?.replayAsync();
        setMyChoiceId(choiceId);
        stopTimer();
        setPhase("dice_roll");
    };
    
    const handleProceedToNextScene = async () => {
        if (!currentScene || isGeneratingNextScene) return;

        setIsGeneratingNextScene(true);
        setError(null);
        pageTurnSound?.replayAsync();

        try {
            const response = await getNextScene({
                gameState: gameState,
                lastNarration: cinematicText,
                currentSceneIndex: currentScene.index,
            });

            const { scene, updatedGameState } = response.data;

            // Reset all previous turn's results BEFORE setting the new scene
            setDiceResult(null);
            setRoundResult(null);
            setCinematicText("");
            setMyChoiceId(null);

            // Now, set the new scene and game state
            setCurrentScene(scene);
            setGameState(updatedGameState);

            // Finally, change the phase to start the new turn
            setPhase("choice");
            
        } catch (err) {
            console.error("다음 씬 생성 오류:", err);
            setError("다음 이야기를 생성하는 중 오류가 발생했습니다.");
        } finally {
            setIsGeneratingNextScene(false);
        }
    };

    const autoPickAndSubmit = () => {
        if (!myRole) return;

        const myChoices = roundSpec?.choices[myRole] ?? [];
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

    const handleSaveGame = async () => {
        if (!gameState) {
            setSaveModalMessage("저장할 수 있는 정보가 부족합니다.");
            setIsSaveModalVisible(true);
            return;
        }
        try {
            // 저장할 게임 상태에 playerState를 추가
            const gameStateToSave = {
                ...gameState,
                playerState: {
                    usedItems: Array.from(usedItems), // Set을 Array로 변환
                    skillCooldowns: skillCooldowns,
                }
            };

            const response = await saveGame({ 
                gameState: gameStateToSave, // playerState가 포함된 gameState 전달
                characterHistory: setupData,
                characterId: myCharacter.id,
                difficulty: Array.isArray(difficulty) ? difficulty[0] : (difficulty || "초급"),
                genre: Array.isArray(genre) ? genre[0] : (genre || "판타지"),
                mode: Array.isArray(mode) ? mode[0] : (mode || "실시간"),
            });
            setSaveModalMessage(response.data.message);
        } catch (err) {
            console.error("Save game error:", err);
            setSaveModalMessage("저장에 실패했습니다.");
        } finally {
            setIsSaveModalVisible(true);
        }
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
                    onPress={exitGame}
                >
                    <Text style={styles.retryText}>대기실로 돌아가기</Text>
                </TouchableOpacity>
            </View>
        );
    }
    
    if (!roundSpec || !myRole) {
        return (
            <View style={styles.center}>
                <Text style={styles.warn}>게임 데이터를 불러올 수 없습니다.</Text>
                <Text style={styles.subtitle}>
                    현재 씬에 대한 정보를 받지 못했거나, 당신의 역할이 지정되지 않았습니다.
                </Text>
                <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={exitGame}
                >
                    <Text style={styles.retryText}>대기실로 돌아가기</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const myChoices = roundSpec.choices[myRole] ?? [];
    const title = roundSpec.title;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.mainContainer}>
                <TouchableOpacity 
                    style={styles.hudIconContainer} 
                    onPress={() => {
                        setIsHudModalVisible(true);
                        setHasNewHudInfo(false);
                    }}
                >
                    <Ionicons name="information-circle-outline" size={28} color="#E0E0E0" />
                    {hasNewHudInfo && (
                        <View style={styles.notificationBadge}>
                            <Text style={styles.notificationText}>!</Text>
                        </View>
                    )}
                </TouchableOpacity>
                <View style={styles.characterPanel}>
                    <Text style={styles.characterName}>{myCharacter.name}</Text>
                    <Image
                        source={{uri: myCharacter.image as string}}
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

                <View style={styles.gamePanel}>
                    {phase === "choice" && (
                        <Animated.View style={[styles.contentBox, { opacity: phaseAnim }]}>
                            <Text style={styles.title}>{title}</Text>
                            <ScrollView style={styles.descriptionBox}>
                                <Text style={styles.descriptionText}>
                                    {roundSpec.description}
                                </Text>
                            </ScrollView>
                            <Text style={styles.subtitle}>
                                {myCharacter.name} — {myRole}
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

                    {phase === "dice_roll" && (
                        <Animated.View style={[styles.center, { opacity: phaseAnim }]}>
                            <Text style={styles.title}>주사위 판정</Text>
                            <View style={{ height: 16 }} />
                            {isGeneratingNextScene ? (
                                <>
                                    <ActivityIndicator size="large" color="#E2C044" />
                                    <Text style={styles.subtitle}>AI가 다음 이야기를 서술하는 중...</Text>
                                </>
                            ) : isRolling ? (
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
                                style={styles.saveButton}
                                onPress={handleSaveGame}
                            >
                                <Text style={styles.primaryText}>지금까지 내용 저장하기</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.primary, isGeneratingNextScene && styles.disabledButton]}
                                onPress={handleProceedToNextScene}
                                disabled={isGeneratingNextScene}
                            >
                                <Text style={styles.primaryText}>
                                    {isGeneratingNextScene ? "이야기 생성 중..." : "계속하기"}
                                </Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {phase === "end" && (
                        <Animated.View style={[styles.center, { opacity: phaseAnim }]}>
                            <Text style={styles.title}>엔딩</Text>
                            <Text style={styles.subtitle}>수고하셨습니다!</Text>
                            <TouchableOpacity style={styles.primary} onPress={exitGame}>
                                <Text style={styles.primaryText}>대기실로 돌아가기</Text>
                            </TouchableOpacity>
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
                        <Text style={styles.modalTitle}>돌아가기</Text>
                        <Text style={styles.modalMessage}>
                            정말로 게임을 중단하고 홈으로 돌아가시겠습니까?{"\n"}
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
                                onPress={exitGame}
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
                    <ShariHud
                        world={worldState}
                        party={partyState}
                        shari={shariBlockData}
                        allCharacters={allCharacters}
                        onClose={() => setIsHudModalVisible(false)}
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
                        </Text>
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setIsSaveModalVisible(false)}
                        >
                            <Text style={styles.modalButtonText}>확인</Text>
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
                    <ShariHud
                        world={worldState}
                        party={partyState}
                        shari={shariBlockData}
                        allCharacters={allCharacters}
                        onClose={() => setIsHudModalVisible(false)}
                    />
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
    skillsItemsBox: {
        width: "100%",
        marginBottom: 15,
        padding: 15,
        backgroundColor: "#0B1021",
        borderRadius: 12,
    },
    skillItem: {
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    skillItemName: {
        color: "#E2C044",
        fontWeight: "bold",
        fontSize: 14,
        marginBottom: 4,
    },
    skillItemDesc: {
        color: "#A0A0A0",
        fontSize: 13,
        lineHeight: 18,
        paddingLeft: 8,
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
    saveButton: {
        marginTop: 12,
        backgroundColor: "#1D4ED8",
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
        maxHeight: 100,
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