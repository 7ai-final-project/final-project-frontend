import { useState, useEffect } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import GameSetup from "@/components/game/GameSetup";
import GameEngineRealtime from "@/components/game/GameEngineRealtime";
import GameEngineTurnBased from "@/components/game/GameEngineTurnBased";
import { Character } from "@/data/characters";

export default function GameScreen() {
  const { id: roomId, topic, difficulty, mode } = useLocalSearchParams<{ id: string; topic: string; difficulty?: string; mode?: string; }>();

  const normalizedMode = Array.isArray(mode) ? mode[0] : mode;

  const [phase, setPhase] = useState<"setup" | "game">("setup");
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      {phase === "setup" && (
        <GameSetup
          roomId={roomId}
          topic={topic}
          difficulty={difficulty ?? "초급"}
          onStart={(character) => {
            setSelectedCharacter(character);
            setPhase("game");
          }}
        />
      )}

      {phase === "game" && selectedCharacter && (
        <>
          {normalizedMode === "턴제" ? (
            <GameEngineTurnBased
              roomId={roomId}
              topic={topic}
              difficulty={difficulty ?? "초급"}
              selectedCharacter={selectedCharacter}
              turnSeconds={20}
            />
          ) : (
            <GameEngineRealtime
              roomId={roomId}
              topic={topic}
              difficulty={difficulty ?? "초급"}
              selectedCharacter={selectedCharacter}
              turnSeconds={20}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1021" },
});