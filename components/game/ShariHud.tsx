<<<<<<< HEAD
// final-project-frontend/components/game/ShariHud.tsx
import React from "react";
import type { ShariBlock, ShariUpdate, World, PartyEntry } from "@/types/shari";
=======
// frontend/components/game/ShariHud.tsx
import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import type { ShariBlock, ShariUpdate, World, PartyEntry } from "@/util/ttrpg";
import type { Character } from "@/services/api";
>>>>>>> origin/develop

type Props = {
  world?: World;
  party?: PartyEntry[];
  shari?: ShariBlock;
<<<<<<< HEAD
  visible?: boolean;
  onClose?: () => void;
};

=======
  allCharacters: Character[]; 
  visible?: boolean; // visible prop은 이제 모달 외부에서 제어되므로 직접 사용 X
  onClose?: () => void; // 모달 닫기 함수
};

// Helper function to get a display name for an item
>>>>>>> origin/develop
function asName(it: any) {
  if (typeof it === "string") return it;
  if (it && typeof it === "object" && "name" in it) return String(it.name);
  return JSON.stringify(it);
}

<<<<<<< HEAD
function flattenUpdate(u?: ShariUpdate): string[] {
  if (!u) return [];
  const msgs: string[] = [];
=======
// Helper function to flatten the update data into human-readable strings
function flattenUpdate(u?: ShariUpdate, nameMap?: Map<string, string>): string[] {
  if (!u) return [];
  const msgs: string[] = [];
  const getName = (pid: string) => nameMap?.get(pid) || pid;
>>>>>>> origin/develop

  const inv = u.inventory || {};
  const add = (pfx: string, obj?: Record<string, any[]>) => {
    if (!obj) return;
    Object.entries(obj).forEach(([pid, arr]) => {
<<<<<<< HEAD
      (arr || []).forEach((it) => msgs.push(`${pfx} ${pid}: ${asName(it)}`));
=======
      (arr || []).forEach((it) => msgs.push(`${pfx} ${getName(pid)}: ${asName(it)}`));
>>>>>>> origin/develop
    });
  };
  add("소모", inv.consumed);
  add("획득", inv.added);

  const ch = inv.charges || {};
  Object.entries(ch).forEach(([pid, deltaMap]) => {
    Object.entries(deltaMap).forEach(([item, d]) => {
<<<<<<< HEAD
      msgs.push(`충전 ${pid}: ${item} (${d >= 0 ? "+" : ""}${d})`);
=======
      msgs.push(`충전 ${getName(pid)}: ${item} (${d >= 0 ? "+" : ""}${d})`);
>>>>>>> origin/develop
    });
  });

  const cd = u.skills?.cooldown || {};
  Object.entries(cd).forEach(([pid, m]) => {
    Object.entries(m || {}).forEach(([skill, turns]) => {
<<<<<<< HEAD
      msgs.push(`쿨다운 ${pid}: ${skill} → ${turns}턴`);
=======
      msgs.push(`쿨다운 ${getName(pid)}: ${skill} → ${turns}턴`);
>>>>>>> origin/develop
    });
  });

  const hurt = u.characterHurt || {};
  Object.entries(hurt).forEach(([pid, flag]) => {
<<<<<<< HEAD
    msgs.push(`부상 ${pid}: ${String(flag)}`);
=======
    msgs.push(`부상 ${getName(pid)}: ${String(flag)}`);
>>>>>>> origin/develop
  });

  if (u.currentLocation && u.previousLocation && u.currentLocation !== u.previousLocation) {
    msgs.push(`이동: ${u.previousLocation} → ${u.currentLocation}`);
  }
  if (u.notes) msgs.push(`메모: ${u.notes}`);

  return msgs;
}

<<<<<<< HEAD
export default function ShariHud({ world, party, shari, visible = true, onClose }: Props) {
  const msgs = flattenUpdate(shari?.update);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* World Header */}
      {(world?.location || world?.time || world?.notes) && (
        <div style={{
          padding: 12,
          borderRadius: 10,
          background: "rgba(226,192,68,0.1)",
          border: "1px solid #E2C044",
          marginBottom: 12
        }}>
          {world?.location && <div style={{ fontSize: 18, fontWeight: 700, color: "#E2C044" }}>{world.location}</div>}
          {world?.time && <div style={{ fontSize: 12, color: "#E2C044AA" }}>{world.time}</div>}
          {world?.notes && <div style={{ marginTop: 6, fontSize: 12, color: "#ddd" }}>{world.notes}</div>}
        </div>
      )}

      {/* Party quick badges (status) */}
      {party && party.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {party.map((p) => (
            <div key={p.id} style={{ padding: "6px 10px", background: "#222", borderRadius: 999, border: "1px solid #333" }}>
              <span style={{ color: "#eee", fontWeight: 600 }}>{p.name || p.id}</span>
              {p.sheet?.status?.length ? (
                <span style={{ marginLeft: 8, color: "#E2C044" }}>
                  [{p.sheet.status.join(", ")}]
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Delta Toast */}
      {visible && msgs.length > 0 && (
        <div style={{
          position: "fixed", left: 16, right: 16, bottom: 24,
          background: "rgba(0,0,0,0.85)", border: "1px solid #4CAF50",
          padding: 12, borderRadius: 10, maxWidth: 560, margin: "0 auto", zIndex: 1000
        }}>
          <div style={{ color: "#4CAF50", fontWeight: 700, marginBottom: 6 }}>상태 변화</div>
          <div style={{ maxHeight: 160, overflow: "auto" }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ color: "#fff", fontSize: 12, marginBottom: 2 }}>• {m}</div>
            ))}
          </div>
          {onClose && (
            <button onClick={onClose} style={{
              marginTop: 8, padding: "6px 10px", borderRadius: 8, border: "1px solid #444",
              background: "#111", color: "#ddd", cursor: "pointer"
            }}>닫기</button>
          )}
        </div>
      )}
    </div>
  );
}
=======
export default function ShariHud({ world, party, shari, allCharacters, onClose }: Props) {
  const characterIdToNameMap = useMemo(() => 
      new Map(allCharacters.map(char => [char.id, char.name])),
      [allCharacters]
  );
  
  const msgs = flattenUpdate(shari?.update, characterIdToNameMap);

  return (
    <View style={styles.hudModalContent}>
        <Text style={styles.hudModalTitle}>현재 상황 정보</Text>

        <ScrollView style={styles.hudModalScrollView} showsVerticalScrollIndicator={false}>
            {/* World Header */}
            {(world?.location || world?.time || world?.notes) && (
                <View style={styles.hudSection}>
                    <Text style={styles.hudSectionTitle}>월드</Text>
                    {world?.location && <Text style={styles.hudText}><Text style={styles.hudLabel}>장소:</Text> {world.location}</Text>}
                    {world?.time && <Text style={styles.hudText}><Text style={styles.hudLabel}>시간:</Text> {world.time}</Text>}
                    {world?.notes && <Text style={styles.hudText}><Text style={styles.hudLabel}>메모:</Text> {world.notes}</Text>}
                </View>
            )}

            {/* Party quick badges (status) */}
            {party && party.length > 0 && (
                <View style={styles.hudSection}>
                    <Text style={styles.hudSectionTitle}>파티 상태</Text>
                    <View style={styles.partyBadgeContainer}>
                        {party.map((p) => {
                            const statusText = p.sheet?.status?.length ? p.sheet.status.join(", ") : "정상";
                            const statusColor = p.sheet?.status?.length ? "#E2C044" : "#4CAF50";
                            return (
                                <View key={p.id} style={styles.partyBadge}>
                                    <Text style={styles.partyBadgeName}>{p.name || p.id}</Text>
                                    <View style={styles.divider} />
                                    <Text style={styles.partyBadgeText}><Text style={{ fontWeight: 'bold' }}>HP:</Text> {typeof p.sheet?.hp === 'number' ? p.sheet.hp : 'N/A'}</Text>
                                    <View style={styles.partyBadgeTextContainer}>
                                        <Text style={[styles.partyBadgeText, {fontWeight: 'bold'}]}>상태:</Text>
                                        <Text style={[styles.partyBadgeText, { color: statusColor, marginLeft: 4 }]}>{statusText}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* Delta Toast (상태 변화) */}
            {msgs.length > 0 && (
                <View style={styles.hudSection}>
                    <Text style={styles.hudSectionTitle}>최근 변화</Text>
                    {msgs.map((m, i) => (
                        <Text key={i} style={styles.hudChangeText}>• {m}</Text>
                    ))}
                </View>
            )}
        </ScrollView>

        {/* 닫기 버튼 */}
        {onClose && (
            <TouchableOpacity style={styles.hudModalCloseButton} onPress={onClose}>
                <Text style={styles.modalButtonText}>닫기</Text>
            </TouchableOpacity>
        )}
    </View>
  );
}

// 모달 UI에 맞는 스타일시트
const styles = StyleSheet.create({
    hudModalContent: {
        width: '50%',
        maxWidth: 600,
        maxHeight: '80%',
        backgroundColor: '#161B2E',
        borderRadius: 20,
        padding: 25,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#444',
    },
    hudModalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#E0E0E0',
        marginBottom: 20,
    },
    hudModalScrollView: {
        width: '100%',
    },
    hudSection: {
        width: '100%',
        backgroundColor: '#0B1021',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
    },
    hudSectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#E2C044',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#444',
        paddingBottom: 5,
    },
    hudText: {
        color: '#D4D4D4',
        fontSize: 14,
        lineHeight: 22,
    },
    hudLabel: {
        fontWeight: 'bold',
        color: '#A0A0A0',
    },
    partyBadgeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    partyBadge: {
        backgroundColor: '#222736',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#333',
        padding: 12,
        flexGrow: 1,
        minWidth: 120,
    },
    partyBadgeName: {
        color: '#eee',
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: 15,
    },
    divider: {
        height: 1,
        backgroundColor: '#444',
        marginVertical: 6,
    },
    partyBadgeTextContainer: {
        flexDirection: 'row',
    },
    partyBadgeText: {
        color: '#A0A0A0',
        fontSize: 13,
    },
    hudChangeText: {
        color: '#fff',
        fontSize: 13,
        marginBottom: 4,
        lineHeight: 18,
    },
    hudModalCloseButton: {
        marginTop: 20,
        backgroundColor: '#7C3AED',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 10,
    },
    modalButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
>>>>>>> origin/develop
