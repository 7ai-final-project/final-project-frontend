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

// ---- Rooms API helpers ----
export const fetchRooms = () => api.get("game/");
export const fetchRoomDetail = (id: string) => api.get(`game/${id}/`);
export const joinRoom = (id: string) => api.post(`game/${id}/join/`);
export const leaveRoom = (roomId: string) => api.post(`game/${roomId}/leave/`);
export const toggleReady = (id: string) => api.post(`game/${id}/toggle-ready/`);
export const startGame = (id: string) => api.post(`game/${id}/start/`);
export const endGame = (id: string) => api.post(`game/${id}/end/`);
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

export default api;