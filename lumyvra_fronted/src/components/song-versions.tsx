"use client";
import { useState } from "react";
import Link from "next/link";
import { Download, Check } from "lucide-react";
import { useAPI } from "@/lib/use-api";
import { adoptVersion } from "@/lib/server-works";
import { workDuration, type SongVersion, type Work } from "@/lib/works";

export function SongPlayer({ audioUrl, label = "歌曲试听" }: { audioUrl: string; label?: string }) {
  const [error, setError] = useState("");
  return <section className="song-player panel" aria-label={label}>
    <h2>{label}</h2>
    <audio key={audioUrl} controls preload="metadata" src={audioUrl} aria-label={label}
      onError={() => setError("音频暂时无法播放，请检查登录状态或文件是否完整。")}
      onLoadedMetadata={() => setError("")} />
    <a className="button secondary small" href={`${audioUrl}?download=1`} download><Download size={15} /> 下载 WAV</a>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}

export function SongVersions({ work }: { work: Work }) {
  const versions = useAPI<{ versions: SongVersion[]; currentVersionId?: string }>(`/works/${encodeURIComponent(work.id)}/versions`);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = versions.data?.versions || [];
  const selected = list.find(v => v.id === selectedId) || list[0];
  if (versions.error) return <p className="form-error" role="alert">{versions.error}</p>;
  if (!versions.loaded) return <p role="status">正在读取候选版本…</p>;
  if (!selected) return null;
  return <section className="song-versions" aria-label="候选版本">
    <h2>{selected.kind === "lyrics" ? "阅读与选择歌词版本" : "试听与选择版本"}</h2>
    <div className="version-options">
      {list.map((version, index) => <button key={version.id} className={`option ${selected.id === version.id ? "selected" : ""}`}
        aria-pressed={selected.id === version.id} onClick={() => { setSelectedId(version.id); setError(""); }}>
        版本 {list.length - index} · {version.kind === "audio" ? workDuration(Math.round(version.duration)) : "歌词"}
        {work.currentVersionId === version.id && <span> · 已采用</span>}
      </button>)}
    </div>
    {selected.audioUrl && <SongPlayer key={selected.id} audioUrl={selected.audioUrl} label="当前候选试听" />}
    <section className="lyrics-panel panel"><h2>{selected.input.genre === "纯音乐" ? "纯音乐" : "这版歌词"}</h2>
      <p className="preserve-lines">{selected.lyrics || "此版本为纯音乐。"}</p>
      {selected.caption && <details><summary>制作描述</summary><p>{selected.caption}</p></details>}
    </section>
    {work.status === "draft" && <button className="button secondary" disabled={busy || selected.id === work.currentVersionId}
      onClick={async () => {
        setBusy(true); setError("");
        try { await adoptVersion(work.id, selected.id); }
        catch (err) { setError(err instanceof Error ? err.message : "采用失败，旧版本仍保留。"); }
        finally { setBusy(false); }
      }}><Check size={16} />{selected.id === work.currentVersionId ? "当前采用版本" : busy ? "正在采用…" : "采用这版"}</button>}
    {selected.kind === "lyrics" && selected.id === work.currentVersionId && work.status === "draft" && <Link className="button gradient" href={`/create?draft=${encodeURIComponent(work.id)}&mode=lyrics`}>用这版歌词创作歌曲</Link>}
    <p className="muted">{selected.kind === "lyrics" ? "切换查看不会修改已采用的歌词。采用后，可以继续编辑或为它生成歌曲。" : "切换试听不会修改已采用版本。新候选需要你决定是否保留；音频的演唱与听感请完整试听确认。"}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
