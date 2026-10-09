"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Share2,
  Download,
  Copy,
  Check,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat2,
  ListMusic,
} from "lucide-react";
import { lyrics } from "@/lib/music";
import { FavoriteButton } from "./favorite-button";
export function TrackActions({ id = "summer" }: { id?: string }) {
  const [message, setMessage] = useState("");
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("作品链接已复制");
    } catch {
      setMessage("请复制浏览器地址栏中的作品链接");
    }
  }
  return (
    <>
      <div className="track-actions">
        <button
          className="button gradient"
          onClick={() => setMessage("当前是静态原型，尚无可下载的音频文件。")}
        >
          <Download size={17} /> 下载
        </button>
        <FavoriteButton id={id} />
        <button className="button secondary" onClick={share}>
          <Share2 size={17} /> 分享
        </button>
      </div>
      <p className="action-message" role="status">
        {message}
      </p>
    </>
  );
}
export function LyricsCopy() {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <button
        className="button small secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(lyrics.join("\n"));
            setCopied(true);
            setFailed(false);
          } catch {
            setFailed(true);
          }
        }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}{" "}
        {copied ? "已复制" : "复制歌词"}
      </button>
      {failed && <span role="status">复制失败，请手动选择歌词复制。</span>}
    </>
  );
}
export function Playback({ large = false }: { large?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(37);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeat] = useState(false);
  return (
    <div className={large ? "playback large" : "playback"}>
      {!large && (
        <div className="waveform">
          {Array.from({ length: 55 }, (_, i) => (
            <i
              key={i}
              style={{ height: `${5 + Math.abs(Math.sin(i * 1.9)) * 27}px` }}
            />
          ))}
        </div>
      )}
      <div className="seek-row">
        <input
          type="range"
          min={0}
          max={204}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          aria-label="播放进度"
        />
        <span>
          {Math.floor(position / 60)
            .toString()
            .padStart(2, "0")}
          :{(position % 60).toString().padStart(2, "0")} / 03:24
        </span>
      </div>
      <div className="playback-controls">
        <button
          className="icon-button"
          onClick={() => setMuted(!muted)}
          aria-label={muted ? "取消静音" : "静音"}
          aria-pressed={muted}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <Link className="icon-button" href="/player/rain" aria-label="上一首">
          <SkipBack size={21} fill="currentColor" />
        </Link>
        <button
          className="round-play"
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? "暂停演示" : "播放演示"}
        >
          {playing ? (
            <Pause size={24} fill="currentColor" />
          ) : (
            <Play size={24} fill="currentColor" />
          )}
        </button>
        <Link className="icon-button" href="/player/city" aria-label="下一首">
          <SkipForward size={21} fill="currentColor" />
        </Link>
        <button
          className={`icon-button ${repeat ? "liked" : ""}`}
          onClick={() => setRepeat(!repeat)}
          aria-label="循环播放"
          aria-pressed={repeat}
        >
          <Repeat2 size={19} />
        </button>
        <Link href="/community" className="icon-button" aria-label="播放列表">
          <ListMusic size={19} />
        </Link>
      </div>
      <p className="preview-note" role="status">
        {playing ? "播放界面演示中 · 未接入音频" : "静态试听界面 · 暂无音频"}
      </p>
    </div>
  );
}
