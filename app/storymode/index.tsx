import React, { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Image, useWindowDimensions, LayoutAnimation, UIManager, Platform, ScrollView } from "react-native";
import { router } from "expo-router";
import api from "../../services/api";
import OptionsModal from "../../components/OptionsModal";
import { useFonts } from 'expo-font';

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
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

const defaultStoryImage = require("../../assets/images/game/multi_mode/background/sun_and_moon.jpg");

export default function StorySelectorScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [fontsLoaded, fontError] = useFonts({'neodgm': require('../../assets/fonts/neodgm.ttf'),});
  
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

  const [optionsModalVisible, setOptionsModalVisible] = useState(false);

  const [isBgmOn, setIsBgmOn] = useState(true);
  const [isSfxOn, setIsSfxOn] = useState(true);
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState(1);
  const [backgroundColor, setBackgroundColor] = useState("#1a202c");

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  // 이야기 목록 조회
  useEffect(() => {
    const fetchStories = async () => {
      try {
        const response = await api.get("storymode/story/stories/");
        const data = response.data;
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
    const imageSource = story.image_path ? { uri: story.image_path } : defaultStoryImage;

    return (
      <TouchableOpacity
        key={story.id}
        style={[
          isMobile ? styles.cardWrapperMobile : styles.cardWrapperWeb,
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
              resizeMode="cover"
            />
          )}
          {!imageSource && (
            <View style={styles.placeholderImage}>
              <Text style={{ color: "white", fontFamily: 'neodgm' }}>No Image</Text>
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

  if(!fontsLoaded && !fontError) {
    return null;
  }

  // 로딩 뷰
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F4E4BC" />
        <Text style={styles.loadingText}>이야기를 불러오는 중...</Text>
      </View>
    );
  }

  // 스토리 선택 뷰
  return (
    <View style={styles.container}>
      <View style={isMobile ? styles.headerMobile : styles.header}>
        <TouchableOpacity
          style={isMobile ? styles.headerButtonMobile : styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={isMobile ? 24 : 28} color="#F4E4BC" />
          {/* <ArrowLeft size={isMobile ? 20 : 24} color="#F4E4BC" /> */}
          {/* <Text style={isMobile ? styles.headerButtonTextMobile : styles.headerButtonText}>Back</Text> */}
        </TouchableOpacity>

        <Text style={isMobile ? styles.headerTitleMobile : styles.headerTitle}>스토리 리스트</Text>
        <View style={isMobile ? styles.headerIconsMobile : styles.headerIcons}>
          <TouchableOpacity onPress={() => setOptionsModalVisible(true)}>
            <Settings size={isMobile ? 24 : 28} color="#F4E4BC" />
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

      {isMobile ? (
        <FlatList
          data={stories}
          renderItem={({ item }) => renderStoryCard(item)}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainerMobile}
          ItemSeparatorComponent={() => <View style={{ height: 15 }} />}
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContainerWeb}
        >
          {stories.map((story) => renderStoryCard(story))}
        </ScrollView>
      )}

      <View style={isMobile ? styles.bottomActionsMobile : styles.bottomActions}>
        {selectedStoryId &&
          (() => {
            const selectedStory = stories.find((s) => s.id === selectedStoryId);

            if (selectedStory?.has_saved_session) {
              return (
                <View style={isMobile ? styles.buttonGroupMobile : styles.buttonGroup}>
                  <TouchableOpacity
                    style={[isMobile ? styles.actionButtonMobile : styles.actionButton, styles.continueButton]}
                    onPress={() => handleStorySelect(true)}
                  >
                    <Text style={isMobile ? styles.actionButtonTextMobile : styles.actionButtonText}>이어서 하기</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[isMobile ? styles.actionButtonMobile : styles.actionButton, styles.restartButton]}
                    onPress={() => handleStorySelect(false)}
                  >
                    <Text style={isMobile ? styles.actionButtonTextMobile : styles.actionButtonText}>처음부터 시작</Text>
                  </TouchableOpacity>
                </View>
              );
            } else {
              return (
                <TouchableOpacity
                  style={[isMobile ? styles.actionButtonMobile : styles.actionButton, styles.startButton]}
                  onPress={() => handleStorySelect(false)}
                >
                  <Text
                    style={[isMobile ? styles.actionButtonTextMobile : styles.actionButtonText, styles.startButtonText]}
                  >
                    시작하기
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
  container: { flex: 1, backgroundColor: "#0B1021" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0B1021",
  },
  loadingText: {
    color: "#F4E1D2",
    marginTop: 10,
    fontFamily: "neodgm",
    fontSize: 18,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 40,
    backgroundColor: 'transparent',
  },
  headerMobile: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingTop: 30,
    backgroundColor: 'transparent',
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
  },
  headerButtonMobile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    padding: 6,
  },
  headerButtonText: {
    color: "#F4E4BC",
    fontSize: 18,
    fontFamily: "neodgm",
  },
  headerButtonTextMobile: {
    color: "#F4E4BC",
    fontSize: 15,
    fontFamily: "neodgm",
  },
  headerTitle: {
    color: "#F4E4BC",
    fontSize: 24,
    fontFamily: "neodgm",
    fontWeight: "bold",
  },
  headerTitleMobile: {
    color: "#F4E4BC",
    fontSize: 20,
    fontFamily: "neodgm",
    fontWeight: "bold",
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 8,
  },
  headerIconsMobile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 6,
  },
  listContainerWeb: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  cardWrapperWeb: {
    width: 380,
    marginHorizontal: 15,
    borderRadius: 12,
    backgroundColor: "#2a2d47",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 7,
    elevation: 10,
    overflow: "hidden",
  },
  listContainerMobile: {
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  cardWrapperMobile: {
    width: "100%",
    borderRadius: 12,
    backgroundColor: "#2a2d47",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    overflow: "hidden",
  },
  selectedCardWrapper: {
    borderColor: "#F4E4BC",
    borderWidth: 3,
  },
  cardBackground: {
    height: 220,
    backgroundColor: "#1c2033",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#4a5568",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  cardTitleContainer: {
    position: "absolute",
    bottom: 15,
    left: 15,
    right: 15,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  cardTitle: {
    color: "#F4E1D2",
    fontSize: 20,
    fontFamily: "neodgm",
    fontWeight: "bold",
    textAlign: "center",
  },
  cardContent: {
    padding: 18,
    backgroundColor: "#1c2033",
  },
  cardWorld: {
    color: "#D1C4E9",
    fontSize: 16,
    fontFamily: "neodgm",
    fontStyle: "italic",
    marginBottom: 10,
  },
  cardDesc: {
    color: "#F4E1D2",
    fontSize: 14,
    fontFamily: "neodgm",
    lineHeight: 22,
  },
  bottomActions: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderTopWidth: 1,
    borderTopColor: "#1c2033",
    backgroundColor: '#0B1021',
  },
  bottomActionsMobile: {
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderTopColor: "#1c2033",
    backgroundColor: '#0B1021',
  },
  actionButton: {
    alignItems: "center",
    width: 250,
    paddingVertical: 18,
    borderRadius: 10,
  },
  actionButtonMobile: {
    alignItems: "center",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 8,
  },
  startButton: {
    backgroundColor: "#7C3AED",
  },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    width: '100%',
  },
  buttonGroupMobile: {
    flexDirection: "column",
    gap: 12,
    width: '100%',
  },
  continueButton: {
    backgroundColor: "#3B82F6",
    flex: 1,
  },
  restartButton: {
    backgroundColor: "#6B7280",
    flex: 1,
  },
  actionButtonText: {
    color: "white",
    fontSize: 18,
    fontFamily: "neodgm",
    fontWeight: "600",
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  actionButtonTextMobile: {
    color: "white",
    fontSize: 16,
    fontFamily: "neodgm",
    fontWeight: "600",
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  startButtonText: {
  },
});