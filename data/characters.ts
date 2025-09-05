// frontend\data\characters.ts

export interface Character {
  name: string;
  image: any; // require() 또는 { uri: string } 가능
  stats: {
    체력: number;
    지혜: number;
    행운: number;
  };
}

export const characters: Character[] = [
  {
    name: "남동생",
    image: require("@/assets/images/game/multi_mode/character/sun.png"),
    stats: { 체력: 4, 지혜: 2, 행운: 3 },
  },
  {
    name: "누나",
    image: require("@/assets/images/game/multi_mode/character/moon.png"),
    stats: { 체력: 4, 지혜: 3, 행운: 2 },
  },
  {
    name: "호랑이",
    image: require("@/assets/images/game/multi_mode/character/tiger.png"),
    stats: { 체력: 5, 지혜: 1, 행운: 3 },
  },
  {
    name: "하늘신",
    image: require("@/assets/images/game/multi_mode/character/goddess.png"),
    stats: { 체력: 1, 지혜: 4, 행운: 4 },
  },
];