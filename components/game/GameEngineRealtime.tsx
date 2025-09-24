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
import { useWebSocket } from "@/components/context/WebSocketContext";
import { Character, endGame, getWebSocketNonce, Skill, Item } from "@/services/api";
import { getStatValue, statMapping, RoundResult, SceneRoundSpec, SceneTemplate, PerRoleResult, Grade, ShariBlock, World, PartyEntry } from "@/util/ttrpg";
import { Audio } from "expo-av";
import { useAuth } from "@/hooks/useAuth";
import ShariHud from "./ShariHud";
import { useFonts } from 'expo-font';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useSettings } from "@/components/context/SettingsContext"; // Settings 훅 임포트
import OptionsModal from "@/components/OptionsModal"; // OptionsModal 컴포넌트 임포트

interface LoadedSessionData {
  choice_history: any;
  character_history: any;
}

type Props = {
    roomId: string | string[];
    topic: string | string[];
    difficulty?: string | string[];
    setupData: {
        myCharacter: Character;
        aiCharacters: Character[];
        allCharacters: Character[];
    };
    initialSessionData?: LoadedSessionData | null;
    turnSeconds?: number;
    isLoadedGame: boolean;
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
    setupData,
    initialSessionData = null,
    turnSeconds = 20,
    isLoadedGame,
}: Props) {
    const { user } = useAuth();
    const { myCharacter, aiCharacters, allCharacters } = setupData;
    const { fontSizeMultiplier, isSfxOn } = useSettings(); // 설정 값 가져오기
    const [fontsLoaded, fontError] = useFonts({
      'neodgm': require('@/assets/fonts/neodgm.ttf'),
    });

    const [showConfetti, setShowConfetti] = useState(false);

    console.log("내 캐릭터 데이터:", JSON.stringify(myCharacter, null, 2));

    const wsRef = useRef<WebSocket | null>(null);
    const ws = wsRef?.current ?? null;

    // --- 상태(State) 변수 ---
    const [phase, setPhase] = useState<Phase>("intro");

    const [clickSound, setClickSound] = useState<Audio.Sound | null>(null);
    const [pageTurnSound, setPageTurnSound] = useState<Audio.Sound | null>(null);
    const [diceRollSound, setDiceRollSound] = useState<Audio.Sound | null>(null);
    const [fireworksSound, setFireworksSound] = useState<Audio.Sound | null>(null);
    
    const [currentScene, setCurrentScene] = useState<SceneTemplate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [isStatsVisible, setIsStatsVisible] = useState(true);
    const [isSkillsVisible, setIsSkillsVisible] = useState(true);
    const [isItemsVisible, setIsItemsVisible] = useState(true);

    const [diceResult, setDiceResult] = useState<string | null>(null);
    const [isRolling, setIsRolling] = useState(false);
    const spinValue = useRef(new Animated.Value(0)).current;

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isResultsModalVisible, setIsResultsModalVisible] = useState(false);
    const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false); // 옵션 모달 상태 추가

    const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
    const [saveModalMessage, setSaveModalMessage] = useState("");

    const [isGeneratingNextScene, setIsGeneratingNextScene] = useState(false);

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
    const [submitting, setSubmitting] = useState(false);
    
    const [aiChoices, setAiChoices] = useState<{[role: string]: string}>({});

    const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
    const [cinematicText, setCinematicText] = useState<string>("");

    const [usedItems, setUsedItems] = useState<Set<string>>(new Set());
    const [skillCooldowns, setSkillCooldowns] = useState<Record<string, number>>({});
    const [pendingUsage, setPendingUsage] = useState<{ type: 'skill' | 'item'; data: Skill | Item } | null>(null);
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

    const [sceneImageUrl, setSceneImageUrl] = useState<string | null>(null);
    const [imgLoading, setImgLoading] = useState(false);

    // 효과음 재생 함수 (설정값에 따라 재생)
    const playSfx = (sound: Audio.Sound | null) => {
        if (isSfxOn && sound) {
            sound.replayAsync();
        }
    };

    useEffect(() => {
        if (shariBlockData?.update && Object.keys(shariBlockData.update).length > 0) {
            setHasNewHudInfo(true);
        }
    }, [shariBlockData]);

    useEffect(() => {
        if (phase === 'end') {
            setShowConfetti(true);
            playSfx(fireworksSound);
        }
    }, [phase, fireworksSound]);

    useEffect(() => {
        let ws: WebSocket | null = null;

        const connect = async () => {
            try {
                const nonceResponse = await getWebSocketNonce();
                const nonce = nonceResponse.data.nonce;
                const scheme = "wss";
                const backendHost = "team6-backend.koreacentral.cloudapp.azure.com";
                const url = `${scheme}://${backendHost}/ws/multi_game/${roomId}/?nonce=${nonce}`;
                
                ws = new WebSocket(url);
                wsRef.current = ws;

                ws.onopen = () => {
                    console.log("✅ GameEngineRealtime WebSocket Connected");
                    setIsLoading(true);
                    const logMessage = isLoadedGame
                        ? "🚀 (불러온 게임) 첫 장면을 요청합니다."
                        : "🚀 (새 게임) 첫 장면을 요청합니다.";
                    console.log(logMessage);

                    ws?.send(JSON.stringify({
                        type: "request_initial_scene",
                        topic: Array.isArray(topic) ? topic[0] : topic,
                        characters: allCharacters,
                        isLoadedGame: isLoadedGame,
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
                        setAmIReadyForNext(false);
                        setNextSceneReadyState({ ready_users: [], total_users: 0 });
                        playSfx(pageTurnSound);
                        phaseAnim.setValue(0);
                        Animated.timing(phaseAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
                        } else if (data.type === "game_update" && data.payload.event === "game_loaded") {
                        const { scene, playerState } = data.payload;
                        setCurrentScene(scene);
 
                        if (playerState) {
                            setUsedItems(new Set(playerState.usedItems || []));
                            setSkillCooldowns(playerState.skillCooldowns || {});
                        }
 
                        setPhase("choice");
                        setMyChoiceId(null);
                        setRoundResult(null);
                        setDiceResult(null);
                        setCinematicText("");
                        setSubmitting(false);
                        setAiChoices({});
                        setIsLoading(false);
                        setIsGeneratingNextScene(false);
                        playSfx(pageTurnSound);
                        phaseAnim.setValue(0);
                        Animated.timing(phaseAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

                    } else if (data.type === "game_update" && data.payload.event === "turn_resolved") {
                        const { narration, roundResult, world_update, party_update, shari, personal_narrations } = data.payload;
                        setCinematicText(narration);
                        setRoundResult(roundResult);
                        if (world_update) setWorldState(world_update);
                        if (party_update) setPartyState(party_update);
                        if (shari) setShariBlockData(shari);
                        const imageUrl =
                        data?.payload?.image?.url ??
                        data?.payload?.roundResult?.image?.url ??
                        data?.payload?.gm_result?.image?.url ??
                        data?.payload?.result?.image?.url ??
                        null;

                        console.log("🎨 incoming imageUrl:", imageUrl);
                        if (imageUrl) {
                            setImgLoading(true);
                            setSceneImageUrl(imageUrl);
                        } else {
                            setSceneImageUrl(null);
                        }
                        setTurnWaitingState({ submitted_users: [], total_users: 0 });
                        setPhase("cinematic");
                        phaseAnim.setValue(0);
                        Animated.timing(phaseAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
                    
                    } else if (data.type === "game_update" && data.payload.event === "game_over") {
                        const { narration, image } = data.payload;
                        setCinematicText(narration);
                        
                        if (image?.url) {
                            setSceneImageUrl(image.url);
                        }
                        
                        setPhase("end");
                        
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
        };

        connect();

        return () => {
            if (ws && ws.readyState === WebSocket.OPEN) { ws.close(); }
            stopTimer();
        };
    }, [roomId, topic, setupData, isLoadedGame]);

    useEffect(() => {
        const loadSounds = async () => {
            try {
                const { sound: loadedClickSound } = await Audio.Sound.createAsync(require('../../assets/sounds/click.mp3'));
                setClickSound(loadedClickSound);
                const { sound: loadedPageTurnSound } = await Audio.Sound.createAsync(require('../../assets/sounds/page_turn.mp3'));
                setPageTurnSound(loadedPageTurnSound);
                const { sound: loadedDiceRollSound } = await Audio.Sound.createAsync(require('@/assets/sounds/dice_roll.mp3'));
                setDiceRollSound(loadedDiceRollSound);
                const { sound: loadedFireworksSound } = await Audio.Sound.createAsync(require('@/assets/sounds/fireworks.mp3'));
                setFireworksSound(loadedFireworksSound);
            } catch (error) { console.error("사운드 로딩 실패:", error); }
        };
        loadSounds();
        return () => {
            clickSound?.unloadAsync();
            pageTurnSound?.unloadAsync();
            diceRollSound?.unloadAsync();
            fireworksSound?.unloadAsync();
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

    const confirmReturnToRoom = async () => {
        setIsModalVisible(false);
        const id = Array.isArray(roomId) ? roomId[0] : roomId;
        try {
            await endGame(id);
            router.replace(`/game/multi/room/${id}`);
        } catch (error) {
            router.replace(`/game/multi`);
        }
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
        playSfx(diceRollSound);
        setIsRolling(true);
        setDiceResult(null);
        spinValue.setValue(0);
        const spinAnim = Animated.loop(Animated.timing(spinValue, { toValue: 1, duration: 400, useNativeDriver: true }));
        spinAnim.start();

        setTimeout(() => {
            spinAnim.stop();

            const myChoice = roundSpec?.choices[myRole!]?.find(c => c.id === myChoiceId);
            if (!myChoice || !myRole || !ws) {
                setDiceResult("오류: 선택지를 찾을 수 없습니다.");
                setIsRolling(false);
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
                role: myRole!,
                choiceId: myChoiceId!,
                grade: myGrade,
                dice: myDice,
                appliedStat: myAppliedStatKorean,
                statValue: myStatValue,
                modifier: myModifier,
                total: myTotal,
                characterName: myCharacter.name,
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

            setPhase("sync");

        }, 2000);
    };

    const submitChoice = (choiceId: string) => {
        const choice = roundSpec?.choices[myRole!]?.find(c => c.id === choiceId);
        if (!choice) return;

        playSfx(clickSound);
        setMyChoiceId(choiceId);
        stopTimer();
        setPhase("dice_roll");
    };

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

        setAmIReadyForNext(true);
        setIsGeneratingNextScene(true);

        const myLastChoice = myChoices.find(c => c.id === myChoiceId);
        if (!myLastChoice) {
            setAmIReadyForNext(false);
            setIsGeneratingNextScene(false);
            return;
        }

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

        const choicesFormatted = myCurrentChoices.reduce((acc, choice, index) => {
            acc[index] = choice.text;
            return acc;
        }, {} as { [key: number]: string });
        
        const selectedChoiceFormatted = {
            [myCurrentChoices.indexOf(selectedChoiceObj)]: selectedChoiceObj.text
        };

        const saveData = {
            title: roundSpec?.title,
            description: roundSpec?.title,
            choices: choicesFormatted,
            selectedChoice: selectedChoiceFormatted,
            sceneIndex: currentScene.index,
            playerState: {
                usedItems: Array.from(usedItems),
                skillCooldowns: skillCooldowns,
            }
        };

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
    if ((isLoading && !currentScene) || !fontsLoaded && !fontError) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E2C044" />
                <Text style={[styles.subtitle, { fontSize: 14 * fontSizeMultiplier }]}>LLM이 새로운 세계를 창조하는 중...</Text>
            </View>
        );
    }
    if (error) {
        return (
            <View style={styles.center}>
                <Text style={[styles.warn, { fontSize: 18 * fontSizeMultiplier }]}>오류 발생</Text>
                <Text style={[styles.subtitle, { fontSize: 14 * fontSizeMultiplier }]}>{error}</Text>
                <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={confirmReturnToRoom}
                >
                    <Text style={[styles.retryText, { fontSize: 14 * fontSizeMultiplier }]}>대기실로 돌아가기</Text>
                </TouchableOpacity>
            </View>
        );
    }
    
    if (!roundSpec || !myRole) {
        return (
            <View style={styles.center}>
                <Text style={[styles.warn, { fontSize: 18 * fontSizeMultiplier }]}>게임 데이터를 불러올 수 없습니다.</Text>
                <Text style={[styles.subtitle, { fontSize: 14 * fontSizeMultiplier }]}>
                    현재 씬에 대한 정보를 받지 못했거나, 당신의 역할이 지정되지 않았습니다.
                </Text>
                <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={confirmReturnToRoom}
                >
                    <Text style={[styles.retryText, { fontSize: 14 * fontSizeMultiplier }]}>대기실로 돌아가기</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const myChoices = roundSpec.choices[myRole] ?? [];
    const title = roundSpec.title;

    return (
        <SafeAreaView style={styles.safeArea}>
            {showConfetti && (
                <ConfettiCannon
                    count={200}
                    origin={{ x: -10, y: 0 }}
                    autoStart={true}
                    fadeOut={true}
                    explosionSpeed={400}
                    fallSpeed={3000}
                />
            )}
            <View style={styles.mainContainer}>
                {/* 옵션 버튼 추가 */}
                <TouchableOpacity style={styles.settingsIcon} onPress={() => setIsOptionsModalVisible(true)}>
                    <Ionicons name="settings-outline" size={28} color="#E0E0E0" />
                </TouchableOpacity>

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
                    <Text style={[styles.characterName, { fontSize: 22 * fontSizeMultiplier }]}>{myCharacter.name}</Text>
                    <Image
                        source={myCharacter.image}
                        style={styles.characterImage}
                        resizeMode="contain"
                    />
                    {myCharacter.description && (
                        <Text style={[styles.characterDescription, { fontSize: 14 * fontSizeMultiplier }]}>
                            {myCharacter.description}
                        </Text>
                    )}

                   <ScrollView 
                       style={{width: '100%', flex: 1}} 
                       showsVerticalScrollIndicator={false}
                   >
                       <View style={styles.collapsibleContainer}>
                            <TouchableOpacity style={styles.collapsibleHeader} onPress={() => setIsStatsVisible(!isStatsVisible)}>
                                <Text style={[styles.skillsItemsTitle, { fontSize: 16 * fontSizeMultiplier }]}>능력치</Text>
                                <Ionicons name={isStatsVisible ? "chevron-up" : "chevron-down"} size={20} color="#E0E0E0" />
                            </TouchableOpacity>
                            {isStatsVisible && (
                                <View style={styles.collapsibleContent}>
                                    {Object.entries(myCharacter.stats).map(([stat, value]) => (
                                        <Text key={stat} style={[styles.statText, { fontSize: 14 * fontSizeMultiplier }]}>
                                            {stat}: <Text style={{ color: "#E2C044", fontWeight: "bold" }}>{value}</Text>
                                        </Text>
                                    ))}
                                </View>
                            )}
                        </View>

                        {myCharacter.skills && myCharacter.skills.length > 0 && (
                            <View style={styles.collapsibleContainer}>
                                <TouchableOpacity style={styles.collapsibleHeader} onPress={() => setIsSkillsVisible(!isSkillsVisible)}>
                                    <Text style={[styles.skillsItemsTitle, { fontSize: 16 * fontSizeMultiplier }]}>스킬</Text>
                                    <Ionicons name={isSkillsVisible ? "chevron-up" : "chevron-down"} size={20} color="#E0E0E0" />
                                </TouchableOpacity>
                                {isSkillsVisible && (
                                    <View style={styles.collapsibleContent}>
                                        {myCharacter.skills.map((skill) => {
                                            const isOnCooldown = (skillCooldowns[skill.name] ?? 0) > (currentScene?.index ?? 0);
                                            return (
                                                <View key={skill.name} style={styles.skillItem}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[styles.skillItemName, { fontSize: 14 * fontSizeMultiplier }]}>- {skill.name}</Text>
                                                        <Text style={[styles.skillItemDesc, { fontSize: 13 * fontSizeMultiplier }]}>{skill.description}</Text>
                                                    </View>
                                                    <TouchableOpacity 
                                                        style={[styles.useButton, (isOnCooldown || pendingUsage) && styles.disabledUseButton]}
                                                        disabled={isOnCooldown || !!pendingUsage}
                                                        onPress={() => handleUseSkill(skill)}
                                                    >
                                                        <Text style={[styles.useButtonText, { fontSize: 12 * fontSizeMultiplier }]}>
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
                                    <Text style={[styles.skillsItemsTitle, { fontSize: 16 * fontSizeMultiplier }]}>아이템</Text>
                                    <Ionicons name={isItemsVisible ? "chevron-up" : "chevron-down"} size={20} color="#E0E0E0" />
                                </TouchableOpacity>
                                {isItemsVisible && (
                                    <View style={styles.collapsibleContent}>
                                        {myCharacter.items.map((item) => {
                                            const isUsed = usedItems.has(item.name);
                                            return (
                                                <View key={item.name} style={styles.skillItem}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[styles.skillItemName, { fontSize: 14 * fontSizeMultiplier }]}>- {item.name}</Text>
                                                        <Text style={[styles.skillItemDesc, { fontSize: 13 * fontSizeMultiplier }]}>{item.description}</Text>
                                                    </View>
                                                    <TouchableOpacity 
                                                        style={[styles.useButton, (isUsed || pendingUsage) && styles.disabledUseButton]}
                                                        disabled={isUsed || !!pendingUsage}
                                                        onPress={() => handleUseItem(item)}
                                                    >
                                                        <Text style={[styles.useButtonText, { fontSize: 12 * fontSizeMultiplier }]}>{isUsed ? "사용완료" : "사용"}</Text>
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
                            {currentScene && <Text style={[styles.turnCounter, { fontSize: 16 * fontSizeMultiplier }]}>- {currentScene.index + 1}번째 이야기 -</Text>}
                            <Text style={[styles.title, { fontSize: 26 * fontSizeMultiplier }]}>{title}</Text>
                            <ScrollView style={styles.descriptionBox} showsVerticalScrollIndicator={false}>
                                <Text style={[styles.descriptionText, { fontSize: 15 * fontSizeMultiplier }]}>
                                    {roundSpec.description}
                                </Text>
                            </ScrollView>
                            <Text style={[styles.subtitle, { fontSize: 14 * fontSizeMultiplier }]}>
                                {myCharacter.name}
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
                            <Text style={[styles.timerText, { fontSize: 12 * fontSizeMultiplier }]}>남은 시간: {remaining}s</Text>

                            {Object.keys(aiChoices).length > 0 && (
                                <View style={styles.aiStatusBox}>
                                    <Text style={[styles.aiStatusTitle, { fontSize: 14 * fontSizeMultiplier }]}>다른 참여자 선택 현황:</Text>
                                    {Object.entries(aiChoices).map(([role]) => (
                                        <Text key={role} style={[styles.aiStatusText, { fontSize: 12 * fontSizeMultiplier }]}>- {role}: 선택 완료 ✅</Text>
                                    ))}
                                </View>
                            )}

                            <ScrollView style={{ flex: 1, width: '100%' }} showsVerticalScrollIndicator={false}>
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
                                        <Text style={[styles.choiceText, { fontSize: 16 * fontSizeMultiplier }]}>{c.text}</Text>
                                        <Text style={[styles.hint, { fontSize: 12 * fontSizeMultiplier }]}>
                                            적용 스탯: {statMapping[c.appliedStat as EnglishStat] ?? c.appliedStat} (보정: {c.modifier >= 0 ? `+${c.modifier}` : c.modifier})
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {!myChoiceId && (
                                <TouchableOpacity style={styles.secondary} onPress={autoPickAndSubmit}>
                                    <Text style={[styles.secondaryText, { fontSize: 14 * fontSizeMultiplier }]}>아무거나 고르기(랜덤)</Text>
                                </TouchableOpacity>
                            )}
                        </Animated.View>
                    )}

                    {phase === "sync" && (
                        <Animated.View style={[styles.center, { opacity: phaseAnim }]}>
                            <ActivityIndicator size="large" color="#E2C044"/>
                            <Text style={[styles.subtitle, { fontSize: 14 * fontSizeMultiplier }]}>다른 플레이어의 행동을 기다리는 중...</Text>
                            <Text style={[styles.subtitle, { fontSize: 14 * fontSizeMultiplier }]}>
                                ({turnWaitingState.submitted_users.length}/{turnWaitingState.total_users}명 제출 완료)
                            </Text>
                        </Animated.View>
                    )}

                    {phase === "dice_roll" && (
                        <Animated.View style={[styles.center, { opacity: phaseAnim }]}>
                            <Text style={[styles.title, { fontSize: 26 * fontSizeMultiplier }]}>주사위 판정</Text>
                            <View style={{ height: 16 }} />
                            {isRolling ? (
                                <Animated.View style={{ transform: [{ rotate: spin }], marginBottom: 20 }}>
                                    <Text style={{ fontSize: 50 }}>🎲</Text>
                                </Animated.View>
                            ) : (
                                <TouchableOpacity style={styles.primary} onPress={startDiceRoll}>
                                    <Text style={[styles.primaryText, { fontSize: 16 * fontSizeMultiplier }]}>주사위 굴리기</Text>
                                </TouchableOpacity>
                            )}
                        </Animated.View>
                    )}

                    {phase === "cinematic" && (
                        <Animated.View style={[styles.contentBox, { opacity: phaseAnim }]}>
                            {currentScene && <Text style={[styles.turnCounter, { fontSize: 16 * fontSizeMultiplier }]}>- {currentScene.index + 1}번째 이야기 -</Text>}
                            <Text style={[styles.title, { fontSize: 26 * fontSizeMultiplier }]}>{title}</Text>
                            {diceResult && <Text style={[styles.resultText, { fontSize: 18 * fontSizeMultiplier }]}>{diceResult}</Text>}
                            {sceneImageUrl ? (
                            <View style={styles.sceneImageWrap}>
                                <Image
                                source={{ uri: sceneImageUrl }}
                                style={styles.sceneImage}
                                resizeMode="cover"
                                onLoadStart={() => setImgLoading(true)}
                                onLoadEnd={() => setImgLoading(false)}
                                onError={() => setImgLoading(false)}
                                />
                                {imgLoading && <ActivityIndicator style={styles.imgSpinner} />}

                                <ScrollView style={styles.cinematicBox} showsVerticalScrollIndicator={false}>
                                    <Text style={[styles.cinematicText, { fontSize: 15 * fontSizeMultiplier }]}>{cinematicText}</Text>
                                </ScrollView>
                            </View>
                            ) : (
                                <ScrollView style={styles.cinematicBox_noImage} showsVerticalScrollIndicator={false}>
                                    <Text style={[styles.cinematicText, { fontSize: 15 * fontSizeMultiplier }]}>{cinematicText}</Text>
                                </ScrollView>
                            )}

                            <TouchableOpacity
                                style={styles.secondary}
                                onPress={() => setIsResultsModalVisible(true)}
                            >
                                <Text style={[styles.secondaryText, { fontSize: 14 * fontSizeMultiplier }]}>결과 상세 보기</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                                style={styles.saveButton}
                                onPress={handleSaveGame}
                            >
                                <Text style={[styles.primaryText, { fontSize: 16 * fontSizeMultiplier }]}>지금까지 내용 저장하기</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.primary, (amIReadyForNext || isGeneratingNextScene) && styles.disabledButton]}
                                onPress={handleReadyForNextScene}
                                disabled={amIReadyForNext || isGeneratingNextScene}
                            >
                                <Text style={[styles.primaryText, { fontSize: 16 * fontSizeMultiplier }]}>
                                    {amIReadyForNext ? "다른 플레이어 대기 중..." : "다음 이야기 준비 완료"}
                                </Text>
                            </TouchableOpacity>

                            {isGeneratingNextScene && (
                                <Text style={[styles.subtitle, { fontSize: 14 * fontSizeMultiplier }]}>
                                    ({nextSceneReadyState.ready_users.length}/{nextSceneReadyState.total_users}명 준비 완료)
                                </Text>
                            )}
                        </Animated.View>
                    )}

                    {phase === "end" && (
                        <Animated.View style={[styles.center, { opacity: phaseAnim }]}>
                            <Text style={[styles.title, { fontSize: 26 * fontSizeMultiplier }]}>이야기의 끝</Text>
                            <ScrollView style={[styles.cinematicBox_noImage, { maxHeight: 300, marginBottom: 20 }]} showsVerticalScrollIndicator={false}>
                                <Text style={[styles.cinematicText, { fontSize: 15 * fontSizeMultiplier }]}>{cinematicText}</Text>
                            </ScrollView>
                            {sceneImageUrl ? (
                                <View style={[styles.sceneImageWrap, { width: "50%"}]}>
                                    <Image
                                        source={{ uri: sceneImageUrl }}
                                        style={styles.sceneImage}
                                        resizeMode="cover"
                                    />
                                <ScrollView style={styles.cinematicBox} showsVerticalScrollIndicator={false}>
                                        <Text style={[styles.cinematicText, { fontSize: 15 * fontSizeMultiplier }]}>{cinematicText}</Text>
                                    </ScrollView>
                                </View>
                            ) : (
                                <ScrollView style={[styles.cinematicBox_noImage, { maxHeight: 300, marginBottom: 20 }]}>
                                    <Text style={[styles.cinematicText, { fontSize: 15 * fontSizeMultiplier }]}>{cinematicText}</Text>
                                </ScrollView>
                            )}
                            <Text style={[styles.subtitle, { fontSize: 14 * fontSizeMultiplier }]}>수고하셨습니다!</Text>
                            <TouchableOpacity style={styles.primary} onPress={confirmReturnToRoom}>
                                <Text style={[styles.primaryText, { fontSize: 16 * fontSizeMultiplier }]}>대기실로 돌아가기</Text>
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
                        <Text style={[styles.modalTitle, { fontSize: 22 * fontSizeMultiplier }]}>방으로 돌아가기</Text>
                        <Text style={[styles.modalMessage, { fontSize: 16 * fontSizeMultiplier }]}>
                            정말로 게임을 중단하고 방으로 돌아가시겠습니까?{"\n"}
                            현재 게임 상태는 초기화됩니다.
                        </Text>
                        <View style={styles.modalButtonContainer}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setIsModalVisible(false)}
                            >
                                <Text style={[styles.modalButtonText, { fontSize: 16 * fontSizeMultiplier }]}>취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.confirmButton]}
                                onPress={confirmReturnToRoom}
                            >
                                <Text style={[styles.modalButtonText, { fontSize: 16 * fontSizeMultiplier }]}>확인</Text>
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
                        <Text style={[styles.modalTitle, { fontSize: 22 * fontSizeMultiplier }]}>라운드 결과 요약</Text>
                        <ScrollView 
                            style={styles.resultsScrollView}
                            showsVerticalScrollIndicator={false} 
                        >
                            {roundResult?.results?.map((result, index) => {
                                const choiceText = roundSpec?.choices?.[result.role]?.find(c => c.id === result.choiceId)?.text || "선택 정보를 찾을 수 없음";
                                const appliedStatKr = statMapping[result.appliedStat as EnglishStat] ?? result.appliedStat;
                                return (
                                    <View key={index} style={styles.resultItem}>
                                        <Text style={[styles.resultRole, { fontSize: 18 * fontSizeMultiplier }]}>
                                            {result.characterName} {result.characterName === myCharacter.name ? '(나)' : ''}
                                        </Text>
                                        <Text style={[styles.resultDetails, { fontSize: 14 * fontSizeMultiplier }]}>
                                            - 선택: "{choiceText}"
                                        </Text>
                                        <Text style={[styles.resultDetails, { fontSize: 14 * fontSizeMultiplier }]}>
                                            - 판정: d20({result.dice}) + {appliedStatKr}({result.statValue}) + 보정({result.modifier}) = 총합 {result.total}
                                        </Text>
                                        <Text style={[styles.resultGrade, { color: getGradeColor(result.grade), fontSize: 16 * fontSizeMultiplier }]}>
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
                            <Text style={[styles.modalButtonText, { fontSize: 16 * fontSizeMultiplier }]}>닫기</Text>
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
                        <Text style={[styles.modalTitle, { fontSize: 22 * fontSizeMultiplier }]}>알림</Text>
                        <Text style={[styles.modalMessage, { fontSize: 16 * fontSizeMultiplier }]}>
                            {saveModalMessage}
                        </Text>
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setIsSaveModalVisible(false)}
                        >
                            <Text style={[styles.modalButtonText, { fontSize: 16 * fontSizeMultiplier }]}>확인</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* 옵션 모달 렌더링 */}
            <OptionsModal
                visible={isOptionsModalVisible}
                onClose={() => setIsOptionsModalVisible(false)}
            />
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
    settingsIcon: { // 설정 아이콘 스타일
        position: 'absolute',
        top: 145, // <-- 위치 수정 (90과 145의 중간)
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
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    warn: {
        color: "#ff6b6b",
        /* fontSize: 18, */
        fontWeight: "bold",
        textAlign: "center",
        fontFamily: 'neodgm',
    },
    subtitle: {
        color: "#D4D4D4",
        /* fontSize: 14, */
        marginTop: 4,
        textAlign: "center",
        fontFamily: 'neodgm',
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
        /* fontSize: 22, */
        fontWeight: "bold",
        color: "#E0E0E0",
        marginBottom: 8,
        fontFamily: 'neodgm',
    },
    characterDescription: {
        /* fontSize: 14, */
        color: "#A0A0A0",
        textAlign: "center",
        marginBottom: 10,
        lineHeight: 20,
        fontFamily: 'neodgm',
    },
    statText: {
        color: "#D4D4D4",
        /* fontSize: 14, */
        lineHeight: 22,
        fontFamily: 'neodgm',
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
        /* fontSize: 14, */
        marginBottom: 4,
        fontFamily: 'neodgm',
    },
    skillItemDesc: {
        color: "#A0A0A0",
        /* fontSize: 13, */
        lineHeight: 18,
        paddingLeft: 8,
        fontFamily: 'neodgm',
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
        /* fontSize: 12, */
        fontFamily: 'neodgm',
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
        /* fontSize: 26, */
        fontWeight: "bold",
        marginBottom: 8,
        textAlign: "center",
        fontFamily: 'neodgm',
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
        /* fontSize: 12, */
        textAlign: "center",
        marginTop: 4,
        fontFamily: 'neodgm',
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
        /* fontSize: 16, */
        fontWeight: "bold",
        fontFamily: 'neodgm',
    },
    hint: {
        color: "#A0A0E0",
        marginTop: 6,
        /* fontSize: 12, */
        fontFamily: 'neodgm',
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
        /* fontSize: 14, */
        fontFamily: 'neodgm',
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
        /* fontSize: 16, */
        fontFamily: 'neodgm',
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
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '40%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: 16,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    cinematicBox_noImage: {
        flex: 1,
        marginTop: 16,
        backgroundColor: "#222736",
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: "#444",
    },
    cinematicText: {
        color: "#E0E0E0",
        /* fontSize: 15, */
        lineHeight: 22,
        fontFamily: 'neodgm',
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
        /* fontSize: 14, */
        fontFamily: 'neodgm',
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
        /* fontSize: 14, */
        fontWeight: "bold",
        marginBottom: 4,
        fontFamily: 'neodgm',
    },
    aiStatusText: {
        color: "#4CAF50",
        /* fontSize: 12, */
        marginTop: 2,
        fontFamily: 'neodgm',
    },
    resultText: {
        color: "#E0E0E0",
        /* fontSize: 18, */
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 20,
        fontFamily: 'neodgm',
    },
    returnButton: {
        position: 'absolute',
        top: 200,
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
        /* fontSize: 22, */
        fontWeight: 'bold',
        color: '#E0E0E0',
        marginBottom: 15,
        fontFamily: 'neodgm',
    },
    modalMessage: {
        /* fontSize: 16, */
        color: '#D4D4D4',
        textAlign: 'center',
        marginBottom: 25,
        lineHeight: 24,
        fontFamily: 'neodgm',
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
        /* fontSize: 16, */
        fontWeight: 'bold',
        fontFamily: 'neodgm',
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
        /* fontSize: 18, */
        fontWeight: 'bold',
        marginBottom: 5,
        fontFamily: 'neodgm',
    },
    resultDetails: {
        color: '#D4D4D4',
        /* fontSize: 14, */
        lineHeight: 20,
        fontFamily: 'neodgm',
    },
    resultGrade: {
        /* fontSize: 16, */
        fontWeight: 'bold',
        marginTop: 8,
        fontFamily: 'neodgm',
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
        /* fontSize: 15, */
        lineHeight: 22,
        fontFamily: 'neodgm',
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
        /* fontSize: 16, */
        fontWeight: "bold",
        color: "#E0E0E0",
        fontFamily: 'neodgm',
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
        fontFamily: 'neodgm',
    },
    sceneImageWrap: {
        width: "40%",
        alignSelf: 'center',
        aspectRatio: 1,
        borderRadius: 12,
        overflow: "hidden",
        marginTop: 12,
        borderWidth: 1,
        borderColor: "#444",
        backgroundColor: "#0B1021",
    },
    sceneImage: {
        width: "100%",
        height: "100%",
        },
        imgSpinner: {
        position: "absolute",
        top: "50%",
        left: "50%",
        marginLeft: -10,
        marginTop: -10,
    },
    turnCounter: {
        color: '#A0A0E0',
        /* fontSize: 16, */
        textAlign: 'center',
        marginBottom: 8,
        fontFamily: 'neodgm',
    },
});