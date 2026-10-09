import { tracks } from "./music";
import type { Work, WorkInput } from "./works";
export type Inspiration = WorkInput & {
  id: string;
  title: string;
  artist: string;
  description: string;
  local?: boolean;
};
const prompts = [
  "一首温暖治愈的夏日流行歌。木吉他与轻盈鼓点，描写海风、日落和青春里没说出口的告白，副歌明亮而容易哼唱。",
  "一首适合夜晚独处的电子音乐。柔和的合成器、低沉的贝斯与缓慢的鼓点，像凌晨穿过城市霓虹，安静又有律动。",
  "一首浪漫的民谣。用指弹吉他和温柔的人声，讲述两个人在星空下许下约定的故事，从轻声叙述走向温暖的合唱。",
  "一首充满希望的电子音乐。明亮的合成器和渐进的节奏，描绘走向未知的勇气，副歌有开阔、向上的能量。",
  "一段适合海边散步的轻音乐。钢琴、原声吉他与轻柔弦乐，节奏舒缓，像把潮汐和晚风收进一本日记。",
  "一首雨后思念的古风歌曲。古筝与笛子交织，细腻人声唱出旧时约定，前半段克制，副歌悠长而温柔。",
];
export const inspirations: Inspiration[] = tracks.map((t, i) => ({
  ...t,
  prompt: prompts[i],
  description: [
    "把夏天写成一封有旋律的信。",
    "给夜行的人，一段自己的节奏。",
    "借一片星光，说出心里的约定。",
    "下一次出发，从这个节拍开始。",
    "让生活慢下来，听见海的呼吸。",
    "雨停以后，还有一段旋律留下。",
  ][i],
  mode: "text",
  seconds: 180,
  mood: ["治愈", "平静", "浪漫", "激情", "平静", "治愈"][i],
}));
export function workInspiration(w: Work): Inspiration {
  return {
    ...w,
    artist: w.artist || "音乐人",
    local: true,
    description: w.description || "从这段创作出发，写下你的版本。",
  };
}
export const remixHref = (i: Inspiration) =>
  `/create?${i.local ? "remix" : "template"}=${encodeURIComponent(i.id)}`;
