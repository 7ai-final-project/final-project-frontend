// final-project-frontend/components/game/ShariHud.tsx
import React from "react";
import type { ShariBlock, ShariUpdate, World, PartyEntry } from "@/types/shari";

type Props = {
  world?: World;
  party?: PartyEntry[];
  shari?: ShariBlock;
  visible?: boolean;
  onClose?: () => void;
};

function asName(it: any) {
  if (typeof it === "string") return it;
  if (it && typeof it === "object" && "name" in it) return String(it.name);
  return JSON.stringify(it);
}

function flattenUpdate(u?: ShariUpdate): string[] {
  if (!u) return [];
  const msgs: string[] = [];

  const inv = u.inventory || {};
  const add = (pfx: string, obj?: Record<string, any[]>) => {
    if (!obj) return;
    Object.entries(obj).forEach(([pid, arr]) => {
      (arr || []).forEach((it) => msgs.push(`${pfx} ${pid}: ${asName(it)}`));
    });
  };
  add("소모", inv.consumed);
  add("획득", inv.added);

  const ch = inv.charges || {};
  Object.entries(ch).forEach(([pid, deltaMap]) => {
    Object.entries(deltaMap).forEach(([item, d]) => {
      msgs.push(`충전 ${pid}: ${item} (${d >= 0 ? "+" : ""}${d})`);
    });
  });

  const cd = u.skills?.cooldown || {};
  Object.entries(cd).forEach(([pid, m]) => {
    Object.entries(m || {}).forEach(([skill, turns]) => {
      msgs.push(`쿨다운 ${pid}: ${skill} → ${turns}턴`);
    });
  });

  const hurt = u.characterHurt || {};
  Object.entries(hurt).forEach(([pid, flag]) => {
    msgs.push(`부상 ${pid}: ${String(flag)}`);
  });

  if (u.currentLocation && u.previousLocation && u.currentLocation !== u.previousLocation) {
    msgs.push(`이동: ${u.previousLocation} → ${u.currentLocation}`);
  }
  if (u.notes) msgs.push(`메모: ${u.notes}`);

  return msgs;
}

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
