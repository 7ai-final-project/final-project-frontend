// util/ttrpg.ts
export type Grade = "SP" | "S" | "F" | "SF";

export type Choice = {
  id: string;
  text: string;
  appliedStat: keyof CharacterStats;
  modifier: number;
};

export type CharacterStats = { 체력: number; 지혜: number; 행운: number };

export type SceneTurnSpec = {
  role: string;
  title: string;
  description: string;
  choices: Choice[];
  fragments: Record<string, string>;
  statChanges: Record<string, any>;
};

// 실시간 모드를 위한 기존 타입
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
  round?: SceneRoundSpec;   // 실시간 모드용 (Optional)
  turns?: SceneTurnSpec[];  // 턴제 모드용 (Optional)
  nextScene?: { [key: string]: any }; // 공통 속성으로 변경
};

export type PerRoleResult = {
  role: string;
  choiceId: string;
  grade: Grade; // 서버 판정 결과 (SP,S,F,SF)
  dice: number; // 서버 주사위
  appliedStat: keyof CharacterStats;
  statValue: number;
  modifier: number;
  total: number;
};

export type RoundResult = {
  sceneIndex: number;
  results: PerRoleResult[]; // 모든 플레이어
  logs: string[]; // "남동생: d20=14 + 지혜(2) + 보정(+1) = 17 → 성공" 등
};

export function getSceneTemplate(templates: SceneTemplate[], index: number) {
  return templates.find((t) => t.index === index) ?? null;
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
    // 실시간 모드 데이터 구조 처리
    if (tpl.round) {
      const key = `${role}_${pr.choiceId}_${pr.grade}` as const;
      frag = tpl.round.fragments[key] ?? "";
    } 
    // 턴제 모드 데이터 구조 처리
    else if (tpl.turns) {
      const turnSpec = tpl.turns.find(t => t.role === role);
      if (turnSpec) {
        const key = `${pr.choiceId}_${pr.grade}` as const;
        frag = turnSpec.fragments[key] ?? "";
      }
    }
    
    if (frag) parts.push(frag);
  }

  // 조합 요약은 실시간 모드에만 있는 것으로 가정
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
  // 템플릿 키도 분해해서 정렬 비교 (간단화)
  const norm = (s: string) => s.split("|").sort().join("|");
  return actualSorted === norm(templateRaw);
}
