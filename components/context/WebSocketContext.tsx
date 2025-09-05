// frontend\components\context\WebSocketContext.tsx
import React, { createContext, useContext, useRef } from "react";

type WebSocketContextType = {
  wsRef: React.MutableRefObject<WebSocket | null>;
};

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const wsRef = useRef<WebSocket | null>(null);

  return (
    <WebSocketContext.Provider value={{ wsRef }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error("useWebSocket must be used within WebSocketProvider");
  return ctx;
};