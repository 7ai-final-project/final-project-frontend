// frontend/components/game/ShariHud.tsx
import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import type { ShariBlock, ShariUpdate, World, PartyEntry } from "@/util/ttrpg";
import type { Character } from "@/services/api";

type Props = {
  world?: World;
  party?: PartyEntry[];
  shari?: ShariBlock;
  allCharacters: Character[];
  visible?: boolean;
  onClose?: () => void;
};

// Helper: display name
function asName(it: any) {
  if (typeof it === "string") return it;
  if (it && typeof it === "object" && "name" in it) return String((it as any).name);
  return JSON.stringify(it);
}

// Helper: flatten update messages
function flattenUpdate(u?: ShariUpdate, nameMap?: Map<string, string>): string[] {
  if (!u) return [];
  const msgs: string[] = [];
  const getName = (pid: string) => nameMap?.get(pid) || pid;

  const inv = u.inventory || {};
  const add = (pfx: string, obj?: Record<string, any[]>) => {
    if (!obj) return;
    Object.entries(obj).forEach(([pid, arr]) => {
      (arr || []).forEach((it) => msgs.push(`${pfx} ${getName(pid)}: ${asName(it)}`));
    });
  };
  add("소모", inv.consumed);
  add("획득", inv.added);

  const ch = inv.charges || {};
  Object.entries(ch).forEach(([pid, deltaMap]) => {
    Object.entries(deltaMap).forEach(([item, d]) => {
      msgs.push(`충전 ${getName(pid)}: ${item} (${d >= 0 ? "+" : ""}${d})`);
    });
  });

  const cd = u.skills?.cooldown || {};
  Object.entries(cd).forEach(([pid, m]) => {
    Object.entries(m || {}).forEach(([skill, turns]) => {
      msgs.push(`쿨다운 ${getName(pid)}: ${skill} → ${turns}턴`);
    });
  });

  // ✅ 부상 요약 표기: characterHurt가 포함된 턴에서만 한 줄로 출력
  const hurt = u.characterHurt || {};
  const entries = Object.entries(hurt);
  // "true"/"false", 1/0, true/false 모두 처리
  const toBool = (v: any) =>
    v === true ||
    v === 1 ||
    v === "1" ||
    (typeof v === "string" && v.toLowerCase() === "true");

  if (entries.length > 0) {
    const injured = entries
      .filter(([, flag]) => toBool(flag))
      .map(([pid]) => getName(pid));

    msgs.push(injured.length > 0 ? `부상: ${injured.join(", ")}` : "부상: 없음");
  }

  if (u.currentLocation && u.previousLocation && u.currentLocation !== u.previousLocation) {
    msgs.push(`이동: ${u.previousLocation} → ${u.currentLocation}`);
  }
  if (u.notes) msgs.push(`메모: ${u.notes}`);

  return msgs;
}

/** ===================== A안: 프론트만으로 HP 표시 보완 =====================
 * 우선순위
 *  1) party.sheet.* 에 숫자형 HP가 있으면 그대로 사용 (hp | currentHp | health.hp)
 *  2) allCharacters 목록에서 동일 id의 HP 유사 필드 추론 (hp | currentHp | stats.hp)
 *  3) 관찰된 '부상' 신호로 간이 HP 표시 (최대 2HP 가정: 부상 → 1/2, 아니면 2/2)
 *  4) 그래도 불명확하면 '—' 로 표기 (N/A 제거)
 * 표시 형식
 *  - 확정 숫자이면 정수("7")로 표시
 *  - 추론/간이 규칙이면 "x/2" 형식으로 표시
 */
const MAX_SIMPLIFIED_HP = 2;

function firstNumber(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

function resolveNumericHpFromSheet(p: PartyEntry): number | undefined {
  const s: any = p?.sheet || {};
  return firstNumber(s.hp, s.currentHp, s?.health?.hp);
}

function resolveNumericHpFromCharacter(char?: Character): number | undefined {
  const c: any = char || {};
  return firstNumber(c.hp, c.currentHp, c?.stats?.hp);
}

function isInjuredFromStatus(p: PartyEntry): boolean {
  const status = p?.sheet?.status || [];
  return status.some((t) => typeof t === "string" && /부상|injur|wound/i.test(t));
}

function hpLabelForPartyMember(
  p: PartyEntry,
  charMap: Map<string, Character>,
  shari?: ShariBlock
): string {
  const hpFromSheet = resolveNumericHpFromSheet(p);
  if (hpFromSheet !== undefined) return String(hpFromSheet);

  const char = charMap.get(p.id);
  const hpFromChar = resolveNumericHpFromCharacter(char);
  if (hpFromChar !== undefined) return String(hpFromChar);

  const recentHurt = Boolean((shari as any)?.update?.characterHurt?.[p.id]);
  const knownInjured = isInjuredFromStatus(p) || recentHurt;
  const hpByHeuristic = `${knownInjured ? 1 : 2}/${MAX_SIMPLIFIED_HP}`;
  return hpByHeuristic;
}

export default function ShariHud({ world, party, shari, allCharacters, onClose }: Props) {
  const characterIdToNameMap = useMemo(
    () => new Map(allCharacters.map((char) => [char.id, char.name])),
    [allCharacters]
  );

  const characterMap = useMemo(
    () => new Map(allCharacters.map((c) => [c.id, c])),
    [allCharacters]
  );

  const msgs = flattenUpdate(shari?.update, characterIdToNameMap);

  return (
    <View style={styles.hudModalContent}>
      <Text style={styles.hudModalTitle}>현재 상황 정보</Text>

      <ScrollView style={styles.hudModalScrollView} showsVerticalScrollIndicator={false}>
        {(world?.location || world?.time || world?.notes) && (
          <View style={styles.hudSection}>
            <Text style={styles.hudSectionTitle}>월드</Text>
            {world?.location && (
              <Text style={styles.hudText}>
                <Text style={styles.hudLabel}>장소:</Text> {world.location}
              </Text>
            )}
            {world?.time && (
              <Text style={styles.hudText}>
                <Text style={styles.hudLabel}>시간:</Text> {world.time}
              </Text>
            )}
            {world?.notes && (
              <Text style={styles.hudText}>
                <Text style={styles.hudLabel}>메모:</Text> {world.notes}
              </Text>
            )}
          </View>
        )}

        {party && party.length > 0 && (
          <View style={styles.hudSection}>
            <Text style={styles.hudSectionTitle}>파티 상태</Text>
            <View style={styles.partyBadgeContainer}>
              {party.map((p) => {
                const statusText = p.sheet?.status?.length ? p.sheet.status.join(", ") : "정상";
                const statusColor = p.sheet?.status?.length ? "#E2C044" : "#4CAF50";
                const hpText = hpLabelForPartyMember(p, characterMap, shari);

                return (
                  <View key={p.id} style={styles.partyBadge}>
                    <Text style={styles.partyBadgeName}>{p.name || p.id}</Text>
                    <View style={styles.divider} />
                    <Text style={styles.partyBadgeText}>
                      <Text style={{ fontWeight: "bold" }}>HP:</Text> {hpText}
                    </Text>
                    <View style={styles.partyBadgeTextContainer}>
                      <Text style={[styles.partyBadgeText, { fontWeight: "bold" }]}>상태:</Text>
                      <Text style={[styles.partyBadgeText, { color: statusColor, marginLeft: 4 }]}>
                        {statusText}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {msgs.length > 0 && (
          <View style={styles.hudSection}>
            <Text style={styles.hudSectionTitle}>최근 변화</Text>
            {msgs.map((m, i) => (
              <Text key={i} style={styles.hudChangeText}>
                • {m}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>

      {onClose && (
        <TouchableOpacity style={styles.hudModalCloseButton} onPress={onClose}>
          <Text style={styles.modalButtonText}>닫기</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  hudModalContent: {
    width: "50%",
    maxWidth: 600,
    maxHeight: "80%",
    backgroundColor: "#161B2E",
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444",
  },
  hudModalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#E0E0E0",
    marginBottom: 20,
  },
  hudModalScrollView: {
    width: "100%",
  },
  hudSection: {
    width: "100%",
    backgroundColor: "#0B1021",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  hudSectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#E2C044",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
    paddingBottom: 5,
  },
  hudText: {
    color: "#D4D4D4",
    fontSize: 14,
    lineHeight: 22,
  },
  hudLabel: {
    fontWeight: "bold",
    color: "#A0A0A0",
  },
  partyBadgeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  partyBadge: {
    backgroundColor: "#222736",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
    padding: 12,
    flexGrow: 1,
    minWidth: 120,
  },
  partyBadgeName: {
    color: "#eee",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: "#444",
    marginVertical: 6,
  },
  partyBadgeTextContainer: {
    flexDirection: "row",
  },
  partyBadgeText: {
    color: "#A0A0A0",
    fontSize: 13,
  },
  hudChangeText: {
    color: "#fff",
    fontSize: 13,
    marginBottom: 4,
    lineHeight: 18,
  },
  hudModalCloseButton: {
    marginTop: 20,
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
