"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { completeDraft } from "@/lib/works";
import {
  Check,
  Music2,
  AudioLines,
  FileText,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
export function GenerationProgress({
  mode = "text",
  id,
}: {
  mode?: string;
  id?: string;
}) {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    let value = 0;
    const timer = setInterval(() => {
      value = Math.min(100, value + 2);
      setProgress(value);
      if (value === 100) {
        clearInterval(timer);
        try {
          if (id) completeDraft(id);
          router.replace(
            id
              ? `/result?id=${encodeURIComponent(id)}`
              : `/result?mode=${mode}`,
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "无法保存生成结果，请回到草稿重试。",
          );
        }
      }
    }, 160);
    return () => clearInterval(timer);
  }, [router, mode, id]);
  return (
    <section className="generation-stage">
      <h1>{mode === "words" ? "正在编写你的歌词…" : "正在生成你的音乐…"}</h1>
      <p>AI 正在理解你的灵感，编织专属旋律</p>
      <span className="demo-label">演示流程 · 不调用真实生成服务</span>
      {id && (
        <p className="muted">
          草稿已保存。生成完成后，你可以预览并决定是否发布。
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error} <Link href="/profile?tab=drafts">返回草稿箱</Link>
        </p>
      )}
      <div className="music-universe">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="orbit orbit-three" />
        <div className="orb-core">
          <Music2 size={60} />
        </div>
        {Array.from({ length: 36 }, (_, i) => (
          <i
            key={i}
            className="particle"
            style={{ "--i": i } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="generation-steps">
        {[
          { label: "理解内容", icon: FileText },
          { label: "生成歌词", icon: Music2 },
          { label: "编曲创作", icon: AudioLines },
          { label: "混音优化", icon: SlidersHorizontal },
        ].map(({ label, icon: Icon }, i) => (
          <div key={label} className={progress >= i * 25 ? "complete" : ""}>
            <span>
              {progress >= (i + 1) * 25 ? (
                <Check size={16} />
              ) : (
                <Icon size={16} />
              )}
            </span>
            <p>{label}</p>
          </div>
        ))}
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="音乐生成进度"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${progress}%` }} />
      </div>
      <p className="generation-quote">
        <Sparkles size={16} /> 夏天的海风吹过耳畔，带着星星的晚安…
      </p>
      <div className="waveform animated">
        {Array.from({ length: 65 }, (_, i) => (
          <i
            key={i}
            style={{
              height: `${10 + Math.abs(Math.sin(i * 1.7)) * 40}px`,
              animationDelay: `${i * 35}ms`,
            }}
          />
        ))}
      </div>
      <Link
        href={id ? "/profile?tab=drafts" : "/create"}
        className="button secondary"
      >
        {id ? "暂时离开，保留草稿" : "取消生成"}
      </Link>
    </section>
  );
}
