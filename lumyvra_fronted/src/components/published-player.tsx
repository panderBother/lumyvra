"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Expand, Minimize, Download, Share2, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat2, ListMusic } from "lucide-react";
import { useWork, useWorks } from "@/lib/use-works";
import { coverUrl } from "@/lib/music";
import { workDuration, type Work } from "@/lib/works";
import { FavoriteButton } from "./favorite-button";

export function PublishedPlayer({ id }: { id: string }) {
  const { work, loaded, error } = useWork(id);
  if (!loaded) return <div className="container page-space" role="status">正在读取歌曲…</div>;
  if (error || !work || work.status !== "published" || !work.ready) return <div className="container page-space empty-state">
    <h1>暂时无法打开这份作品</h1>
    <p>{error || "作品尚未发布，请先完成创作并发布。"}</p>
    <Link className="button secondary" href="/community">返回作品广场</Link>
  </div>;
  return <PublishedWorkPlayer key={work.id} work={work} />;
}

export function PublishedWorkPlayer({ work }: { work: Work }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState("");
  const [showList, setShowList] = useState(false);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const { works } = useWorks();
  const playlist = works.filter(item => item.status === "published" && item.ready && item.audioUrl);
  const index = playlist.findIndex(item => item.id === work.id);
  const previous = index > 0 ? playlist[index - 1] : undefined;
  const next = index >= 0 ? playlist[index + 1] : undefined;
  const lines = work.lyrics.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const words = work.mode === "words" && !work.audioUrl;

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === rootRef.current) await document.exitFullscreen();
      else if (rootRef.current?.requestFullscreen) await rootRef.current.requestFullscreen();
      else setMessage("浏览器暂不支持全屏，可以直接在当前页面播放。");
    } catch { setMessage("暂时无法进入全屏，可以继续在当前页面播放。"); }
  }
  async function share() {
    const url = new URL(`/player/${encodeURIComponent(work.id)}`, window.location.origin).href;
    try { await navigator.clipboard.writeText(url); setMessage("作品播放链接已复制"); }
    catch { setMessage(`作品播放链接：${url}`); }
  }

  return <div ref={rootRef} className="player-page published-player" data-work-id={work.id}>
    <div className="player-backdrop"><Image src={coverUrl(work.cover)} alt="" fill sizes="100vw" priority quality={90} /></div>
    <div className="player-overlay" />
    <div className="player-top">
      <Link href="/community" className="icon-button" aria-label="返回作品广场"><ArrowLeft /></Link>
      <span>{words ? "正在阅读" : "作品播放"} · {work.genre}</span>
      <button type="button" className="icon-button" onClick={toggleFullscreen} aria-label={fullscreen ? "退出全屏" : "全屏播放"}>
        {fullscreen ? <Minimize size={20} /> : <Expand size={20} />}
      </button>
    </div>
    <div className="immersive-content">
      <h1>{work.title}</h1>
      <p className="player-artist">{work.artist || "音乐人"}</p>
      <div className="published-lyrics" aria-label="作品歌词" tabIndex={0}>
        {lines.length ? lines.map((line, i) => /^\[[^\]]+\]$/.test(line)
          ? <p className="lyric-section" key={i}>{line}</p>
          : <p key={i}><button type="button" className={selectedLine === i ? "is-selected" : ""}
            aria-pressed={selectedLine === i} onClick={() => setSelectedLine(i)}>{line}</button></p>)
          : <p className="lyrics-empty">{work.genre === "纯音乐" ? "纯音乐 · 让旋律陪伴此刻" : "此作品尚未提供歌词"}</p>}
      </div>
      {lines.length > 0 && <p className="lyric-reading-note">滚动阅读歌词 · 点击标记喜欢的一句</p>}
      {work.audioUrl ? <AudioPlayback key={work.audioUrl} src={work.audioUrl} title={work.title} previous={previous} next={next}
        showList={showList} onToggleList={() => setShowList(value => !value)} />
        : <p className="player-unavailable" role="status">{words ? "歌词作品 · 暂无音频" : "这份作品暂未提供可播放的音频"}</p>}
      {showList && <nav className="published-playlist" aria-label="播放列表" id="published-playlist">
        <h2>广场歌曲</h2>
        {playlist.length ? playlist.map(item => <Link key={item.id} href={`/player/${encodeURIComponent(item.id)}`}
          aria-current={item.id === work.id ? "page" : undefined}><span>{item.title}</span><small>{item.artist || "音乐人"}</small></Link>)
          : <p>暂无其他可播放歌曲。</p>}
      </nav>}
      <div className="track-actions">
        {work.audioUrl && <a className="button secondary" href={`${work.audioUrl}${work.audioUrl.includes("?") ? "&" : "?"}download=1`} download><Download size={17} />下载</a>}
        <FavoriteButton id={work.id} />
        <button type="button" className="button secondary" onClick={share}><Share2 size={17} />分享</button>
      </div>
      <p className="action-message" role="status">{message}</p>
      {work.description && <p className="published-song-description">{work.description}</p>}
    </div>
  </div>;
}

function AudioPlayback({ src, title, previous, next, showList, onToggleList }: {
  src: string; title: string; previous?: Work; next?: Work; showList: boolean; onToggleList: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const audio = audioRef.current;
    return () => { audio?.pause(); };
  }, []);
  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); return; }
    try {
      setError("");
      if (audio.error) audio.load();
      await audio.play();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("音频暂时无法播放，请重新点击播放，或检查文件与网络。");
      setWaiting(false);
    }
  }
  const time = (value: number) => workDuration(Math.floor(Math.max(0, value)));
  return <div className="playback large published-playback">
    <audio ref={audioRef} src={src} preload="metadata" aria-label={`${title}音频`} loop={repeat}
      onLoadedMetadata={event => {
        const seconds = event.currentTarget.duration;
        setDuration(Number.isFinite(seconds) && seconds > 0 ? seconds : 0);
        setError("");
      }}
      onDurationChange={event => {
        const seconds = event.currentTarget.duration;
        if (Number.isFinite(seconds) && seconds > 0) setDuration(seconds);
      }}
      onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
      onWaiting={() => setWaiting(true)} onPlaying={() => setWaiting(false)} onCanPlay={() => setWaiting(false)}
      onVolumeChange={event => setMuted(event.currentTarget.muted)}
      onError={() => { setPlaying(false); setWaiting(false); setError("音频无法加载，请检查文件是否完整或稍后重试。"); }} />
    <div className="seek-row">
      <input type="range" min={0} max={duration || 1} step={.1} value={Math.min(position, duration || 0)} disabled={!duration}
        aria-label="播放进度" aria-valuetext={`${time(position)} / ${duration ? time(duration) : "正在读取时长"}`}
        onChange={event => {
          const audio = audioRef.current;
          if (!audio || !duration) return;
          try { audio.currentTime = Math.min(duration, Math.max(0, Number(event.target.value))); setPosition(audio.currentTime); }
          catch { setError("当前音频暂时无法跳转，请稍后重试。"); }
        }} />
      <span>{time(position)} / {duration ? time(duration) : "--:--"}</span>
    </div>
    <div className="playback-controls">
      <button type="button" className="icon-button" aria-label={muted ? "取消静音" : "静音"} aria-pressed={muted}
        onClick={() => { if (audioRef.current) audioRef.current.muted = !audioRef.current.muted; }}>
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      {previous ? <Link href={`/player/${encodeURIComponent(previous.id)}`} className="icon-button" aria-label="上一首"><SkipBack size={21} /></Link>
        : <button className="icon-button" type="button" disabled aria-label="上一首"><SkipBack size={21} /></button>}
      <button type="button" className="round-play" onClick={togglePlay} aria-label={playing ? "暂停歌曲" : "播放歌曲"}>
        {playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
      </button>
      {next ? <Link href={`/player/${encodeURIComponent(next.id)}`} className="icon-button" aria-label="下一首"><SkipForward size={21} /></Link>
        : <button className="icon-button" type="button" disabled aria-label="下一首"><SkipForward size={21} /></button>}
      <button type="button" className={`icon-button${repeat ? " liked" : ""}`} aria-label="单曲循环" aria-pressed={repeat} onClick={() => setRepeat(value => !value)}><Repeat2 size={19} /></button>
      <button type="button" className="icon-button" aria-label="播放列表" aria-expanded={showList} aria-controls="published-playlist" onClick={onToggleList}><ListMusic size={19} /></button>
    </div>
    {waiting && <p className="preview-note" role="status">正在缓冲音频…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
