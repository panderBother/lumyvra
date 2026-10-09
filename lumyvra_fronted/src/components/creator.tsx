"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Music2, Clock3, Sparkles, WandSparkles } from "lucide-react";
import { tracks } from "@/lib/music";
import { type WorkMode } from "@/lib/works";
import { saveDraft, generateWork } from "@/lib/server-works";
import { useUser } from "@/lib/use-api";
import Link from "next/link";
import { InspirationGallery } from "./inspiration-gallery";
const modes = [
  { id: "text", label: "文生音乐" },
  { id: "lyrics", label: "歌词生音乐" },
  { id: "words", label: "文生歌词" },
];
export function Creator({
  initialMode,
  initialPrompt = "",
  initialGenre = "流行",
  initialMood = "治愈",
  initialSeconds = 180,
  initialCover = tracks[0].cover,
  draftId,
  sourceId,
  sourceTitle,
}: {
  initialMode: string;
  initialPrompt?: string;
  initialGenre?: string;
  initialMood?: string;
  initialSeconds?: number;
  initialCover?: string;
  draftId?: string;
  sourceId?: string;
  sourceTitle?: string;
}) {
  const router = useRouter();
  const { user } = useUser();
  const savedId = useRef(draftId);
  const [mode, setMode] = useState(initialMode);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [genre, setGenre] = useState(initialGenre);
  const [mood, setMood] = useState(initialMood);
  const [duration, setDuration] = useState(
    initialSeconds === 30
      ? "30秒"
      : [60, 120, 180].includes(initialSeconds)
        ? `${initialSeconds / 60}分钟`
        : "自定义",
  );
  const [customDuration, setCustomDuration] = useState(String(initialSeconds));
  const generating = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function generate(startGeneration = true) {
    if (generating.current) return;
    if (!user) { setError("请先登录，草稿将保存到你的账号。"); return; }
    if (!prompt.trim()) {
      setError("先写下一点灵感吧，让音乐有一个开始。");
      return;
    }
    generating.current = true;
    setBusy(true);
    try {
      const seconds =
        duration === "自定义"
          ? Number(customDuration)
          : duration === "30秒"
            ? 30
            : parseInt(duration) * 60;
      const work = await saveDraft(
        {
          prompt,
          mode: mode as WorkMode,
          genre,
          mood,
          seconds,
          cover: initialCover,
          sourceId,
          sourceTitle,
        },
        savedId.current,
        startGeneration,
      );
      savedId.current = work.id;
      if (startGeneration) await generateWork(work.id);
      router.push(
        startGeneration
          ? `/create/progress?mode=${mode}&id=${encodeURIComponent(work.id)}`
          : `/result?id=${encodeURIComponent(work.id)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "草稿保存失败，请重试。");
      generating.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="creator-columns">
      <section className="creator-form panel">
        {!user && <p className="remix-source">登录后可保存草稿、生成和发布作品。<Link href="/login" target="_blank" rel="noopener noreferrer">去登录（新标签页） →</Link></p>}
        {sourceTitle && (
          <p className="remix-source">
            灵感来自「{sourceTitle}」 · 修改下面的内容，创作你的版本。
          </p>
        )}
        {draftId && (
          <p className="remix-source">
            正在继续未发布草稿，重新生成会更新这份草稿。
          </p>
        )}
        <div className="segmented" aria-label="创作方式">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={mode === m.id ? "selected" : ""}
              aria-pressed={mode === m.id}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="field-title">
          <label htmlFor="prompt">
            {mode === "lyrics" ? "写下你的歌词" : "描述你的音乐灵感"}
          </label>
          <Sparkles size={16} />
        </div>
        <div className="prompt-wrap">
          <textarea
            id="prompt"
            value={prompt}
            maxLength={500}
            onChange={(e) => {
              setPrompt(e.target.value);
              setError("");
            }}
            placeholder={
              mode === "lyrics"
                ? "在这里输入歌词，AI 将为你的文字谱写旋律…"
                : "请输入你想创作的内容，例如：\n一首温暖治愈的夏日情歌，关于青春、海浪、日落…"
            }
          />
          <span>{prompt.length}/500</span>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="prompt-suggestions">
          <span>
            <WandSparkles size={13} /> 为你推荐
          </span>
          <div>
            {["一个关于夏天的日记", "写一首治愈的民谣", "星光 海边 晚风"].map(
              (t) => (
                <button
                  className="suggestion"
                  onClick={() => {
                    setPrompt(t);
                    setError("");
                  }}
                  key={t}
                >
                  {t}
                </button>
              ),
            )}
          </div>
        </div>
        <fieldset>
          <legend>
            期望风格 <span>选择你喜欢的音乐类型</span>
          </legend>
          <div className="option-grid">
            {[
              "流行",
              "民谣",
              "电子",
              "R&B",
              "古风",
              "摇滚",
              "轻音乐",
              "说唱",
              "爵士",
              "纯音乐",
              "其他",
            ].map((t) => (
              <button
                className={genre === t ? "option selected" : "option"}
                onClick={() => setGenre(t)}
                aria-pressed={genre === t}
                key={t}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>
            歌曲情绪 <span>赋予旋律独特的情感</span>
          </legend>
          <div className="option-grid">
            {["开心", "治愈", "悲伤", "浪漫", "激情", "平静"].map((t) => (
              <button
                className={mood === t ? "option selected" : "option"}
                onClick={() => setMood(t)}
                aria-pressed={mood === t}
                key={t}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>歌曲时长</legend>
          <div className="option-grid">
            {["30秒", "1分钟", "2分钟", "3分钟", "自定义"].map((t) => (
              <button
                className={duration === t ? "option selected" : "option"}
                onClick={() => setDuration(t)}
                aria-pressed={duration === t}
                key={t}
              >
                {t}
              </button>
            ))}
          </div>
          {duration === "自定义" && (
            <label className="custom-duration">
              时长（30–300 秒）
              <input
                type="number"
                min="30"
                max="300"
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value)}
                onBlur={() =>
                  setCustomDuration(
                    String(
                      Math.min(300, Math.max(30, Number(customDuration) || 30)),
                    ),
                  )
                }
              />
            </label>
          )}
        </fieldset>
        <button
          className="button gradient generate-button"
          onClick={() => generate()}
          disabled={busy}
        >
          <Music2 size={21} />
          {busy
            ? "正在保存草稿…"
            : mode === "words"
              ? "开始生成歌词"
              : "开始生成音乐"}
        </button>
        <button
          className="button secondary save-creation-draft"
          onClick={() => generate(false)}
          disabled={busy}
        >
          先保存草稿，稍后创作
        </button>
        <p className="generation-note">
          <Clock3 size={14} /> 演示生成由后端处理 <span>· 不生成真实音频</span>
        </p>
      </section>
      <aside className="inspiration panel">
        <InspirationGallery compact />
      </aside>
    </div>
  );
}
