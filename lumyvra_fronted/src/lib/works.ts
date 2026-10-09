import { tracks, lyrics } from "./music";

export const WORKS_KEY = "lumyvra.works.v1";
export const WORKS_EVENT = "lumyvra:works";
export const modes = {
  text: "文生音乐",
  lyrics: "歌词生音乐",
  words: "文生歌词",
} as const;
export type WorkMode = keyof typeof modes;
export type Work = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  mode: WorkMode;
  genre: string;
  mood: string;
  seconds: number;
  cover: string;
  lyrics: string;
  sourceId?: string;
  sourceTitle?: string;
  status: "draft" | "published";
  ready: boolean;
  allowRemix: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};
export type WorkInput = Pick<
  Work,
  | "prompt"
  | "mode"
  | "genre"
  | "mood"
  | "seconds"
  | "cover"
  | "sourceId"
  | "sourceTitle"
>;

export function parseWorks(raw: string | null): Work[] {
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (data.version !== 1 || !Array.isArray(data.works))
    throw new Error("本地作品数据无法读取，已保留原数据。请勿清除浏览器存储。");
  for (const w of data.works) {
    if (
      !w ||
      typeof w.id !== "string" ||
      !w.id.startsWith("local-") ||
      ![
        "title",
        "description",
        "prompt",
        "genre",
        "mood",
        "lyrics",
        "createdAt",
        "updatedAt",
      ].every((k) => typeof w[k] === "string") ||
      !Object.hasOwn(modes, w.mode) ||
      !["draft", "published"].includes(w.status) ||
      typeof w.ready !== "boolean" ||
      typeof w.allowRemix !== "boolean" ||
      !Number.isFinite(w.seconds) ||
      w.seconds < 30 ||
      w.seconds > 300 ||
      !tracks.some((t) => t.cover === w.cover) ||
      (w.status === "published" && !w.ready)
    ) {
      throw new Error(
        "本地作品数据无法读取，已保留原数据。请勿清除浏览器存储。",
      );
    }
  }
  return data.works;
}

function read() {
  try {
    return parseWorks(window.localStorage.getItem(WORKS_KEY));
  } catch {
    throw new Error(
      "无法读取本地作品，已有数据已保留。请检查浏览器存储权限后重试。",
    );
  }
}
function write(works: Work[]) {
  try {
    window.localStorage.setItem(
      WORKS_KEY,
      JSON.stringify({ version: 1, works }),
    );
  } catch {
    throw new Error(
      "保存失败：浏览器存储不可用或已满。请检查存储权限后重试，当前操作尚未保存。",
    );
  }
  window.dispatchEvent(new Event(WORKS_EVENT));
}
function update(id: string, change: (work: Work) => Work) {
  const works = read();
  const current = works.find((w) => w.id === id);
  if (!current) throw new Error("未找到这份作品，请返回个人中心检查。");
  const next = change(current);
  write(works.map((w) => (w.id === id ? next : w)));
  return next;
}
export function saveDraft(
  input: WorkInput,
  existingId?: string,
  regenerate = false,
) {
  if (!input.prompt.trim()) throw new Error("请先写下一点创作灵感。");
  const works = read();
  const existing = existingId
    ? works.find((w) => w.id === existingId)
    : undefined;
  if (existingId && (!existing || existing.status !== "draft"))
    throw new Error("这份草稿已不存在或已发布，请返回作品列表。");
  const now = new Date().toISOString();
  const prompt = input.prompt.trim().slice(0, 500);
  const seconds = Math.round(Math.min(300, Math.max(30, input.seconds || 180)));
  const unchanged =
    existing &&
    existing.prompt === prompt &&
    existing.seconds === seconds &&
    existing.mode === input.mode &&
    existing.genre === input.genre &&
    existing.mood === input.mood &&
    existing.cover === input.cover;
  const ready = Boolean(existing?.ready && unchanged && !regenerate);
  const work: Work = {
    ...input,
    prompt,
    seconds,
    id: existing?.id ?? `local-${crypto.randomUUID()}`,
    title:
      existing?.title ?? input.prompt.trim().replace(/\s+/g, " ").slice(0, 18),
    description: existing?.description ?? "",
    lyrics: ready
      ? existing!.lyrics
      : input.mode === "lyrics"
        ? prompt
        : lyrics.join("\n"),
    status: "draft",
    ready,
    allowRemix: false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  write(
    existing
      ? works.map((w) => (w.id === work.id ? work : w))
      : [work, ...works],
  );
  return work;
}
export function completeDraft(id: string) {
  return update(id, (w) =>
    w.ready || w.status === "published"
      ? w
      : { ...w, ready: true, updatedAt: new Date().toISOString() },
  );
}
export function editWork(id: string, title: string, description: string) {
  if (!title.trim()) throw new Error("请填写作品名称。");
  return update(id, (w) => {
    if (w.status !== "draft") throw new Error("已发布作品不可在草稿中修改。");
    return {
      ...w,
      title: title.trim().slice(0, 40),
      description: description.trim().slice(0, 240),
      updatedAt: new Date().toISOString(),
    };
  });
}
export function publishWork(
  id: string,
  title: string,
  description: string,
  allowRemix: boolean,
) {
  if (!title.trim()) throw new Error("请填写作品名称。");
  return update(id, (w) => {
    if (!w.ready) throw new Error("请先完成生成，再发布作品。");
    if (w.status === "published") return w;
    const now = new Date().toISOString();
    return {
      ...w,
      title: title.trim().slice(0, 40),
      description: description.trim().slice(0, 240),
      status: "published",
      allowRemix,
      updatedAt: now,
      publishedAt: now,
    };
  });
}
export const publishedWorks = (works: Work[]) =>
  works.filter((w) => w.status === "published" && w.ready);
export const searchPublishedWorks = (works: Work[], query: string) =>
  publishedWorks(works).filter((w) =>
    `${w.title}${w.genre}${w.mood}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
export const remixableWorks = (works: Work[]) =>
  publishedWorks(works).filter((w) => w.allowRemix);
export const workDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
