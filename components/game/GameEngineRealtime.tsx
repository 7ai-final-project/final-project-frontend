// frontend\components\game\GameEngineRealtime.tsx

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
// [수정] API 서비스에서 Character 타입과 endGame 함수만 import 합니다.
import { Character, endGame, getWebSocketNonce, Skill, Item } from "@/services/api";
import { getStatValue, statMapping, RoundResult, SceneRoundSpec, SceneTemplate, PerRoleResult, Grade, ShariBlock, World, PartyEntry } from "@/util/ttrpg";
import { Audio } from "expo-av";
import { useAuth } from "@/hooks/useAuth";
import ShariHud from "./ShariHud";
import { useFonts } from 'expo-font';
import ConfettiCannon from 'react-native-confetti-cannon';

interface LoadedSessionData {
  choice_history: any;
  character_history: any;
}

// [수정] Props 타입: GameSetup에서 넘겨주는 데이터 구조에 맞게 변경
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
    // [수정] setupData에서 필요한 정보를 구조 분해 할당합니다.
    const { user } = useAuth();
    const { myCharacter, aiCharacters, allCharacters } = setupData;
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
    
    // [수정] sceneTemplates 배열 대신, 현재 씬 객체 하나만 관리합니다.
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

    const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
    const [saveModalMessage, setSaveModalMessage] = useState("");

    const [isGeneratingNextScene, setIsGeneratingNextScene] = useState(false);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
    });

    const phaseAnim = useRef(new Animated.Value(0)).current;

    // [수정] useMemo 의존성 배열을 sceneTemplates에서 currentScene으로 변경합니다.
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

    // ⬇️ 장면 이미지 표시용 상태
    const [sceneImageUrl, setSceneImageUrl] = useState<string | null>(null);
    const [imgLoading, setImgLoading] = useState(false);


    useEffect(() => {
        if (shariBlockData?.update && Object.keys(shariBlockData.update).length > 0) {
            setHasNewHudInfo(true);
        }
    }, [shariBlockData]);

    useEffect(() => {
        if (phase === 'end') {
            setShowConfetti(true);
            fireworksSound?.replayAsync();
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
                        // ✅ 이미지 URL 경로를 넓게 커버
                        const imageUrl =
                        data?.payload?.image?.url ??
                        data?.payload?.roundResult?.image?.url ??
                        data?.payload?.gm_result?.image?.url ??
                        data?.payload?.result?.image?.url ??
                        null;

                        console.log("🎨 incoming imageUrl:", imageUrl); // (디버깅 필요시 유지)
                        if (imageUrl) {
                            setImgLoading(true);
                            setSceneImageUrl(imageUrl);
                        } else {
                            setSceneImageUrl(null);
                        }
                        setTurnWaitingState({ submitted_users: [], total_users: 0 }); // 대기 상태 초기화
                        setPhase("cinematic");
                        phaseAnim.setValue(0);
                        Animated.timing(phaseAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
                    
                    // ▼▼▼▼▼ [핵심 수정] 게임 종료 이벤트 처리 로직 추가 ▼▼▼▼▼
                    } else if (data.type === "game_update" && data.payload.event === "game_over") {
                        const { narration, image } = data.payload;
                        setCinematicText(narration); // 마지막 서사 설정
                        
                        if (image?.url) {
                            setSceneImageUrl(image.url); // 마지막 이미지 설정
                        }
                        
                        setPhase("end"); // 게임 단계(phase)를 'end'로 변경
                        
                        // 애니메이션 효과
                        phaseAnim.setValue(0);
                        Animated.timing(phaseAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
                    // ▲▲▲▲▲ [핵심 수정] 게임 종료 이벤트 처리 로직 종료 ▲▲▲▲▲

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

    // --- 사운드 로딩 Hook (변경 없음) ---
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

    // --- 타이머 로직 Hook ---
    useEffect(() => {
        if (phase === "choice" && !myChoiceId) {
            startTimer();
        } else {
            stopTimer();
        }
        return () => stopTimer();
    }, [phase, myChoiceId]);


    // --- 이벤트 핸들러 및 유틸 함수 ---

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
        diceRollSound?.replayAsync();
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

            // ✅ [수정] 결과를 기다리는 'sync' 단계로 전환합니다.
            setPhase("sync");

        }, 2000);
    };

    const submitChoice = (choiceId: string) => {
        const choice = roundSpec?.choices[myRole!]?.find(c => c.id === choiceId);
        if (!choice) return;

        clickSound?.replayAsync();
        setMyChoiceId(choiceId);
        stopTimer();
        // 내부 상태만 'dice_roll'로 변경합니다.
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
    if ((isLoading && !currentScene) || !fontsLoaded && !fontError) {
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
    }

    const myChoices = roundSpec.choices[myRole] ?? [];
    const title = roundSpec.title;

    return (
        <SafeAreaView style={styles.safeArea}>
            {showConfetti && (
                <ConfettiCannon
                    count={200} // 터지는 개수
                    origin={{ x: -10, y: 0 }}
                    autoStart={true}
                    fadeOut={true}
                    explosionSpeed={400}
                    fallSpeed={3000}
                />
            )}
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

                <View style={styles.gamePanel}>
                    {phase === "choice" && (
                        <Animated.View style={[styles.contentBox, { opacity: phaseAnim }]}>
                            <Text style={styles.title}>{title}</Text>
                            <ScrollView style={styles.descriptionBox} showsVerticalScrollIndicator={false}>
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

                            {/* [추가] 다른 참여자 선택 현황 UI */}
                            {Object.keys(aiChoices).length > 0 && (
                                <View style={styles.aiStatusBox}>
                                    <Text style={styles.aiStatusTitle}>다른 참여자 선택 현황:</Text>
                                    {Object.entries(aiChoices).map(([role]) => (
                                        <Text key={role} style={styles.aiStatusText}>- {role}: 선택 완료 ✅</Text>
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
                            {/* ✅ 여기에 '장면 이미지' 블록을 추가하세요 (ScrollView 위) */}
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
                                    <Text style={styles.cinematicText}>{cinematicText}</Text>
                                </ScrollView>
                            </View>
                            ) : (
                                <ScrollView style={styles.cinematicBox_noImage} showsVerticalScrollIndicator={false}>
                                    <Text style={styles.cinematicText}>{cinematicText}</Text>
                                </ScrollView>
                            )}

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
                            <Text style={styles.title}>이야기의 끝</Text>
                            {/* 최종 서사(내레이션)를 보여주는 부분 */}
                            <ScrollView style={[styles.cinematicBox_noImage, { maxHeight: 300, marginBottom: 20 }]} showsVerticalScrollIndicator={false}>
                                <Text style={styles.cinematicText}>{cinematicText}</Text>
                            </ScrollView>
                            {/* 최종 이미지가 있다면 보여주는 부분 */}
                            {sceneImageUrl ? (
                                <View style={[styles.sceneImageWrap, { width: "50%"}]}>
                                    <Image
                                        source={{ uri: sceneImageUrl }}
                                        style={styles.sceneImage}
                                        resizeMode="cover"
                                    />
                                <ScrollView style={styles.cinematicBox} showsVerticalScrollIndicator={false}>
                                        <Text style={styles.cinematicText}>{cinematicText}</Text>
                                    </ScrollView>
                                </View>
                            ) : (
                                // 이미지가 없을 경우: 텍스트 박스만 표시
                                <ScrollView style={[styles.cinematicBox_noImage, { maxHeight: 300, marginBottom: 20 }]}>
                                    <Text style={styles.cinematicText}>{cinematicText}</Text>
                                </ScrollView>
                            )}
                            <Text style={styles.subtitle}>수고하셨습니다!</Text>
                            <TouchableOpacity style={styles.primary} onPress={confirmReturnToRoom}>
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
                        </Text>
                        <TouchableOpacity
                            style={styles.modalCloseButton} // 기존 닫기 버튼 스타일 재사용
                            onPress={() => setIsSaveModalVisible(false)}
                        >
                            <Text style={styles.modalButtonText}>확인</Text>
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
        fontFamily: 'neodgm',
    },
    subtitle: {
        color: "#D4D4D4",
        fontSize: 14,
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
        fontSize: 22,
        fontWeight: "bold",
        color: "#E0E0E0",
        marginBottom: 8,
        fontFamily: 'neodgm',
    },
    characterDescription: {
        fontSize: 14,
        color: "#A0A0A0",
        textAlign: "center",
        marginBottom: 10,
        lineHeight: 20,
        fontFamily: 'neodgm',
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
        fontFamily: 'neodgm',
    },
    statText: {
        color: "#D4D4D4",
        fontSize: 14,
        lineHeight: 22,
        fontFamily: 'neodgm',
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
        fontFamily: 'neodgm',
    },
    skillItemDesc: {
        color: "#A0A0A0", // 회색으로 설명 표시
        fontSize: 13,
        lineHeight: 18,
        paddingLeft: 8, // 이름과 맞추기 위해 살짝 들여쓰기
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
        fontSize: 12,
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
        fontSize: 26,
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
        fontSize: 12,
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
        fontSize: 16,
        fontWeight: "bold",
        fontFamily: 'neodgm',
    },
    hint: {
        color: "#A0A0E0",
        marginTop: 6,
        fontSize: 12,
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
        fontSize: 16,
        fontFamily: 'neodgm',
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
        position: 'absolute',      // ✅ 이미지 위에 띄우기 위해 절대 위치로 설정
        bottom: 0,                 // ✅ 이미지 하단에 배치
        left: 0,
        right: 0,
        maxHeight: '40%',          // ✅ 자막 박스의 최대 높이를 이미지의 40%로 제한
        backgroundColor: 'rgba(0, 0, 0, 0.7)', // ✅ 반투명한 배경으로 자막 가독성 확보
        padding: 16,
        borderTopLeftRadius: 12,   // ✅ 위쪽 모서리만 둥글게 처리하여 이미지와 자연스럽게 연결
        borderTopRightRadius: 12,
    },
    cinematicBox_noImage: {        // ✅ 이미지가 없을 때 사용할 기존 스타일
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
        fontSize: 15,
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
        fontSize: 14,
        fontWeight: "bold",
        marginBottom: 4,
        fontFamily: 'neodgm',
    },
    aiStatusText: {
        color: "#4CAF50",
        fontSize: 12,
        marginTop: 2,
        fontFamily: 'neodgm',
    },
    resultText: {
        color: "#E0E0E0",
        fontSize: 18,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 20,
        fontFamily: 'neodgm',
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
        fontFamily: 'neodgm',
    },
    modalMessage: {
        fontSize: 16,
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
        fontSize: 16,
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
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 5,
        fontFamily: 'neodgm',
    },
    resultDetails: {
        color: '#D4D4D4',
        fontSize: 14,
        lineHeight: 20,
        fontFamily: 'neodgm',
    },
    resultGrade: {
        fontSize: 16,
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
        fontSize: 16,
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
        aspectRatio: 1,      // 1024x1024 기본 가정
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
});