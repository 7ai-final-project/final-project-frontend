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
import { Character, endGame, getWebSocketNonce } from "@/services/api";
import { getStatValue, statMapping, RoundResult, SceneRoundSpec, SceneTemplate, PerRoleResult, Grade, renderSceneFromRound } from "@/util/ttrpg";
import { Audio } from "expo-av";

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
    setupData, // [수정] selectedCharacter 대신 setupData를 받습니다.
    turnSeconds = 20,
}: Props) {
    // [수정] setupData에서 필요한 정보를 구조 분해 할당합니다.
    const { myCharacter, aiCharacters, allCharacters } = setupData;

    const wsRef = useRef<WebSocket | null>(null);
    const ws = wsRef?.current ?? null;

    // --- 상태(State) 변수 ---
    const [phase, setPhase] = useState<Phase>("intro");

    const [clickSound, setClickSound] = useState<Audio.Sound | null>(null);
    const [pageTurnSound, setPageTurnSound] = useState<Audio.Sound | null>(null);
    const [diceRollSound, setDiceRollSound] = useState<Audio.Sound | null>(null);
    
    // [수정] sceneTemplates 배열 대신, 현재 씬 객체 하나만 관리합니다.
    const [currentScene, setCurrentScene] = useState<SceneTemplate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // [수정] 로딩 및 에러 상태 이름을 명확히 변경합니다. (기존 loadingScenes, loadError 대체)
    // const [sceneTemplates, setSceneTemplates] = useState<SceneTemplate[]>([]);
    // const [loadingScenes, setLoadingScenes] = useState(true);
    // const [loadError, setLoadError] = useState<string | null>(null);

    const [diceResult, setDiceResult] = useState<string | null>(null);
    const [isRolling, setIsRolling] = useState(false);
    const spinValue = useRef(new Animated.Value(0)).current;

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isResultsModalVisible, setIsResultsModalVisible] = useState(false);

    const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
    const [saveModalMessage, setSaveModalMessage] = useState("");

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

    const timerAnim = useRef(new Animated.Value(turnSeconds)).current;

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

                // --- 1. 웹소켓 이벤트 핸들러 정의 ---
                ws.onopen = () => {
                    console.log("✅ GameEngineRealtime WebSocket Connected");
                    setIsLoading(true); // 로딩 시작
                    // 연결 성공 후, 첫 장면 요청
                    ws?.send(JSON.stringify({
                        type: "request_initial_scene",
                        topic: Array.isArray(topic) ? topic[0] : topic,
                        characters: setupData.allCharacters.map(c => ({
                            name: c.name,
                            description: c.description
                        })),
                    }));
                };

                ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    console.log("GameEngine received message:", data);

                    if (data.type === "game_update" && data.payload.event === "scene_update") {
                        setCurrentScene(data.payload.scene);
                        setPhase("choice");
                        setMyChoiceId(null);
                        setRoundResult(null);
                        setCinematicText("");
                        setSubmitting(false);
                        setAiChoices({}); // [수정] 새 씬 시작 시 선택 현황 초기화
                        setIsLoading(false);
                        pageTurnSound?.replayAsync();

                        phaseAnim.setValue(0);
                        Animated.timing(phaseAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
                    } 
                    // [추가] 다른 참여자 선택 정보 수신 로직
                    else if (data.type === "game_update" && data.payload.event === "choice_update") {
                        setAiChoices(prev => ({...prev, ...data.payload.choices}));
                    }
                    // [추가] 서버로부터 최종 라운드 결과 수신 로직 (3번 기능에 필요)
                    else if (data.type === "game_update" && data.payload.event === "round_result") {
                        setRoundResult(data.payload.result);
                        if (currentScene) {
                            const text = renderSceneFromRound(currentScene, data.payload.result);
                            setCinematicText(text);
                        }
                        // 모든 결과가 도착했으므로 cinematic으로 전환
                        setPhase("cinematic");
                    }
                    else if (data.type === "save_success") {
                        setSaveModalMessage(data.message);
                        setIsSaveModalVisible(true);
                    }
                    else if (data.type === "error") {
                        setError(data.message);
                        setIsLoading(false);
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

        // --- 2. 연결 실행 ---
        connect();

        // --- 3. 컴포넌트 종료 시 연결 해제 ---
        return () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
            stopTimer(); // 타이머도 함께 정리
        };
    }, [roomId, topic, setupData]);

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
            } catch (error) { console.error("사운드 로딩 실패:", error); }
        };
        loadSounds();
        return () => {
            clickSound?.unloadAsync();
            pageTurnSound?.unloadAsync();
            diceRollSound?.unloadAsync();
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
            if (!myChoice || !myRole) {
                setDiceResult("오류: 선택지를 찾을 수 없습니다.");
                setIsRolling(false);
                return;
            }

            const myDice = rollDice(20);
            const myAppliedStatKorean = myChoice.appliedStat;
            const myAppliedStatEnglish = statKrToEn[myAppliedStatKorean] as EnglishStat;
            const myStatValue = getStatValue(myCharacter, myAppliedStatEnglish) ?? 0;
            const myModifier = myChoice.modifier;
            const myTotal = myDice + myStatValue + myModifier;
            const DC = getDC(difficulty);

            let myGrade: Grade = "F";
            let resultText = "";
            if (myDice === 20) { myGrade = "SP"; resultText = "치명적 대성공 🎉 (Natural 20!)"; } 
            else if (myDice === 1) { myGrade = "SF"; resultText = "치명적 실패 💀 (Natural 1...)"; }
            else if (myTotal >= DC) { myGrade = "S"; resultText = `성공 ✅ (목표 DC ${DC} 이상 달성)`; }
            else { myGrade = "F"; resultText = `실패 ❌ (목표 DC ${DC} 미달)`; }
            
            setDiceResult(`🎲 d20: ${myDice} + ${myAppliedStatKorean}(${myStatValue}) + 보정(${myModifier}) = ${myTotal} → ${resultText}`);
            setIsRolling(false);

            const myResult: PerRoleResult = {
                role: myRole,
                choiceId: myChoiceId!,
                grade: myGrade,
                dice: myDice, appliedStat: myChoice.appliedStat, statValue: myStatValue, modifier: myModifier, total: myTotal,
            };

            // [수정] AI 캐릭터들의 역할 정보만 담아서 전달 (실제 판정값은 LLM이 생성한 fragments에 따름)
            const aiResults: PerRoleResult[] = aiCharacters.map(aiChar => ({
                role: currentScene?.roleMap?.[aiChar.name] ?? "unknown",
                choiceId: "ai_choice", grade: "S",
                dice: 0, appliedStat: "hp", statValue: 0, modifier: 0, total: 0,
            }));

            const finalResult: RoundResult = {
                sceneIndex: currentScene?.index ?? 0,
                results: [myResult, ...aiResults],
                logs: [],
            };
            setRoundResult(finalResult);

            if (currentScene) {
                const text = renderSceneFromRound(currentScene, finalResult);
                setCinematicText(text);
            }
            
            // 애니메이션과 함께 cinematic 단계로 전환
            Animated.timing(phaseAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
                setPhase("cinematic");
                Animated.timing(phaseAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
            });
        }, 2000);
    };

    const submitChoice = (choiceId: string) => {
        if (!ws || !myRole || !currentScene) return;
        const choice = roundSpec?.choices[myRole]?.find(c => c.id === choiceId);
        if (!choice) return;

        clickSound?.replayAsync();
        setSubmitting(true);
        setMyChoiceId(choiceId);

        // [수정] 선택한 내용을 웹소켓으로 서버에 전송
        ws.send(JSON.stringify({
            type: "submit_choice",
            choice: {
                role: myRole,
                choiceId: choice.id,
                text: choice.text,
                sceneIndex: currentScene.index
            }
        }));
        
        stopTimer();
        setPhase("dice_roll"); // 서버 응답 대기
    };

    const autoPickAndSubmit = () => {
        if (submitting || myChoices.length === 0) return;
        const randomChoice = myChoices[Math.floor(Math.random() * myChoices.length)];
        submitChoice(randomChoice.id);
    };
    
    const handleNextScene = () => {
        if (!ws || !myRole || !myChoiceId || !currentScene) return;

        // 로딩 상태로 전환
        setIsLoading(true);

        const myLastChoice = myChoices.find(c => c.id === myChoiceId);
        if (!myLastChoice) return;

        // 다음 씬을 요청하기 위해 마지막 선택 정보를 다시 보냅니다.
        ws.send(JSON.stringify({
            type: "submit_choice",
            choice: {
                role: myRole,
                choiceId: myLastChoice.id,
                text: `(다음 장면으로 넘어감)`,
                sceneIndex: currentScene.index,
            }
        }));
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
            selectedChoice: selectedChoiceFormatted
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
    }

    const myChoices = roundSpec.choices[myRole] ?? [];
    const title = roundSpec.title;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.mainContainer}>
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
                    <Text style={styles.roleText}>{myRole}</Text>
                    <View style={styles.statsBox}>
                        <Text style={styles.statsTitle}>능력치</Text>
                        {Object.entries(myCharacter.stats).map(([stat, value]) => (
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
                            <Text style={styles.subtitle}>GM이 다음 이야기를 준비하는 중...</Text>
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
                                style={styles.primary}
                                onPress={handleNextScene}
                            >
                                <Text style={styles.primaryText}>다음 ▶</Text>
                            </TouchableOpacity>
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
                                const appliedStatKr = statMapping[result.appliedStat as EnglishStat] ?? result.appliedStat;
                                return (
                                    <View key={index} style={styles.resultItem}>
                                        <Text style={styles.resultRole}>
                                            {result.role} {result.role === myRole ? '(나)' : ''}
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