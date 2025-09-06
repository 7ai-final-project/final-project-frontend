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

export type SceneRoundSpec = {
    title: string;
    choices: Record<string /* roleKey */, Choice[]>;
    fragments: Record<string /* `${role}_${choiceId}_${grade}` */, string>;
    summaryByCombo?: Record<string /* "brother_A_S|..." */, string>;
    nextScene?: {
        routes?: Array<{
            when: Partial<Record<string, { choiceId?: string[]; grade?: Grade[] }>>;
            gotoIndex: number | string;
        }>;
        fallback?: number | string;
    };
};

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
    appliedStat: keyof typeof statMapping;
    statValue: number;
    modifier: number;
    total: number;
};

export type RoundResult = {
    sceneIndex: number;
    results: PerRoleResult[];
    logs: string[];
};

export function getSceneTemplate(templates: SceneTemplate[], index: number) {
    return templates.find((t) => t.index === index) ?? null;
}

// 캐릭터의 주제에 따라 올바른 능력치 값을 가져오는 함수
// `characterData.ts`의 캐릭터 유니온 타입을 사용해야 합니다.
import { Character, FantasyCharacter, SunMoonCharacter } from "@/data/characterData";

export function getStatValue(character: Character, appliedStat: keyof typeof statMapping): number | undefined {
    // 선택된 캐릭터의 주제에 따라 능력치 객체를 올바르게 접근합니다.
    if (character.topic === "해와달") {
        const stats = (character as SunMoonCharacter).stats;
        switch (appliedStat) {
            case 'hp':
                return character.hp;
            case 'wisdom':
                return stats.지혜;
            case 'luck':
                return stats.행운;
            default:
                return undefined;
        }
    } else if (character.topic === "판타지의 어느 세계") {
        const stats = (character as FantasyCharacter).stats;
        switch (appliedStat) {
            case 'strength':
                return stats.힘;
            case 'intelligence':
                return stats.지혜;
            case 'agility':
                return stats.민첩;
            case 'hp':
                return character.hp;
            default:
                return undefined;
        }
    }
    return undefined;
}

// summary 문구 생성 규칙
export function renderSceneFromRound(
    tpl: SceneTemplate | null,
    round: RoundResult
) {
    if (!tpl) return "결과를 불러올 수 없습니다.";

    const parts: string[] = [];
    const roleOrder = Object.values(tpl.roleMap).filter((v, i, a) => a.indexOf(v) === i);

    for (const role of roleOrder) {
        const pr = round.results.find((r) => r.role === role);
        if (!pr) continue;

        let frag = "";
        if (tpl.round) {
            const key = `${pr.role}_${pr.choiceId}_${pr.grade}` as const;
            frag = tpl.round.fragments[key] ?? "";
        }
        else if (tpl.turns) {
            const turnSpec = tpl.turns.find(t => t.role === pr.role);
            if (turnSpec) {
                const key = `${pr.choiceId}_${pr.grade}` as const;
                frag = turnSpec.fragments[key] ?? "";
            }
        }
        
        if (frag) parts.push(frag);
    }

    let summary = "";
    if (tpl.round?.summaryByCombo) {
        const comboKey = round.results
            .map((r) => `${r.role}_${r.choiceId}_${r.grade}`)
            .sort()
            .join("|");
        for (const [k, v] of Object.entries(tpl.round.summaryByCombo)) {
            if (compareComboKeys(comboKey, k)) {
                summary = v;
                break;
            }
        }
    }

    const text = [parts.join(" "), summary].filter(Boolean).join("\n\n");
    return text || "아무 일도 일어나지 않았다…";
}

function compareComboKeys(actualSorted: string, templateRaw: string) {
    const norm = (s: string) => s.split("|").sort().join("|");
    return actualSorted === norm(templateRaw);
}