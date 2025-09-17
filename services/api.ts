import axios from "axios";
import { storage } from "../services/storage";  // ✅ AsyncStorage 유틸 가져오기

const api = axios.create({
  baseURL: "http://127.0.0.1:8000/",
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

export default api;