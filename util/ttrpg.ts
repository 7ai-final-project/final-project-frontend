// util/ttrpg.ts

// 주제별 능력치 매핑을 위한 객체
export const statMapping = {
    'strength': '힘',
    'intelligence': '지혜',
    'agility': '민첩',
    'hp': '체력',
    'wisdom': '지혜',
    'luck': '행운',
};

// 두 주제의 모든 능력치를 포함하는 통합된 타입
export type CombinedCharacterStats = {
    strength?: number;
    intelligence?: number;
    agility?: number;
    hp?: number;
    wisdom?: number;
    luck?: number;
    // 이 타입은 `characterData.ts`의 `stats` 객체와 일치해야 합니다.
    // 여기서는 `stats` 객체의 키를 영문으로 통일하여 사용합니다.
    // 하지만, 캐릭터 데이터 자체는 한글 키를 사용하므로 매핑이 필요합니다.
};

export type Grade = "SP" | "S" | "F" | "SF";

export type Choice = {
    id: string;
    text: string;
    // `appliedStat`은 이제 두 주제의 모든 능력치를 포괄합니다.
    appliedStat: keyof typeof statMapping; 
    modifier: number;
};

export type SceneTurnSpec = {
    role: string;
    title: string;
    description: string;
    choices: Choice[];
    fragments: Record<string, string>;
    statChanges: Record<string, any>;
};

export interface SceneRoundSpec {
  title: string;
  description: string; // ✅ 이 줄을 추가하거나 전체를 교체하세요.
  choices: {
    [roleId: string]: {
      id: string;
      text: string;
      appliedStat: string;
      modifier: number;
    }[];
  };
}

export type SceneTemplate = {
    id: string;
    index: number;
    roleMap: Record<string /* character name */, string /* roleKey */>;
    round?: SceneRoundSpec; 
    turns?: SceneTurnSpec[];
    nextScene?: { [key: string]: any };
};

export type PerRoleResult = {
    role: string;
    choiceId: string;
    grade: Grade;
    dice: number;
    appliedStat: string;
    statValue: number;
    modifier: number;
    total: number;
    characterName: string;
};

export type RoundResult = {
    sceneIndex: number;
    results: PerRoleResult[];
};

export function getSceneTemplate(templates: SceneTemplate[], index: number) {
    return templates.find((t) => t.index === index) ?? null;
}

// 캐릭터의 주제에 따라 올바른 능력치 값을 가져오는 함수
// `characterData.ts`의 캐릭터 유니온 타입을 사용해야 합니다.
import { Character } from '@/services/api'

export const getStatValue = (character: Character, stat: keyof Character['stats']): number => {
    return character.stats?.[stat] ?? 0;
};
