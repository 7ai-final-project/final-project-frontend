import React, { useState, useEffect } from 'react';
import { ArrowLeft, X, Wifi, Settings } from 'lucide-react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, ImageBackground, LayoutAnimation, UIManager, Platform, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import api from '../../../services/api';
import OptionsModal from '../../../components/OptionsModal'; 


if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Story {
  id: string;
  identifier: string;
  title: string;
  description: string;
  image_path: string | null;
  world: string; 
}
const storyImages = [
    require('../../../assets/images/game/multi_mode/background/sun_and_moon.jpg'),
    require('../../../assets/images/game/multi_mode/background/well_ghost.jpg'),
    require('../../../assets/images/game/multi_mode/background/good_brothers.jpg'),
];

export default function StorySelectorScreen() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

  const [optionsModalVisible, setOptionsModalVisible] = useState(false);

  const [isBgmOn, setIsBgmOn] = useState(true);
  const [isSfxOn, setIsSfxOn] = useState(true);
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState(1);
  const [backgroundColor, setBackgroundColor] = useState('#1a202c');

    // 이야기 목록 조회
    useEffect(() => {
        const fetchStories = async () => {
            try {
                const response = await api.get('game/story/stories/');
                console.log(response);
                
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
    const handleStorySelect = () => {
        // 선택된 스토리를 params로 전달하여 play.tsx로 이동
        router.push({
          pathname: "/game/story/play",
          params: { storyId: selectedStoryId },
        });
    };
    
  // ★★★ 4. 카드 선택 시 애니메이션과 함께 상태를 업데이트하는 함수 ★★★
  const handleCardPress = (storyId: string) => {
    // 부드러운 애니메이션 효과를 적용합니다.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    // 이미 선택된 카드를 다시 누르면 선택을 해제하고, 다른 카드를 누르면 선택을 변경합니다.
    setSelectedStoryId(prevId => prevId === storyId ? null : storyId);
  };

const renderStoryCard = (story: Story, index: number) => { // ★★★ 2. map의 index를 인자로 받습니다. ★★★
    const isSelected = selectedStoryId === story.id;
    // ★★★ 3. 백엔드 데이터 대신, 우리 배열의 index를 사용하여 이미지를 가져옵니다. ★★★
    // 만약 stories 개수가 이미지 개수보다 많아도, 나머지는 undefined가 되어 이미지가 표시되지 않습니다.
    const imageSource = storyImages[index];

    return (
        <TouchableOpacity
            key={story.id}
            style={[
            Platform.OS === 'web' ? styles.cardWrapperWeb : styles.cardWrapperMobile,
            isSelected && styles.selectedCardWrapper
            ]}
            onPress={() => handleCardPress(story.id)}
            activeOpacity={0.9}
        >
    {/* ★★★ 여기가 수정된 부분입니다! ★★★ */}
            {/* 1. ImageBackground 대신, 배경색을 가진 View를 사용합니다. */}
            <View style={styles.cardBackground}>
            {/* 2. 그 안에 Image 컴포넌트를 넣고, resizeMode를 'contain'으로 설정합니다. */}
            <Image 
                source={imageSource}
                style={styles.cardImage}
                resizeMode="contain" 
            />
            {/* 3. 이미지 위에 텍스트를 올리는 부분은 그대로 유지됩니다. */}
            <View style={styles.cardTitleContainer}>
                <Text style={styles.cardTitle}>{story.id}</Text>
            </View>
            </View>
            
            {isSelected && (
            <View style={styles.cardContent}>
                <Text style={styles.cardWorld}>{story.world}</Text>
                <Text style={styles.cardDesc}>{story.description}</Text>
            </View>
            )}
        </TouchableOpacity>
        );
  };

  // ★★★ 5. FlatList의 각 아이템을 렌더링하는 함수를 분리합니다. ★★★
  const renderStoryItem = ({ item }: { item: Story }) => {
    const isSelected = selectedStoryId === item.id;

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          Platform.OS === 'web' ? styles.cardWrapperWeb : styles.cardWrapperMobile,
          isSelected && styles.selectedCardWrapper
        ]}
        onPress={() => handleCardPress(item.id)}
        activeOpacity={0.9}
      >
        <ImageBackground 
          style={styles.cardBackground}
          resizeMode="cover"
          borderRadius={12}
        >
          <View style={styles.cardOverlay} />
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle}>{item.title}</Text>
          </View>
        </ImageBackground>
        
        {isSelected && (
          <View style={styles.cardContent}>
            <Text style={styles.cardWorld}>{item.world}</Text>
            <Text style={styles.cardDesc}>{item.description}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };
    // 로딩 뷰
    if(loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#61dafb" />
        <Text style={styles.loadingText}>이야기를 불러오는 중...</Text>
      </View>
    );
  }

    // 스토리 선택 뷰
return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color="white" />
          <Text style={styles.headerButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>스토리 선택</Text>
        <View style={styles.headerIcons}>
          <Wifi color="#4CAF50" size={24} />
          <TouchableOpacity onPress={() => setOptionsModalVisible(true)}>
            <Settings size={24} color="white" />
          </TouchableOpacity>
        </View>
      <OptionsModal
        visible={optionsModalVisible}
        onClose={() => setOptionsModalVisible(false)}
        isBgmOn={isBgmOn}
        setIsBgmOn={setIsBgmOn}
        isSfxOn={isSfxOn}
        setIsSfxOn={setIsSfxOn}
        fontSizeMultiplier={fontSizeMultiplier}
        setFontSizeMultiplier={setFontSizeMultiplier}
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
      />
      </View>

       {/* ★★★ 1. ScrollView를 FlatList로 교체합니다. ★★★ */}
        {/* ★★★ 3. Platform.OS 값에 따라 다른 컴포넌트를 렌더링합니다. ★★★ */}
      {Platform.OS === 'web' ? (
        // 웹 환경일 경우: 가로 ScrollView 사용
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContainerWeb}
        >
         {stories.map((story, index) => renderStoryCard(story, index))}
        </ScrollView>
      ) : (
        // 모바일 환경일 경우: 세로 FlatList 사용
        <FlatList
          data={stories}
          renderItem={({ item, index }) => renderStoryCard(item, index)}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainerMobile}
          ItemSeparatorComponent={() => <View style={{ height: 20 }} />}
        />
      )}


      {/* ★★★ 2 & 3. 하단 액션 버튼 수정 ★★★ */}
      <View style={styles.bottomActions}>
        {/* Cancel 버튼을 삭제했습니다. */}
        <TouchableOpacity 
          style={[
            styles.actionButton, 
            styles.startButton,
            // selectedStoryId가 null이면 (선택된 스토리가 없으면) 버튼을 비활성화합니다.
            selectedStoryId === null && styles.disabledButton
          ]} 
          onPress={handleStorySelect}
          disabled={selectedStoryId === null}
        >
          <Text style={[styles.actionButtonText, styles.startButtonText]}>
            Start Story
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a202c' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a202c',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButtonText: {
    color: 'white',
    fontSize: 18,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontFamily: 'neodgm',
    fontWeight: 'bold',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
 listContainerWeb: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
cardWrapperWeb: {
    width: 450,
    marginHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#374151', // 카드의 기본 배경색
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    overflow: 'hidden', // 자식 요소가 둥근 모서리를 넘어가지 않도록
  },

  // --- 모바일 (세로 스크롤) 스타일 ---
 listContainerMobile: {
    // 가로 방향 패딩을 주어 카드들이 화면 가장자리에 붙지 않도록 합니다.
    paddingHorizontal: 20,
    // 상하 패딩도 추가하여 전체적인 여백을 확보합니다.
    paddingVertical: 20,
  },
 cardWrapperMobile: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#374151',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    overflow: 'hidden',
  },

  // --- 카드 공통 스타일 ---
  selectedCardWrapper: {
    borderColor: '#60a5fa',
    borderWidth: 2,
  },
  cardBackground: {
    height: 250,
    backgroundColor: '#2d3748', 
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
  },

  cardImage: {
    width: '100%',
    height: '100%',
  },
 cardTitleContainer: {
    position: 'absolute',
    bottom: 10,
    left: 15,
    right: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // 텍스트 가독성을 위한 반투명 배경
    padding: 5,
    borderRadius: 5,
  },
  cardTitle: {
    color: 'white',
    fontSize: 20,
    fontFamily: 'neodgm',
    fontWeight: 'bold',
    textAlign: 'center', // 제목을 중앙 정렬
  },
  cardContent: {
    padding: 15,
    backgroundColor: '#2d3748',
    // 확장되는 부분은 둥근 모서리가 필요 없습니다.
  },
  // 확장되었을 때만 보이는 세계관 텍스트
  cardWorld: {
    color: '#a0aec0',
    fontSize: 17,
    fontFamily: 'neodgm',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  // 확장되었을 때만 보이는 상세 설명 텍스트
  cardDesc: {
    color: '#e2e8f0',
    fontSize: 14,
    fontFamily: 'neodgm',
    lineHeight: 20,
  },
  selectionIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionCheck: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'neodgm',
    fontWeight: 'bold',
  },
  bottomActions: {
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2d3748',
  },
  actionButton: {
    alignItems: 'center',
    width: 200, // 또는 '80%' 
    paddingVertical: 15,
    borderRadius: 8,
  },
  startButton: {
    backgroundColor: '#2563eb',
  },
  disabledButton: {
    backgroundColor: '#4b5563',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'neodgm',
  },
  startButtonText: {
    fontWeight: '600',
  },
});