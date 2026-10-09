export type Track = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  mood: string;
  cover: string;
  duration: string;
  plays: string;
  likes: string;
};
export const tracks: Track[] = [
  {
    id: "summer",
    title: "夏日的风",
    artist: "Luna",
    genre: "流行",
    mood: "治愈",
    cover: "community_sunset",
    duration: "3:24",
    plays: "2.3w",
    likes: "1.2k",
  },
  {
    id: "city",
    title: "城市的夜晚",
    artist: "Echo",
    genre: "电子",
    mood: "夜晚",
    cover: "community_city",
    duration: "3:12",
    plays: "1.9w",
    likes: "986",
  },
  {
    id: "stars",
    title: "星空下的约定",
    artist: "小野",
    genre: "民谣",
    mood: "浪漫",
    cover: "community_stars",
    duration: "3:20",
    plays: "3.1w",
    likes: "2.1k",
  },
  {
    id: "future",
    title: "未来之光",
    artist: "Z.Gw",
    genre: "电子",
    mood: "梦幻",
    cover: "sunset_coast",
    duration: "3:45",
    plays: "2.6w",
    likes: "1.6k",
  },
  {
    id: "ocean",
    title: "海边的日记",
    artist: "Aiden",
    genre: "轻音乐",
    mood: "放松",
    cover: "community_island",
    duration: "3:20",
    plays: "1.9w",
    likes: "852",
  },
  {
    id: "rain",
    title: "雨后的思念",
    artist: "Nico",
    genre: "古风",
    mood: "治愈",
    cover: "community_forest",
    duration: "3:20",
    plays: "4.2w",
    likes: "2.4k",
  },
];
const restoredCovers: Record<string, string> = {
  community_sunset: "summer",
  community_city: "city",
  community_stars: "stars",
  sunset_coast: "future",
  community_island: "ocean",
  community_forest: "rain",
};
export const coverUrl = (cover: string) =>
  restoredCovers[cover]
    ? `/assets/hd/${restoredCovers[cover]}.webp`
    : `/assets/covers/${cover}.webp`;
export const getTrack = (id?: string) =>
  tracks.find((track) => track.id === id) ?? tracks[0];
export const lyrics = [
  "夏日的风 轻轻吹过",
  "带走了昨日的烦恼",
  "繁花沙滩漫步",
  "我们一起看日落",
  "海风轻轻唱起歌谣",
  "星光落在你的眼角",
  "把这段时光写成歌",
  "让旋律陪我们到老",
];
