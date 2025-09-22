import axios from "axios";
import { storage } from "../services/storage";  // ✅ AsyncStorage 유틸 가져오기
import { PerRoleResult, SceneTemplate } from "@/util/ttrpg";

const api = axios.create({
  baseURL: "http://20.196.72.38/",
});

// 요청 인터셉터 (토큰 붙이기)
api.interceptors.request.use(
  async (config) => {
    const token = await storage.getItem("access_token");  // ✅ localStorage → storage
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export interface Skill {
  name: string;
  description: string;
}

export interface Item {
  name: string;
  description: string;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  image: any;
  stats: Record<string, number>;
  skills: Skill[];
  items: Item[];
}

export interface PaginatedCharacterResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Character[];
}

export const fetchUserStoryProgress = () => {
  return api.get('/storymode/story/progress/user/');
};

// ---- Rooms API helpers ----
export const fetchRooms = () => api.get("game/");
export const fetchRoomDetail = (id: string) => api.get(`game/${id}/`);
export const joinRoom = (id: string, data?: { password?: string }) => api.post(`game/${id}/join/`, data);
export const leaveRoom = (id: string) => api.post(`game/${id}/leave/`);
export const toggleReady = (id: string) => api.post(`game/${id}/toggle-ready/`);
export const startGame = (id: string) => api.post(`game/${id}/start/`);
export const endGame = (id: string) => api.post(`game/${id}/end/`);
export const fetchMySession = (roomId: string) => api.get(`game/${roomId}/my-session/`);
export const getWebSocketNonce = () => api.post("common/websocket-nonce/");
export const fetchScenarios = () => api.get("game/options/scenarios/");
export const fetchDifficulties = () => api.get("game/options/difficulties/");
export const fetchModes = () => api.get("game/options/modes/");
export const fetchGenres = () => api.get("game/options/genres/");

export const saveRoomOptions = (
  roomId: string,
  options: {
    scenario: string | null;
    difficulty: string | null;
    mode: string | null;
    genre: string | null;
  }
) => {
  return api.post(`game/${roomId}/options/`, options);
};

export const fetchCharactersByTopic = async (topic: string): Promise<Character[]> => {
  let allCharacters: Character[] = [];
  let url: string | null = `game/characters/?topic=${encodeURIComponent(topic)}`;

  while (url) {
    const response = await api.get(url);
    const data: PaginatedCharacterResponse = response.data;

    if (data.results) {
      allCharacters = [...allCharacters, ...data.results];
    }
    url = data.next;
  }

  return allCharacters;
};

// ------------------------------------------------------------------
// ✅ [추가] Single Player Game API
// ------------------------------------------------------------------

/**
 * 싱글플레이어 게임의 첫 장면(Scene) 데이터를 요청합니다.
 * @param data - 게임 시작에 필요한 정보 (주제, 캐릭터 목록, 불러오기 여부)
 */
export const getInitialScene = (data: {
    topic: string;
    myCharacter: Character; // ✅ 이 줄을 추가하세요
    allCharacters: Character[];
    isLoadedGame: boolean;
}) => {
    // allCharacters 대신 characters 키로 백엔드에 전달 (기존 방식 유지)
    return api.post("/game/single/initial/", { ...data, characters: data.allCharacters });
};


/**
 * 플레이어의 선택 결과를 서버에 보내고, AI 행동이 반영된 다음 스토리와 씬을 받아옵니다.
 * @param data - 플레이어의 주사위 결과, AI 동료 정보, 현재 씬 정보 등
 */
export const submitChoiceAndGetNextScene = (data: {
  playerResult: PerRoleResult;
  aiCharacters: Character[];
  currentScene: SceneTemplate | null;
  usage: { type: 'skill' | 'item'; data: Skill | Item } | null;
  gameState: any;
}) => api.post("game/single/proceed/", data);


/**
 * 싱글플레이어 게임의 현재 상태를 서버에 저장합니다.
 * @param saveData - 저장할 게임 데이터
 */
export const saveGame = (data: { 
    gameState: any;
    characterHistory: any;
    characterId: string;
    difficulty: string;
    genre: string;
    mode: string;
}) => {
    return api.post("/game/single/save/", data);
};

export const resolveTurn = (data: {
    playerResult: any;
    aiCharacters: Character[];
    currentScene: any;
    usage: any;
    gameState: any;
    allCharacters: Character[];
}) => {
    return api.post("/game/single/proceed/", data);
};

// ✅ [추가] 다음 씬을 요청하는 새로운 함수
export const getNextScene = (data: {
    gameState: any;
    lastNarration: string;
    currentSceneIndex: number;
}) => {
    return api.post("/game/single/next-scene/", data);
};

export const checkSingleGameSession = (scenarioId: string) => {
    return api.get(`/game/single/session-check/?scenario_id=${scenarioId}`);
};

export const continueGame = (sessionId: string) => {
    return api.post("/game/single/continue/", { session_id: sessionId });
};

export default api;