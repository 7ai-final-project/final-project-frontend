// frontend\data\scenes.ts
export interface Choice {
  id: string;
  text: string;
  nextScene?: string;
}

export interface Scene {
  id: string;
  title?: string;
  story: string;
  question?: string;
  choices: Choice[];
  image?: any;
}

export const scenes: Scene[] = [
   {
      id: "scene0",
      title: "시작: 위험한 밤",
      story: "옛날 옛날, 깊은 산골에 착한 오누이가 살고 있었어요. 하지만 무서운 호랑이가 오누이의 집에 찾아왔습니다...",
      question: "위험한 상황에 처한 오누이. 당신이라면 어떻게 하시겠습니까?",
      choices: [
        { id: "A", text: "뒷문으로 조용히 도망친다\n집 뒤쪽 산으로 향해 숨을 곳을 찾는다", nextScene: "scene1A" },
        { id: "B", text: "다락방으로 올라가 숨는다\n집 안에서 가장 높은 곳으로 피해 시간을 번다", nextScene: "scene1B" },
        { id: "C", text: "큰 소리로 마을 사람들에게 도움을 요청한다\n목숨을 걸고 외부의 도움을 구한다", nextScene: "scene1C" },
        { id: "D", text: "호랑이와 직접 대화를 시도한다\n용기를 내어 문을 사이에 두고 협상을 시도한다", nextScene: "scene1D" },
      ],
      image: require("@/assets/images/game/multi_mode/scene/scene_000.png")
    },

    {
      id: "scene1A",
      title: "숲 속으로의 도망",
      story: "오누이는 뒷문으로 도망쳐 산으로 향했습니다. 숲은 어두웠지만, 잠시나마 호랑이의 추격을 피할 수 있었죠...",
      choices: [
        { id: "A1", text: "계속 산속 깊이 들어간다", nextScene: "scene2A" },
        { id: "A2", text: "나무 위로 올라가 숨는다", nextScene: "scene2B" },
      ],
      image: require("@/assets/images/game/multi_mode/scene/scene_000.png")
    },

    {
      id: "scene1B",
      title: "다락방의 공포",
      story: "오누이는 다락방으로 올라가 문을 걸어 잠갔습니다. 하지만 호랑이는 집안을 뒤지며 점점 다락으로 다가옵니다...",
      choices: [
        { id: "B1", text: "창문을 통해 뛰어내린다", nextScene: "scene2C" },
        { id: "B2", text: "기도하며 호랑이가 포기하기를 기다린다", nextScene: "scene2D" },
      ],
      image: require("@/assets/images/game/multi_mode/scene/scene_000.png")
    },

    {
      id: "scene1C",
      title: "헛된 외침",
      story: "오누이는 큰 소리로 마을 사람들을 불렀습니다. 그러나 깊은 산속에서는 아무도 들을 수 없었습니다...",
      choices: [
        { id: "C1", text: "다시 집 안으로 들어간다", nextScene: "scene2E" },
        { id: "C2", text: "산길을 따라 달려 나간다", nextScene: "scene2F" },
      ],
      image: require("@/assets/images/game/multi_mode/scene/scene_000.png")
    },

    {
      id: "scene1D",
      title: "호랑이와의 대화",
      story: "오누이는 문을 사이에 두고 호랑이에게 말했습니다. '호랑이 아저씨, 우리를 해치지 말아주세요.' 하지만 호랑이는 웃으며 대답했습니다...",
      choices: [
        { id: "D1", text: "계속 설득을 시도한다", nextScene: "scene2G" },
        { id: "D2", text: "다락으로 도망친다", nextScene: "scene1B" },
      ],
      image: require("@/assets/images/game/multi_mode/scene/scene_000.png")
    },

    // ----------------------------
    // scene2 계열 (A~G)
    // ----------------------------
    {
      id: "scene2A",
      title: "깊은 숲 속으로",
      story: "오누이는 더 깊은 숲속으로 들어갔습니다. 나무들이 빽빽해 앞이 잘 보이지 않았습니다...",
      choices: [
        { id: "A1-1", text: "계속 앞으로 달린다", nextScene: "scene3A" },
        { id: "A1-2", text: "큰 바위 뒤에 숨어 쉰다", nextScene: "scene3B" },
      ],
      image: require("@/assets/images/game/multi_mode/scene/scene_000.png")
    },

    {
      id: "scene2B",
      title: "나무 위의 숨바꼭질",
      story: "오누이는 큰 나무 위로 올라가 호흡을 죽였습니다. 아래에서는 호랑이의 그림자가 어슬렁거렸습니다...",
      choices: [
        { id: "B1-1", text: "끝까지 숨을 참고 버틴다", nextScene: "scene3C" },
        { id: "B1-2", text: "조용히 다른 나무로 옮겨간다", nextScene: "scene3D" },
      ],
      image: require("@/assets/images/game/multi_mode/scene/scene_000.png")
    },

    {
      id: "scene2C",
      title: "창문을 향한 도약",
      story: "오누이는 창문을 박차고 뛰어내렸습니다. 착지 충격에 다리가 조금 아팠지만, 호랑이로부터 거리를 벌릴 수 있었습니다...",
      choices: [
        { id: "C1-1", text: "바로 숲 속으로 달려간다", nextScene: "scene3E" },
        { id: "C1-2", text: "근처 장작더미에 몸을 숨긴다", nextScene: "scene3F" },
      ],
      image: require("@/assets/images/game/multi_mode/scene/scene_000.png")
    },

    {
      id: "scene2D",
      title: "절박한 기도",
      story: "오누이는 호랑이가 떠나기를 바라며 조용히 기도했습니다. 하지만 호랑이의 발소리는 점점 더 가까워졌습니다...",
      choices: [
        { id: "D1-1", text: "기도를 멈추고 달린다", nextScene: "scene3G" },
        { id: "D1-2", text: "창문을 찾아 탈출한다", nextScene: "scene3H" },
      ],
      image: require("@/assets/images/game/multi_mode/scene/scene_000.png")
    },

    {
      id: "scene2E",
      title: "집 안으로의 귀환",
      story: "오누이는 다시 집 안으로 들어갔습니다. 어두운 집안은 호랑이의 숨소리로 가득 차 있었습니다...",
      choices: [
        { id: "E1-1", text: "부엌으로 달려간다", nextScene: "scene3I" },
        { id: "E1-2", text: "다락으로 숨어든다", nextScene: "scene1B" }, // 기존 분기로 복귀
      ],
      image: require("@/assets/images/game/multi_mode/scene/scene_000.png")
    },

    {
      id: "scene2F",
      title: "산길을 따라 달리기",
      story: "오누이는 숨을 헐떡이며 산길을 달렸습니다. 뒤에서는 호랑이의 울음소리가 점점 커졌습니다...",
      choices: [
        { id: "F1-1", text: "길을 벗어나 숲으로 숨는다", nextScene: "scene3J" },
        { id: "F1-2", text: "계속 산길을 따라 달린다", nextScene: "scene3K" },
      ],
      image: require("@/assets/images/game/multi_mode/scene/scene_000.png")
    },

    {
      id: "scene2G",
      title: "끝없는 설득",
      story: "오누이는 마지막 희망으로 호랑이를 계속 설득했습니다. 그러나 호랑이의 눈빛은 점점 더 차가워졌습니다...",
      choices: [
        { id: "G1-1", text: "호랑이에게 선물을 제안한다", nextScene: "scene3L" },
        { id: "G1-2", text: "마지막으로 도망친다", nextScene: "scene3M" },
      ],
      image: require("@/assets/images/game/multi_mode/scene/scene_000.png")
    },
];
