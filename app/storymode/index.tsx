import React, { useState, useEffect } from "react";
import { ArrowLeft, X, Wifi, Settings } from "lucide-react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  ImageBackground,
  LayoutAnimation,
  UIManager,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { router } from "expo-router";
import api from "../../services/api";
import OptionsModal from "../../components/OptionsModal";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Story {
  id: string;
  title: string;
  title_eng: string;
  description: string;
  description_eng: string;
  is_display: boolean;
  is_deleted: boolean;
  has_saved_session: boolean;
  image_path: string | null;
}

const storyImages: { [key: string]: any } = {
  "Sun and Moon": require("../../assets/images/game/multi_mode/background/sun_and_moon.jpg"),
  "well-ghost": require("../../assets/images/game/multi_mode/background/well_ghost.jpg"),
  good_brothers: require("../../assets/images/game/multi_mode/background/good_brothers.jpg"),
};

export default function StorySelectorScreen() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

  const [optionsModalVisible, setOptionsModalVisible] = useState(false);

  const [isBgmOn, setIsBgmOn] = useState(true);
  const [isSfxOn, setIsSfxOn] = useState(true);
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState(1);
  const [backgroundColor, setBackgroundColor] = useState("#1a202c");

  // 이야기 목록 조회
  useEffect(() => {
    const fetchStories = async () => {
      try {
        const response = await api.get("storymode/story/stories/");
        const data = response.data;
        // console.log('Fetched stories: ', data.stories);
        setStories(data.stories);
      } catch (error: any) {
        console.error("스토리 로드 중 오류 발생: ", error);
        alert("이야기 목록을 불러올 수 없습니다. 서버를 확인해주세요.");
      } finally {
        setLoading(false);
      }
    };
    fetchStories();
  }, []);

  // 이야기 선택
  const handleStorySelect = (shouldContinue: boolean) => {
    const selectedStory = stories.find((story) => story.id === selectedStoryId);

    if (selectedStory) {
      // 선택된 스토리를 params로 전달하여 play.tsx로 이동
      router.push({
        pathname: "/storymode/play",
        params: {
          story: selectedStory.title,
          should_continue: shouldContinue ? "true" : "false",
        },
      });
    }
  };

  // 카드 선택 애니메이션
  const handleCardPress = (storyId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedStoryId((prevId) => (prevId === storyId ? null : storyId));
  };

  const renderStoryCard = (story: Story) => {
    const isSelected = selectedStoryId === story.id;
    const imageSource = story.image_path // 1. DB에 이미지 경로가 있는지 확인합니다.
      ? { uri: story.image_path } // 2. 있다면, { uri: ... } 형태로 사용합니다.
      : require("../../assets/images/game/multi_mode/background/sun_and_moon.jpg"); // 3. 없다면, 기본 이미지를 보여줍니다.
    return (
      <TouchableOpacity
        key={story.id}
        style={[
          Platform.OS === "web"
            ? styles.cardWrapperWeb
            : styles.cardWrapperMobile,
          isSelected && styles.selectedCardWrapper,
        ]}
        onPress={() => handleCardPress(story.id)}
        activeOpacity={0.9}
      >
        <View style={styles.cardBackground}>
          {imageSource && (
            <Image
              source={imageSource}
              style={styles.cardImage}
              resizeMode="contain"
            />
          )}
          {!imageSource && (
            <View style={styles.placeholderImage}>
              <Text style={{ color: "white" }}>No Image</Text>
            </View>
          )}
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle}>{story.title}</Text>
          </View>
        </View>

        {isSelected && (
          <View style={styles.cardContent}>
            <Text style={styles.cardWorld}>{story.title}</Text>
            <Text style={styles.cardDesc}>{story.description}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // 로딩 뷰
  if (loading) {
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
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color="white" />
          <Text style={styles.headerButtonText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>스토리 선택</Text>
        <View style={styles.headerIcons}>
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

      {Platform.OS === "web" ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContainerWeb}
        >
          {stories.map((story) => renderStoryCard(story))}
        </ScrollView>
      ) : (
        <FlatList
          data={stories}
          renderItem={({ item }) => renderStoryCard(item)}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainerMobile}
          ItemSeparatorComponent={() => <View style={{ height: 20 }} />}
        />
      )}

      <View style={styles.bottomActions}>
        {/* 선택된 스토리가 있을 때만 버튼 영역을 보여줍니다. */}
        {selectedStoryId &&
          (() => {
            // 현재 선택된 스토리 객체를 찾습니다.
            const selectedStory = stories.find((s) => s.id === selectedStoryId);

            // 저장된 데이터가 있는지 확인합니다.
            if (selectedStory?.has_saved_session) {
              // 💾 저장된 데이터가 있을 경우: '이어하기'와 '새로하기' 버튼을 보여줍니다.
              return (
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.continueButton]}
                    onPress={() => handleStorySelect(true)} // true: 이어하기
                  >
                    <Text style={styles.actionButtonText}>이어서 하기</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.restartButton]}
                    onPress={() => handleStorySelect(false)} // false: 새로하기
                  >
                    <Text style={styles.actionButtonText}>처음부터 시작</Text>
                  </TouchableOpacity>
                </View>
              );
            } else {
              // 💾 저장된 데이터가 없을 경우: '시작하기' 버튼만 보여줍니다.
              return (
                <TouchableOpacity
                  style={[styles.actionButton, styles.startButton]}
                  onPress={() => handleStorySelect(false)} // false: 새로하기
                >
                  <Text
                    style={[styles.actionButtonText, styles.startButtonText]}
                  >
                    Start Story
                  </Text>
                </TouchableOpacity>
              );
            }
          })()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a202c" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a202c",
  },
  loadingText: {
    color: "white",
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 40,
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButtonText: {
    color: "white",
    fontSize: 18,
    fontFamily: "neodgm",
  },
  headerTitle: {
    color: "white",
    fontSize: 24,
    fontFamily: "neodgm",
    fontWeight: "bold",
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  listContainerWeb: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  cardWrapperWeb: {
    width: 450,
    marginHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#374151", // 카드의 기본 배경색
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    overflow: "hidden", // 자식 요소가 둥근 모서리를 넘어가지 않도록
  },

  // --- 모바일 (세로 스크롤) 스타일 ---
  listContainerMobile: {
    // 가로 방향 패딩을 주어 카드들이 화면 가장자리에 붙지 않도록 합니다.
    paddingHorizontal: 20,
    // 상하 패딩도 추가하여 전체적인 여백을 확보합니다.
    paddingVertical: 20,
  },
  cardWrapperMobile: {
    width: "100%",
    borderRadius: 12,
    backgroundColor: "#374151",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    overflow: "hidden",
  },

  // --- 카드 공통 스타일 ---
  selectedCardWrapper: {
    borderColor: "#60a5fa",
    borderWidth: 2,
  },
  cardBackground: {
    height: 250,
    backgroundColor: "#2d3748",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 12,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#4a5568",
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitleContainer: {
    position: "absolute",
    bottom: 10,
    left: 15,
    right: 15,
    backgroundColor: "rgba(0, 0, 0, 0.5)", // 텍스트 가독성을 위한 반투명 배경
    padding: 5,
    borderRadius: 5,
  },
  cardTitle: {
    color: "white",
    fontSize: 20,
    fontFamily: "neodgm",
    fontWeight: "bold",
    textAlign: "center", // 제목을 중앙 정렬
  },
  cardContent: {
    padding: 15,
    backgroundColor: "#2d3748",
    // 확장되는 부분은 둥근 모서리가 필요 없습니다.
  },
  // 확장되었을 때만 보이는 세계관 텍스트
  cardWorld: {
    color: "#a0aec0",
    fontSize: 17,
    fontFamily: "neodgm",
    fontStyle: "italic",
    marginBottom: 8,
  },
  // 확장되었을 때만 보이는 상세 설명 텍스트
  cardDesc: {
    color: "#e2e8f0",
    fontSize: 14,
    fontFamily: "neodgm",
    lineHeight: 20,
  },
  selectionIndicator: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  selectionCheck: {
    color: "white",
    fontSize: 12,
    fontFamily: "neodgm",
    fontWeight: "bold",
  },
  bottomActions: {
    alignItems: "center",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#2d3748",
  },
  actionButton: {
    alignItems: "center",
    width: 200, // 또는 '80%'
    paddingVertical: 15,
    borderRadius: 8,
  },
  startButton: {
    backgroundColor: "#2563eb",
  },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20, // 버튼 사이의 간격
  },
  continueButton: {
    backgroundColor: "#1d4ed8", // '이어하기' 버튼 색상 (파란색 계열)
    flex: 1, // 공간을 균등하게 차지
  },
  restartButton: {
    backgroundColor: "#6b7280", // '새로하기' 버튼 색상 (회색 계열)
    flex: 1, // 공간을 균등하게 차지
  },
  disabledButton: {
    backgroundColor: "#4b5563",
  },
  actionButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "neodgm",
  },
  startButtonText: {
    fontWeight: "600",
  },
});
