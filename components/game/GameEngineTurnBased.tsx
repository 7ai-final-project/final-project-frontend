// frontend\components\game\GameEngineTurnBased.tsx

// frontend\components\game\GameEngineTurnBased.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Modal,
    ScrollView, ActivityIndicator, Image, Animated, Alert,
} from "react-native";
import { Character } from "@/data/characters";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getSceneTemplate, renderSceneFromRound } from "@/util/ttrpg";
import { RoundResult, SceneTemplate, PerRoleResult, Grade, SceneTurnSpec, Choice } from "@/util/ttrpg"; // 타입 추가
import { endGame } from "@/services/api";

type Props = {
    roomId: string | string[];
    topic: string | string[];
    difficulty?: string | string[];
    selectedCharacter: Character;
    turnSeconds?: number;
};

type Player = { id: string; name: string; role: string };
type GameLog = { id: number; text: string; isImportant: boolean };
type GameState = {
    sceneIndex: number;
    players: Player[];
    turnOrder: string[];
    currentTurnIndex: number;
    logs: GameLog[];
    isSceneOver: boolean;
};

type Phase = "loading" | "gameplay" | "cinematic" | "end";

export default function GameEngineTurnBased({
    roomId,
    topic,
    difficulty = "초급",
    selectedCharacter,
    turnSeconds = 20,
}: Props) {
    const [phase, setPhase] = useState<Phase>("loading");
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [sceneTemplates, setSceneTemplates] = useState<SceneTemplate[]>([]);
    const [loadingScenesError, setLoadingScenesError] = useState<string | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isResultsModalVisible, setIsResultsModalVisible] = useState(false);
    const phaseAnim = useRef(new Animated.Value(1)).current;
    const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
    const [cinematicText, setCinematicText] = useState<string>("");
    const [turnResults, setTurnResults] = useState<PerRoleResult[]>([]);
    const [myChoiceId, setMyChoiceId] = useState<string | null>(null);
    const [remaining, setRemaining] = useState(turnSeconds);
    const timerRef = useRef<number | null>(null);
    const timerAnim = useRef(new Animated.Value(turnSeconds)).current;

    const myRole = useMemo(() => {
        if (!gameState) return null;
        return gameState.players.find(p => p.id === selectedCharacter.name)?.role ?? null;
    }, [gameState, selectedCharacter.name]);
    
    const performLocalTurnJudgement = (role: string, choiceId: string): PerRoleResult => {
        const tpl = getSceneTemplate(sceneTemplates, gameState!.sceneIndex);
        const turnSpec = tpl?.turns?.find(t => t.role === role);
        const choice = turnSpec?.choices?.find((c: Choice) => c.id === choiceId);
        const player = gameState!.players.find(p => p.role === role)!;
        
        const dice = Math.floor(Math.random() * 20) + 1;
        const appliedStat = choice?.appliedStat as keyof Character['stats'] ?? '행운';
        const statValue = selectedCharacter.name === player.id ? (selectedCharacter.stats[appliedStat] ?? 0) : 2;
        const modifier = choice?.modifier ?? 0;
        const total = dice + statValue + modifier;
        const DC = { "초급": 10, "중급": 13, "상급": 16 }[Array.isArray(difficulty) ? difficulty[0] : difficulty] ?? 10;
        
        let grade: Grade = "F";
        if (dice === 20) grade = "SP";
        else if (dice === 1) grade = "SF";
        else if (total >= DC) grade = "S";
        else grade = "F";
        
        return { role, choiceId, grade, dice, appliedStat, statValue, modifier, total };
    };

    useEffect(() => {
        if (sceneTemplates.length > 0) {
            const scene0 = getSceneTemplate(sceneTemplates, 0);
            if (!scene0 || !scene0.roleMap) {
                setLoadingScenesError("초기 씬의 roleMap을 찾을 수 없습니다.");
                return;
            }
            const players: Player[] = Object.entries(scene0.roleMap).map(([name, role]) => ({ id: name, name, role }));
            const turnOrderRoles = ["brother", "sister", "tiger", "goddess"];
            const turnOrder = turnOrderRoles.map(role => {
                const player = players.find(p => p.role === role);
                return player ? player.id : '';
            }).filter(Boolean);
            setGameState({
                sceneIndex: 0,
                players,
                turnOrder,
                currentTurnIndex: 0,
                logs: [{ id: 0, text: "게임 시작! 순서에 따라 진행합니다.", isImportant: true }],
                isSceneOver: false,
            });
            setPhase("gameplay");
        }
    }, [sceneTemplates]);

    const currentScene = useMemo(() => {
        if (!gameState || sceneTemplates.length === 0) return null;
        return getSceneTemplate(sceneTemplates, gameState.sceneIndex);
    }, [sceneTemplates, gameState]);
    
    const isMyTurn = useMemo(() => {
        if (!gameState || gameState.isSceneOver || phase !== 'gameplay') return false;
        const currentTurnPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
        return currentTurnPlayerId === selectedCharacter.name;
    }, [gameState, selectedCharacter.name, phase]);

    useEffect(() => {
        if (!gameState || !myRole || phase !== "gameplay" || !currentScene) return;

        const currentTurnPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
        const isMyTurnNow = currentTurnPlayerId === selectedCharacter.name;

        if (!isMyTurnNow && !gameState.isSceneOver) {
            const aiTurnTimeout = setTimeout(() => {
                const player = gameState.players.find(p => p.id === currentTurnPlayerId)!;
                const currentTurnSpecForAI = currentScene.turns?.find((t: SceneTurnSpec) => t.role === player.role);
                const choices = currentTurnSpecForAI?.choices ?? [];
                
                if (choices.length === 0) return;

                const randomChoice = choices[Math.floor(Math.random() * choices.length)];
                
                const result = performLocalTurnJudgement(player.role, randomChoice.id);
                setTurnResults(prev => [...prev, result]);

                setGameState(prev => {
                    if (!prev) return null;
                    const newLogs = [...prev.logs];
                    newLogs.push({ id: newLogs.length, text: `👉 [${player.name}] (이)가 '${randomChoice.text}' 선택지를 골랐습니다.`, isImportant: false });
                    newLogs.push({ id: newLogs.length, text: `🎲 d20(${result.dice}) + 스탯(${result.statValue}) + 보정(${result.modifier}) = 총합 ${result.total} → ${result.grade}`, isImportant: false });
                    
                    const nextTurnIndex = prev.currentTurnIndex + 1;
                    const isSceneOver = nextTurnIndex >= prev.turnOrder.length;
                    return { ...prev, logs: newLogs, currentTurnIndex: nextTurnIndex, isSceneOver };
                });
            }, 1500);

            return () => clearTimeout(aiTurnTimeout);
        }
    }, [gameState, myRole, phase, currentScene]);

    
    const handleReturnToRoom = () => setIsModalVisible(true);
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
                    if (isMyTurn) autoPickAndSubmit();
                    stopTimer();
                    return 0;
                }
                return r - 1;
            });
        }, 1000);
    };

    const stopTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerAnim.stopAnimation();
    };

    const submitChoice = (choiceId: string) => {
        if (!myRole) return;
        setMyChoiceId(choiceId);
        stopTimer();

        const result = performLocalTurnJudgement(myRole, choiceId);
        setTurnResults(prev => [...prev, result]);
        
        const choice = myChoices.find(c => c.id === choiceId)!;

        setGameState(prev => {
            if (!prev) return null;
            const newLogs = [...prev.logs];
            newLogs.push({ id: newLogs.length, text: `👉 [${selectedCharacter.name}] 님이 '${choice.text}' 선택지를 골랐습니다.`, isImportant: false });
            newLogs.push({ id: newLogs.length, text: `🎲 d20(${result.dice}) + 스탯(${result.statValue}) + 보정(${result.modifier}) = 총합 ${result.total} → ${result.grade}`, isImportant: false });
            
            const nextTurnIndex = prev.currentTurnIndex + 1;
            const isSceneOver = nextTurnIndex >= prev.turnOrder.length;
            return { ...prev, logs: newLogs, currentTurnIndex: nextTurnIndex, isSceneOver };
        });
    };
    
    const autoPickAndSubmit = () => {
        if (!isMyTurn) return;
        const choices = myChoices;
        if (choices.length > 0) {
            const rnd = choices[Math.floor(Math.random() * choices.length)];
            submitChoice(rnd.id);
        }
    };

    const finalizeRound = () => {
        const result: RoundResult = {
            sceneIndex: gameState!.sceneIndex,
            results: turnResults,
            logs: [],
        };
        setRoundResult(result);
        const text = renderSceneFromRound(currentScene!, result);
        setCinematicText(text || "결과를 바탕으로 이야기가 만들어졌습니다.");
        setPhase("cinematic");
    };
    
    useEffect(() => {
        const fetchScenes = async () => {
            try {
                const response = await fetch("http://localhost:8000/game/api/scenes/?mode=turn_based");
                if (!response.ok) throw new Error(`씬 데이터 로딩 실패: ${response.status}`);
                const data = await response.json();
                setSceneTemplates(data.scenes || data);
            } catch (error) {
                setLoadingScenesError(error instanceof Error ? error.message : "알 수 없는 오류");
            }
        };
        fetchScenes();
    }, []);

    useEffect(() => {
        if(isMyTurn) {
            startTimer();
            setMyChoiceId(null);
        } else {
            stopTimer();
        }
    }, [isMyTurn]);

    // ✅ 모든 Hook 호출을 조건부 리턴 앞으로 이동
    const currentTurnSpec = useMemo(() => {
        if (!gameState || !currentScene) return null;
        const currentTurnPlayer = gameState.players.find(p => p.id === gameState.turnOrder[gameState.currentTurnIndex]);
        if (!currentTurnPlayer) return null;
        return currentScene.turns?.find((turn: SceneTurnSpec) => turn.role === currentTurnPlayer.role) ?? null;
    }, [gameState, currentScene]);

    const myChoices = useMemo(() => {
        if (!isMyTurn || !currentTurnSpec) return [];
        return currentTurnSpec.choices ?? [];
    }, [isMyTurn, currentTurnSpec]);


    if (phase === 'loading' || !gameState) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#E2C044" />
                <Text style={styles.subtitle}>게임 데이터를 준비하는 중...</Text>
                {loadingScenesError && <Text style={styles.warn}>{loadingScenesError}</Text>}
            </View>
        );
    }
    
    const title = currentTurnSpec?.title ?? "턴을 기다리는 중...";
    const currentTurnPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
    const currentTurnPlayer = gameState.players.find(p => p.id === currentTurnPlayerId);

    const getGradeColor = (grade: Grade) => {
        switch (grade) { case "SP": return "#FFD700"; case "S": return "#4CAF50"; case "F": return "#F44336"; case "SF": return "#B00020"; default: return "#E0E0E0"; }
    };
    const getGradeText = (grade: Grade) => {
        switch (grade) { case "SP": return "치명적 대성공 (SP)"; case "S": return "성공 (S)"; case "F": return "실패 (F)"; case "SF": return "치명적 실패 (SF)"; default: return "알 수 없음"; }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.mainContainer}>
                <View style={styles.characterPanel}>
                    <Text style={styles.characterName}>{selectedCharacter.name}</Text>
                    <Image source={selectedCharacter.image} style={styles.characterImage} resizeMode="contain" />
                    <Text style={styles.roleText}>{myRole}</Text>
                    <View style={styles.statsBox}>
                        <Text style={styles.statsTitle}>능력치</Text>
                        {Object.entries(selectedCharacter.stats).map(([stat, value]) => (
                        <Text key={stat} style={styles.statText}>{stat}: <Text style={{ color: "#E2C044", fontWeight: "bold" }}>{value}</Text></Text>
                        ))}
                    </View>
                </View>

                <View style={styles.gamePanel}>
                    {phase === "gameplay" && (
                    <Animated.View style={[styles.contentBox, { opacity: phaseAnim, flex: 1 }]}>
                    <Text style={styles.title}>{title}</Text>
                    <View style={styles.turnIndicator}>
                        <Text style={styles.turnText}>
                        현재 턴: <Text style={{color: isMyTurn ? "#7C3AED" : "#E0E0E0"}}>{currentTurnPlayer?.name}</Text>
                        </Text>
                    </View>

                    {gameState.isSceneOver ? (
                        <View style={styles.center}>
                            <Text style={styles.subtitle}>모든 플레이어의 행동이 끝났습니다.</Text>
                            <TouchableOpacity style={styles.primary} onPress={() => finalizeRound()}>
                                <Text style={styles.primaryText}>결과 보기</Text>
                            </TouchableOpacity>
                        </View>
                    ) : isMyTurn ? (
                        <>
                        <View style={styles.timerContainer}>
                            <Animated.View style={[ styles.timerBar, { width: timerAnim.interpolate({ inputRange: [0, turnSeconds], outputRange: ['0%', '100%'] }) }]} />
                        </View>
                        <Text style={styles.timerText}>남은 시간: {remaining}s</Text>
                        <ScrollView>
                        {myChoices.map((c: Choice) => (
                            <TouchableOpacity
                            key={c.id}
                            style={[ styles.choiceBtn, myChoiceId === c.id && styles.selectedChoiceBtn ]}
                            disabled={!!myChoiceId}
                            onPress={() => submitChoice(c.id)}
                            >
                            <Text style={styles.choiceText}>{c.text}</Text>
                            <Text style={styles.hint}>적용 스탯: {c.appliedStat} (보정: {c.modifier >= 0 ? `+${c.modifier}` : c.modifier})</Text>
                            </TouchableOpacity>
                        ))}
                        </ScrollView>
                        </>
                    ) : (
                        <View style={styles.center}>
                        <ActivityIndicator size="large" color="#E2C044"/>
                        <Text style={styles.subtitle}>{currentTurnPlayer?.name}의 턴을 기다리는 중...</Text>
                        </View>
                    )}
                    </Animated.View>
                )}

                    {phase === "cinematic" && (
                    <Animated.View style={[styles.contentBox, { opacity: phaseAnim, flex: 1 }]}>
                        <Text style={styles.title}>{title}</Text>
                        <ScrollView style={styles.cinematicBox}>
                            <Text style={styles.cinematicText}>{cinematicText}</Text>
                        </ScrollView>
                        <TouchableOpacity style={styles.secondary} onPress={() => setIsResultsModalVisible(true)}>
                            <Text style={styles.secondaryText}>결과 상세 보기</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.primary} onPress={() => {
                            setGameState(prev => {
                                if (!prev) return null;
                                const nextSceneIndex = prev.sceneIndex + 1;
                                if (nextSceneIndex >= sceneTemplates.length) {
                                    setPhase("end");
                                    return prev;
                                }
                                const newLogs = [...prev.logs];
                                newLogs.push({id: newLogs.length, text: `--- 다음 이야기 시작 (Scene ${nextSceneIndex}) ---`, isImportant: true});
                                setTurnResults([]);
                                setMyChoiceId(null);
                                setRoundResult(null);
                                setCinematicText("");
                                setPhase("gameplay");
                                return {
                                    ...prev,
                                    sceneIndex: nextSceneIndex,
                                    currentTurnIndex: 0,
                                    isSceneOver: false,
                                    logs: newLogs,
                                };
                            });
                        }}>
                            <Text style={styles.primaryText}>다음 ▶</Text>
                        </TouchableOpacity>
                    </Animated.View>
                    )}

                    {phase === "end" && (
                        <View style={styles.center}>
                            <Text style={styles.title}>게임 종료</Text>
                            <Text style={styles.subtitle}>수고하셨습니다!</Text>
                        </View>
                    )}
                </View>
            </View>
        
            <TouchableOpacity style={styles.returnButton} onPress={handleReturnToRoom}>
                <Ionicons name="exit-outline" size={24} color="#E0E0E0" />
            </TouchableOpacity>
            
            <Modal visible={isModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsModalVisible(false)}>
                <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>방으로 돌아가기</Text>
                    <Text style={styles.modalMessage}>정말로 게임을 중단하고 방으로 돌아가시겠습니까?{"\n"}현재 게임 상태는 초기화됩니다.</Text>
                    <View style={styles.modalButtonContainer}>
                    <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsModalVisible(false)}>
                        <Text style={styles.modalButtonText}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={confirmReturnToRoom}>
                        <Text style={styles.modalButtonText}>확인</Text>
                    </TouchableOpacity>
                    </View>
                </View>
                </View>
            </Modal>
            
            <Modal visible={isResultsModalVisible} transparent={true} animationType="slide" onRequestClose={() => setIsResultsModalVisible(false)}>
                <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>라운드 결과 요약</Text>
                    <ScrollView style={styles.resultsScrollView}>
                    {turnResults?.map((result, index) => {
                        const turnSpec = currentScene?.turns?.find((t: SceneTurnSpec) => t.role === result.role);
                        const choiceText = turnSpec?.choices?.find((c: Choice) => c.id === result.choiceId)?.text || "선택 정보를 찾을 수 없음";
                        return (
                        <View key={index} style={styles.resultItem}>
                            <Text style={styles.resultRole}>{result.role}</Text>
                            <Text style={styles.resultDetails}>- 선택: "{choiceText}"</Text>
                            <Text style={styles.resultDetails}>- 판정: d20({result.dice}) + 스탯({result.statValue}) + 보정({result.modifier}) = 총합 {result.total}</Text>
                            <Text style={[styles.resultGrade, { color: getGradeColor(result.grade) }]}>⭐ 등급: {getGradeText(result.grade)}</Text>
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#0B1021" },
    mainContainer: { flex: 1, flexDirection: "row", padding: 20, gap: 20 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    warn: { color: "#ff6b6b", fontSize: 18, fontWeight: "bold", textAlign: "center" },
    subtitle: { color: "#D4D4D4", fontSize: 14, marginTop: 4, textAlign: "center" },
    characterPanel: { width: "30%", backgroundColor: "#161B2E", borderRadius: 20, padding: 20, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 8 },
    characterImage: { width: "100%", height: 180 },
    characterName: { fontSize: 22, fontWeight: "bold", color: "#E0E0E0", marginBottom: 8 },
    roleText: { fontSize: 16, color: "#A0A0A0", fontStyle: "italic", marginBottom: 10 },
    statsBox: { width: "100%", marginTop: 15, padding: 15, backgroundColor: "#0B1021", borderRadius: 12 },
    statsTitle: { fontSize: 16, fontWeight: "bold", color: "#E0E0E0", marginBottom: 8, textAlign: "center" },
    statText: { color: "#D4D4D4", fontSize: 14, lineHeight: 22 },
    gamePanel: { flex: 1 },
    contentBox: { backgroundColor: "#161B2E", borderRadius: 20, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 8 },
    title: { color: "#E0E0E0", fontSize: 26, fontWeight: "bold", marginBottom: 8, textAlign: "center" },
    timerContainer: { height: 8, backgroundColor: "#333", borderRadius: 4, marginTop: 10, overflow: "hidden" },
    timerBar: { height: "100%", backgroundColor: "#7C3AED" },
    timerText: { color: "#888", fontSize: 12, textAlign: "center", marginTop: 4 },
    choiceBtn: { backgroundColor: "#2C344E", padding: 16, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: "#444" },
    selectedChoiceBtn: { backgroundColor: "#4CAF50", borderColor: "#4CAF50" },
    choiceText: { color: "#E0E0E0", fontSize: 16, fontWeight: "bold" },
    hint: { color: "#A0A0A0", marginTop: 6, fontSize: 12 },
    secondary: { marginTop: 16, borderWidth: 1, borderColor: "#666", paddingVertical: 12, borderRadius: 8, alignItems: "center" },
    secondaryText: { color: "#ddd", fontWeight: "bold" },
    primary: { marginTop: 20, backgroundColor: "#7C3AED", paddingVertical: 14, borderRadius: 10, alignItems: "center" },
    primaryText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
    cinematicBox: { flex: 1, marginTop: 16, backgroundColor: "#222736", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#444" },
    cinematicText: { color: "#E0E0E0", fontSize: 15, lineHeight: 22 },
    retryBtn: { marginTop: 16, backgroundColor: "#4CAF50", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    retryText: { color: "#fff", fontWeight: "bold" },
    returnButton: { position: 'absolute', top: 95, right: 20, zIndex: 9999, backgroundColor: 'rgba(44, 52, 78, 0.8)', padding: 8, borderRadius: 50, borderWidth: 1, borderColor: '#444', justifyContent: 'center', alignItems: 'center', width: 40, height: 40 },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.7)' },
    modalContent: { width: '40%', backgroundColor: '#161B2E', borderRadius: 20, padding: 25, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, borderWidth: 1, borderColor: '#444' },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#E0E0E0', marginBottom: 15 },
    modalMessage: { fontSize: 16, color: '#D4D4D4', textAlign: 'center', marginBottom: 25, lineHeight: 24 },
    modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
    modalButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginHorizontal: 10 },
    cancelButton: { backgroundColor: '#4A5568' },
    confirmButton: { backgroundColor: '#E53E3E' },
    modalButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    resultsScrollView: { maxHeight: 300, width: '100%', paddingHorizontal: 10 },
    resultItem: { backgroundColor: '#222736', borderRadius: 10, padding: 15, marginBottom: 10 },
    resultRole: { color: '#E2C044', fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
    resultDetails: { color: '#D4D4D4', fontSize: 14, lineHeight: 20 },
    resultGrade: { fontSize: 16, fontWeight: 'bold', marginTop: 8 },
    modalCloseButton: { marginTop: 20, backgroundColor: '#7C3AED', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 10, alignItems: 'center' },
    turnIndicator: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#0B1021', borderRadius: 20, marginBottom: 16, alignSelf: 'center' },
    turnText: { color: '#A0A0A0', fontSize: 16, fontWeight: 'bold' },
});