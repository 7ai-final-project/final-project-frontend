// frontend/util/ttrpg.ts

// ── 한·영 혼용 스탯 라벨 매핑 ─────────────────────────────────────────────
const KOR_STATS = ["힘", "민첩", "지식", "의지", "매력", "운", "체력"] as const;

const EN_TO_KO: Record<string, string> = {
  strength: "힘",
  str: "힘",
  agility: "민첩",
  dex: "민첩",
  intelligence: "지식",
  int: "지식",
  wisdom: "의지",
  wis: "의지",
  charisma: "매력",
  cha: "매력",
  luck: "운",
  lck: "운",
  hp: "체력",
  health: "체력",
};

// 표시용 라벨: 가능한 모든 키(한·영)를 한국어 라벨로 매핑
export const statLabelMap: Record<string, string> = {
  // 한글 원본
  힘: "힘",
  민첩: "민첩",
  지식: "지식",
  의지: "의지",
  매력: "매력",
  운: "운",
  체력: "체력",
  // 영어/약어
  strength: "힘",
  str: "힘",
  agility: "민첩",
  dex: "민첩",
  intelligence: "지식",
  int: "지식",
  wisdom: "의지",
  wis: "의지",
  charisma: "매력",
  cha: "매력",
  luck: "운",
  lck: "운",
  hp: "체력",
  health: "체력",
};

// 선택지 타입
export type Grade = "SP" | "S" | "F" | "SF";

export type Choice = {
  id: string;
  text: string;
  appliedStat: string;         // 한글 또는 영문 가능
  modifier: number;
  tags?: string[];             // 스킬/아이템 태그 매칭용(옵션)
};

export interface SceneRoundSpec {
  title: string;
  description: string;
  choices: {
    [roleId: string]: Choice[];
  };
}

export type SceneTemplate = {
  id: string;
  index: number;
  roleMap: Record<string /* character name */, string /* roleKey */>;
  round?: SceneRoundSpec;
  turns?: any[];
  nextScene?: Record<string, any>;
};

export type PerRoleResult = {
<<<<<<< HEAD
  role: string;
  choiceId: string;
  grade: Grade;
  dice: number;
  appliedStat: string;
  statValue: number;
  modifier: number;
  total: number;
  characterName: string;
=======
    role: string;
    choiceId: string;
    grade: Grade;
    dice: number;
    appliedStat: string;
    statValue: number;
    modifier: number;
    total: number;
    characterName: string;
    characterId: string;
>>>>>>> origin/develop
};

export type RoundResult = {
  sceneIndex: number;
  results: PerRoleResult[];
};

// API Character 타입 가져오기
import type { Character } from "@/services/api";

// ── 유틸 함수들 ────────────────────────────────────────────────────────────
/** 입력 statKey(한·영 아무거나)를 한국어 기준 키로 정규화 */
export const normalizeToKo = (statKey: string): string => {
  if (!statKey) return statKey;
  if (KOR_STATS.includes(statKey as any)) return statKey; // 이미 한글
  const lower = statKey.toLowerCase();
  return EN_TO_KO[lower] ?? statKey; // 미지정 키면 그대로 반환
};

/** 화면 표시용 라벨을 반환 */
export const getStatLabel = (statKey: string): string => {
  return statLabelMap[statKey] ?? statKey;
};

/** 캐릭터 stats에서 statKey(한·영)를 찾아 값 반환(없으면 0) */
export const getStatValue = (character: Character, statKey: string): number => {
  const stats = (character as any)?.stats ?? {};
  if (!stats || typeof stats !== "object") return 0;

  // 그대로 존재하면 우선 사용
  if (statKey in stats && typeof stats[statKey] === "number") {
    return stats[statKey];
  }

  // 한국어 정규화 후 다시 시도
  const ko = normalizeToKo(statKey);
  if (ko in stats && typeof stats[ko] === "number") {
    return stats[ko];
  }

  // 영어 키가 stats에 직접 있을 수 있으므로 보조 체크
  const lower = statKey.toLowerCase();
  if (lower in stats && typeof stats[lower] === "number") {
    return stats[lower];
  }

  return 0;
};

export type ShariRoll = {
  player_id?: string;
  reason?: string;
  d6?: number;
  outcome?: "favorable" | "unfavorable";
};

export type ShariUpdate = {
  characterHurt?: Record<string, boolean | number | string>;
  currentLocation?: string | null;
  previousLocation?: string | null;
  notes?: string;
  inventory?: {
    consumed?: Record<string, (string | { name: string; charges?: number })[]>;
    added?: Record<string, (string | { name: string; charges?: number })[]>;
    charges?: Record<string, Record<string, number>>; // { pid: { itemName: delta } }
  };
  skills?: {
    cooldown?: Record<string, Record<string, number>>;
  };
};

export type ShariBlock = {
  assess?: any[];
  rolls?: ShariRoll[];
  update?: ShariUpdate;
};

export type World = { time?: string; location?: string; notes?: string };

export type PartyEntry = {
  id: string;
  name?: string;
  role?: string;
  sheet?: {
    hp?: number;
    status?: string[];
    stats?: Record<string, number>;
    skills?: string[];
    items?: Array<string | { name: string; charges?: number }>;
    spells?: Array<string | { name: string; charges?: number }>;
  };
};
