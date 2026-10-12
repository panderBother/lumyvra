"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Music2, Clock3, Sparkles, WandSparkles, PenLine } from "lucide-react";
import { tracks } from "@/lib/music";
import { type Work, type WorkInput, type WorkMode } from "@/lib/works";
import { saveDraft, generateWork } from "@/lib/server-works";
import { useUser, useMusicConfig } from "@/lib/use-api";
import Link from "next/link";
import { InspirationGallery } from "./inspiration-gallery";
import { generationFlow } from "@/lib/generation-flow";
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
  initialStylePrompt = "",
  initialRevision,
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
  initialStylePrompt?: string;
  initialRevision?: number;
  draftId?: string;
  sourceId?: string;
  sourceTitle?: string;
}) {
  const router = useRouter();
  const { user } = useUser();
  const music = useMusicConfig();
  const savedId = useRef(draftId);
  const revision = useRef(initialRevision ?? (draftId ? 0 : undefined));
  const startMode: WorkMode = initialMode === "lyrics" || initialMode === "words" ? initialMode : "text";
  const [mode, setMode] = useState<WorkMode>(startMode);
  const [prompts, setPrompts] = useState<Record<WorkMode, string>>({ text: "", lyrics: "", words: "", [startMode]: initialPrompt });
  const prompt = prompts[mode];
  const setPrompt = (value: string) => setPrompts(previous => ({ ...previous, [mode]: value }));
  const [stylePrompt, setStylePrompt] = useState(initialStylePrompt);
  const promptLimit = mode === "lyrics" ? 4096 : 2000;
  const isDemo = music.data?.generationMode === "demo";
  const engine = music.data?.musicEngine;
  const [genre, setGenre] = useState(startMode !== "text" && initialGenre === "纯音乐" ? "流行" : initialGenre);
  const [mood, setMood] = useState(initialMood);
  const unavailable = !music.data || (!isDemo && (mode === "words" ? !engine?.producerAvailable : !engine?.available || (mode === "text" && genre !== "纯音乐" && !engine?.producerAvailable)));
  const [duration, setDuration] = useState(
    initialSeconds === 30
      ? "30秒"
      : [60, 120, 180, 240].includes(initialSeconds)
        ? `${initialSeconds / 60}分钟`
        : "自定义",
  );
  const [customDuration, setCustomDuration] = useState(String(initialSeconds));
  const flow = generationFlow(mode, genre === "纯音乐");
  const lengthLabels: Record<string, string> = { "30秒": "简短一段", "1分钟": "简短片段", "2分钟": "精简歌词", "3分钟": "完整歌词", "4分钟": "长篇歌词", "自定义": "自定义篇幅" };
  const generating = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draftStatus, setDraftStatus] = useState(draftId ? "草稿已保存" : "输入后自动保存草稿");
  const saveFlight = useRef<Promise<Work> | null>(null);
  const lastSaved = useRef<{ key: string; work: Work } | null>(null);
  const draftInput = useMemo<WorkInput>(() => ({ prompt, stylePrompt: mode === "words" ? "" : stylePrompt, mode, genre, mood,
    seconds: duration === "自定义" ? Number(customDuration) : duration === "30秒" ? 30 : parseInt(duration) * 60,
    cover: initialCover, sourceId, sourceTitle }), [prompt, stylePrompt, mode, genre, mood, duration, customDuration, initialCover, sourceId, sourceTitle]);
  const latestInput = useRef("");
  useEffect(() => { latestInput.current = JSON.stringify(draftInput); }, [draftInput]);
  const persist = useCallback(async (input: WorkInput, regenerate: boolean) => {
    while (saveFlight.current) await saveFlight.current;
    const key = JSON.stringify(input);
    if (!regenerate && lastSaved.current?.key === key) return lastSaved.current.work;
    setDraftStatus("正在保存草稿…");
    const request = saveDraft(input, savedId.current, regenerate, revision.current);
    saveFlight.current = request;
    try {
      const work = await request;
      savedId.current = work.id; revision.current = work.revision;
      lastSaved.current = { key, work };
      setDraftStatus(key === latestInput.current ? "草稿已保存" : "上一版已保存，当前修改待保存");
      if (!generating.current && window.location.pathname === "/create") {
        window.history.replaceState(null, "", `/create?draft=${encodeURIComponent(work.id)}`);
      }
      return work;
    } catch (err) {
      setDraftStatus("保存失败，输入仍在当前页面"); throw err;
    } finally { saveFlight.current = null; }
  }, []);
  useEffect(() => {
    if (!user || busy || !draftInput.prompt.trim() || draftInput.prompt.length > promptLimit || !Number.isInteger(draftInput.seconds) || draftInput.seconds < 30 || draftInput.seconds > 240 || (mode !== "text" && genre === "纯音乐")) return;
    const timer = setTimeout(() => {
      if (generating.current) return;
      void persist(draftInput, false).catch(err => setError(err instanceof Error ? err.message : "草稿保存失败。"));
    }, 2000);
    return () => clearTimeout(timer);
  }, [user, busy, draftInput, promptLimit, mode, genre, persist]);
  async function generate(startGeneration = true) {
    if (generating.current) return;
    if (!user) { setError("请先登录，草稿将保存到你的账号。"); return; }
    if (!prompt.trim()) {
      setError(mode === "lyrics" ? "请先填入你想演唱的歌词。" : mode === "words" ? "请先描述歌词的主题或故事。" : "先写下一点灵感吧，让音乐有一个开始。");
      return;
    }
    if (prompt.length > promptLimit || (mode !== "text" && genre === "纯音乐")) {
      setError(mode !== "text" && genre === "纯音乐" ? "生成歌词或歌词演唱，请选择演唱风格。" : `输入最多 ${promptLimit} 字符，请缩短内容。`);
      return;
    }
    generating.current = true;
    setBusy(true);
    try {
      const work = await persist(draftInput, startGeneration);
      if (startGeneration) await generateWork(work.id);
      router.push(
        startGeneration
          ? `/create/progress?mode=${work.mode}&id=${encodeURIComponent(work.id)}`
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
            正在继续草稿。新生成会保存为独立候选，旧版本仍可试听。
          </p>
        )}
        <div className="segmented" aria-label="创作方式">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                const nextMode = m.id as WorkMode;
                setMode(nextMode); setError("");
                if (nextMode !== "text" && genre === "纯音乐") setGenre("流行");
              }}
              disabled={busy}
              className={mode === m.id ? "selected" : ""}
              aria-pressed={mode === m.id}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="creator-mode-description">{flow.description}</p>
        <div className="field-title">
          <label htmlFor="prompt">
            {mode === "lyrics" ? "写下你的歌词" : mode === "words" ? "描述歌词的主题与故事" : "描述你的音乐灵感"}
          </label>
          <Sparkles size={16} />
        </div>
        <div className="prompt-wrap">
          <textarea
            id="prompt"
            value={prompt}
            maxLength={promptLimit}
            disabled={busy}
            onChange={(e) => {
              setPrompt(e.target.value);
              setError("");
            }}
            placeholder={
              mode === "lyrics"
                ? "粘贴完整歌词，可用 [Verse]、[Chorus] 标记段落。\n你的歌词会被保留，AI 将为它谱曲并演唱。"
                : mode === "words" ? "想写给谁？发生在哪里？想说哪一句话？\n例如：末班地铁上还舍不得告别，副歌围绕“先别说晚安”展开。"
                  : "请输入你想创作的内容，例如：\n节奏鲜明的流行 R&B，关于夏夜不舍的告别，副歌轻快、有记忆点…"
            }
          />
          <span>{prompt.length}/{promptLimit}</span>
        </div>
        {mode !== "words" && <label className="custom-duration">
          制作描述（选填）
          <textarea value={stylePrompt} maxLength={512} rows={3} onChange={e => setStylePrompt(e.target.value)} placeholder="例如：温暖的女声、原声吉他，副歌加入弦乐，结尾自然收束。" />
        </label>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {mode !== "lyrics" && <div className="prompt-suggestions">
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
        </div>}
        <fieldset>
          <legend>
            {mode === "words" ? "歌词风格" : "期望风格"} <span>{mode === "words" ? "选择文字与段落的表达风格" : "选择你喜欢的音乐类型"}</span>
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
            ].filter(t => mode === "text" || t !== "纯音乐").map((t) => (
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
            {mode === "words" ? "表达情绪" : "歌曲情绪"} <span>{mode === "words" ? "为故事定下情绪" : "赋予旋律独特的情感"}</span>
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
          <legend>{mode === "words" ? "歌词篇幅" : "歌曲时长"}</legend>
          <div className="option-grid">
            {["30秒", "1分钟", "2分钟", "3分钟", "4分钟", "自定义"].map((t) => (
              <button
                className={duration === t ? "option selected" : "option"}
                onClick={() => setDuration(t)}
                aria-pressed={duration === t}
                key={t}
              >
                {mode === "words" ? lengthLabels[t] : t}
              </button>
            ))}
          </div>
          {duration === "自定义" && (
            <label className="custom-duration">
              {mode === "words" ? "按未来歌曲的目标时长规划篇幅（30–240 秒）" : "时长（30–240 秒；2–4 分钟为完整歌曲）"}
              <input
                type="number"
                min="30"
                max="240"
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value)}
                onBlur={() =>
                  setCustomDuration(
                    String(
                      Math.min(240, Math.max(30, Number(customDuration) || 30)),
                    ),
                  )
                }
              />
            </label>
          )}
        </fieldset>
        <p className="generation-note">{mode === "words" ? "这里只创作文字；篇幅会影响歌词长度与段落安排。完成后可再为歌词谱曲。" : "2–4 分钟用于完整歌曲，30 秒和 1 分钟用于短片段试听。"}</p>
        <button
          className="button gradient generate-button"
          onClick={() => generate()}
          disabled={busy || unavailable}
        >
          {mode === "words" ? <PenLine size={21} /> : <Music2 size={21} />}
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
        <p className="generation-note" role="status">{draftStatus}</p>
        <p className="generation-note">
          <Clock3 size={14} /> {isDemo ? "演示模式 · 不生成真实音频" : mode === "words" ? engine?.producerAvailable ? "使用已配置的歌词助手 · 本次不调用音乐引擎" : "歌词助手尚未就绪，仍可保存草稿" : engine?.available ? "完整歌曲在本地生成 · 不新增音乐 API 费用" : "音乐引擎尚未就绪，仍可保存草稿"}
        </p>
        {!isDemo && !engine?.producerAvailable && <p className="generation-note">歌词助手尚未连接。音乐引擎就绪后，可以先用「歌词生音乐」生成歌曲。</p>}
        {music.error && <p className="form-error" role="alert">{music.error}</p>}
      </section>
      <aside className="inspiration panel">
        <InspirationGallery compact />
      </aside>
    </div>
  );
}
