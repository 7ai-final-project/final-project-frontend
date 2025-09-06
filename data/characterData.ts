export type SunMoonCharacter = {
  topic: "해와달";
  id: string;
  name: string;
  description?: string;
  image: any;
  stats: { 체력: number; 지혜: number; 행운: number };
  hp?: number;
};

// ex) 예시 topic이 "판타지의 어느 세계"일 때의 캐릭터 타입
export type FantasyCharacter = {
  topic: "판타지의 어느 세계";
  id: string;
  name: string;
  description?: string;
  image: any;
  stats: { 힘: number; 지혜: number; 민첩: number };
  hp: number; // 판타지 캐릭터는 hp를 필수로 가집니다.
};

// Character 타입은 위 두 타입의 유니온입니다.
export type Character = SunMoonCharacter | FantasyCharacter;

export const characters: Character[] = [
  {
    topic: "해와달",
    id: "brother",
    name: "남동생",
    description: "용감하지만 아직 미숙한 아이.",
    image: require("@/assets/images/game/multi_mode/character/sun.png"),
    stats: { 체력: 4, 지혜: 2, 행운: 3 },
    hp: 4,
  },
  {
    topic: "해와달",
    id: "sister",
    name: "누나",
    description: "지혜롭고 침착한 아이.",
    image: require("@/assets/images/game/multi_mode/character/moon.png"),
    stats: { 체력: 4, 지혜: 3, 행운: 2 },
    hp: 4,
  },
  {
    topic: "해와달",
    id: "tiger",
    name: "호랑이",
    description: "강력한 힘과 야성을 가진 존재.",
    image: require("@/assets/images/game/multi_mode/character/tiger.png"),
    stats: { 체력: 5, 지혜: 1, 행운: 3 },
    hp: 5,
  },
  {
    topic: "해와달",
    id: "goddess",
    name: "하늘신",
    description: "지혜롭고 신비로운 존재.",
    image: require("@/assets/images/game/multi_mode/character/goddess.png"),
    stats: { 체력: 1, 지혜: 4, 행운: 4 },
    hp: 3,
  },
  {
    topic: "판타지의 어느 세계",
    id: "knight",
    name: "기사",
    description: "굳건한 신념과 강인한 체력으로 무장했습니다.",
    image: require("@/assets/images/game/multi_mode/character/knight.png"),
    stats: { 힘: 4, 지혜: 1, 민첩: 3 },
    hp: 10,
  },
  {
    topic: "판타지의 어느 세계",
    id: "wizard",
    name: "마법사",
    description: "세상의 이치와 지식을 탐구합니다.",
    image: require("@/assets/images/game/multi_mode/character/wizard.png"),
    stats: { 힘: 1, 지혜: 4, 민첩: 3 },
    hp: 8,
  },
];

// 주제별로 캐릭터를 그룹화하는 객체 (기존 코드와 동일)
export const charactersByTopic: { [key: string]: Character[] } = characters.reduce((acc, character) => {
  const { topic } = character;
  if (!acc[topic]) {
    acc[topic] = [];
  }
  acc[topic].push(character);
  return acc;
}, {} as { [key: string]: Character[] });