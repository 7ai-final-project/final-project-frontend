import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import api from '../../../services/api';


export default function MainScreen() {
    const [stories, setStories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // 이야기 목록 조회
    useEffect(() => {
        const fetchStories = async () => {
            try {
                const response = await api.get('game/story/stories/');
                setStories(Object.values(response.data));
            } catch (error) {
                console.error("이야기 목록 로딩 실패:", error);
                alert("이야기 목록을 불러올 수 없습니다. 서버를 확인해주세요.");
            } finally {
                setLoading(false);
            }
        };
        fetchStories();
    }, []);

    // 이야기 선택
    const handleStorySelect = (story: any) => {
        // 선택된 스토리를 params로 전달하여 play.tsx로 이동
        router.push({
          pathname: "/game/story/play",
          params: { storyId: story.id.toString() },
        });
    };

    // 로딩 뷰
    if(loading) {
        return <View style={styles.container}><ActivityIndicator size="large" color="#61dafb" /></View>;
    }

    // 스토리 선택 뷰
    return (
        <View style={styles.container}>
            <Text style={styles.title}>플레이할 이야기를 선택하세요</Text>
            {stories.map(story => (
                <TouchableOpacity key={story.id} style={styles.card} onPress={() => handleStorySelect(story)}>
                    <Text style={styles.cardTitle}>{story.id}</Text>
                    <Text style={styles.cardDesc}>{story.description}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 20, backgroundColor: "#3c414e" },
    title: { fontSize: 24, color: 'white', fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    card: { backgroundColor: 'rgba(0,0,0,0.3)', padding: 20, borderRadius: 10, width: '90%' },
    cardTitle: { fontSize: 20, color: '#61dafb', fontWeight: 'bold' },
    cardDesc: { fontSize: 14, color: 'white', marginTop: 10, lineHeight: 20 },
});