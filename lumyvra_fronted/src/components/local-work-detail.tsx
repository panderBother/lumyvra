"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, Send, Save, Pencil } from "lucide-react";
import { useWork } from "@/lib/use-works";
import { useUser } from "@/lib/use-api";
import { editWork, publishWork } from "@/lib/server-works";
import { FavoriteButton } from "./favorite-button";
import { SongPlayer, SongVersions } from "./song-versions";
import { PublishedWorkPlayer } from "./published-player";
import {
  modes,
  workDuration,
  type Work,
} from "@/lib/works";
import { coverUrl } from "@/lib/music";

export function LocalWorkDetail({ id }: { id: string }) {
  const { work, loaded, error } = useWork(id);
  if (!loaded)
    return (
      <div className="container page-space">
        <p role="status">正在读取作品…</p>
      </div>
    );
  if (!work || error)
    return (
      <div className="container page-space empty-state">
        <h1>暂时找不到这份作品</h1>
        <p>{error || "请确认作品已发布，或登录创建草稿的账号。"}</p>
        <Link className="button secondary" href="/profile?tab=drafts">
          回到草稿箱
        </Link>
      </div>
    );
  if (work.status === "published") return <PublishedWorkPlayer key={work.id} work={work} />;
  return <WorkDetail key={work.id} work={work} />;
}
function WorkDetail({ work }: { work: Work }) {
  const { user } = useUser();
  const own = user?.id === work.ownerId;
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(work.title);
  const [description, setDescription] = useState(work.description);
  const [allowRemix, setAllowRemix] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const published = work.status === "published";
  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      await editWork(work.id, title, description);
      setError("");
      setMessage("草稿已保存，可在个人中心继续查看。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败，请重试。");
    } finally { setBusy(false); }
  }
  async function publish() {
    if (busy) return;
    setBusy(true);
    try {
      await publishWork(work.id, title, description, allowRemix);
      setError("");
      setMessage("作品已发布，其他用户现在可以在广场查看。");
      setPublishing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发布失败，草稿仍已保留。");
    } finally { setBusy(false); }
  }
  return (
    <div className="container page-space local-result">
      <header className="collection-heading">
        <div className="page-heading">
          <span className="eyebrow">{work.mode === "words" ? published ? "歌词作品" : "歌词草稿" : published ? "音乐作品" : "创作草稿"}</span>
          <h1>
            {published
              ? work.mode === "words" ? "让这些文字，被看见。" : "让这首歌，被听见。"
              : work.ready
                ? work.mode === "words" ? "歌词已写好，下一步由你决定。" : "作品已就绪，给它一个名字。"
                : "灵感已保存，随时继续。"}
          </h1>
          <p>{work.audioUrl ? "歌曲与候选版本已保存，可以试听并下载。" : work.generationMode === "live" && work.mode === "words" ? "歌词已生成并保存，继续创作可以为它生成歌曲。" : work.generationMode === "demo" || work.generationMode === "sample" ? "演示作品 · 尚未生成真实音频。" : "创作方案已保存，生成完成后可以试听完整歌曲。"}</p>
        </div>
        <Link
          className="text-cta"
          href={`/profile?tab=${published ? "works" : "drafts"}`}
        >
          回到{published ? "我的作品" : "草稿箱"} <ArrowUpRight size={17} />
        </Link>
      </header>
      <div className="local-result-grid">
        <section>
          <div className="local-work-overview">
            <div className="local-work-art">
              <Image
                src={coverUrl(work.cover)}
                alt={work.title}
                fill
                quality={90}
                sizes="(max-width:760px) 40vw, 280px"
              />
            </div>
            <div>
              <span
                className={`work-status ${published ? "is-published" : ""}`}
              >
                {published
                  ? "已发布"
                  : work.ready
                    ? "草稿 · 未发布"
                    : "草稿 · 待生成"}
              </span>
              <h2>{work.title}</h2>
              <p>创作者：{work.artist || "音乐人"}</p>
              {published && <FavoriteButton id={work.id} />}
              <p>
                {work.genre} / {work.mood} / {modes[work.mode]}
              </p>
              {work.mode !== "words" && <p>目标时长 {workDuration(work.seconds)}</p>}
              {work.sourceTitle && <p>灵感来源：{work.sourceTitle}</p>}
              <p className="muted">
                {!work.ready
                  ? "灵感已保存，完成生成后可预览并发布。"
                  : work.mode === "lyrics"
                    ? "保留你输入的歌词"
                    : work.generationMode === "live" ? "歌词与生成版本分别保存" : "以下为演示歌词，尚未生成真实歌曲"}
              </p>
            </div>
          </div>
          {own && <SongVersions work={work} />}
          {!own && work.audioUrl && <SongPlayer audioUrl={work.audioUrl} />}
          {work.ready && (!own || !work.currentVersionId) ? (
            <section className="lyrics-panel panel">
              <h2>歌词{work.generationMode === "demo" && work.mode !== "lyrics" ? "示例" : ""}</h2>
              <p className="preserve-lines">{work.lyrics}</p>
            </section>
          ) : !work.ready ? (
            <section className="lyrics-panel panel">
              <h2>等待生成</h2>
              <p>
                {work.mode === "words" ? "这份草稿保存了歌词主题和写作参数。点击「继续创作」生成歌词，再阅读并选择版本。" : "这份草稿保存了你的灵感和创作参数。点击「继续创作」生成歌曲，再试听并选择版本。"}
              </p>
              <Link href={`/create/progress?id=${work.id}&mode=${work.mode}`} className="text-cta">查看生成任务状态 →</Link>
            </section>
          ) : null}
          {work.prompt && <details className="work-prompt-detail">
            <summary>这次创作的灵感</summary>
            <p className="preserve-lines">{work.prompt}</p>
          </details>}
        </section>
        <aside className="publication-panel panel">
          {published ? (
            <>
              <Check size={28} />
              <h2>作品已发布</h2>
              <p>{work.description || "还没有添加作品介绍。"}</p>
              <div className="publication-note">
                {work.allowRemix
                  ? "已允许做同款：这份作品会出现在创作灵感中。"
                  : "未开放做同款：作品仅展示在作品广场，不进入灵感页。"}
              </div>
              <Link className="button gradient" href="/community">
                查看作品广场 <ArrowUpRight size={16} />
              </Link>
              {work.allowRemix && (
                <Link
                  className="button secondary"
                  href={`/create?remix=${work.id}`}
                >
                  做一个新版本
                </Link>
              )}
              <Link className="text-cta" href="/promo">
                浏览创作灵感 <ArrowUpRight size={16} />
              </Link>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (publishing) publish();
                else save();
              }}
            >
              <h2>{publishing ? "发布你的作品" : "作品信息"}</h2>
              <label>
                作品名称
                <input
                  required
                  maxLength={40}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="给这段旋律起个名字"
                />
              </label>
              <label>
                作品介绍
                <textarea
                  maxLength={240}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="聊聊这首歌背后的故事（选填）"
                  rows={4}
                />
              </label>
              {publishing ? (
                <>
                  <label className="remix-checkbox">
                    <input
                      type="checkbox"
                      checked={allowRemix}
                      onChange={(e) => setAllowRemix(e.target.checked)}
                    />
                    <span>
                      <strong>允许其他人做同款</strong>
                      <small>
                        开启后，作品会进入创作灵感页，并展示你的提示词、风格和情绪，供他人套用。
                      </small>
                    </span>
                  </label>
                  <p className="publication-note">
                    发布后所有用户都能在作品广场查看。勾选做同款会同时公开你的提示词。
                  </p>
                  <button className="button gradient" type="submit" disabled={busy || !own}>
                    <Send size={16} />
                    确认发布
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setPublishing(false)}
                  >
                    暂不发布
                  </button>
                </>
              ) : (
                <>
                  <button className="button secondary" type="submit" disabled={busy || !own}>
                    <Save size={16} />
                    保存草稿
                  </button>
                  {work.ready ? (
                    <button
                      type="button"
                      className="button gradient"
                      onClick={() => {
                        setError("");
                        setPublishing(true);
                      }}
                    >
                      <Send size={16} />
                      发布作品
                    </button>
                  ) : (
                    <Link
                      href={`/create?draft=${work.id}`}
                      className="button gradient"
                    >
                      继续创作
                    </Link>
                  )}
                  <Link href={`/create?draft=${work.id}`} className="text-cta">
                    <Pencil size={15} />
                    修改灵感并重新生成
                  </Link>
                </>
              )}
            </form>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="saved-message" role="status">
              {message}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
