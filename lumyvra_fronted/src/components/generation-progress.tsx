"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, refreshData, type GenerationJob } from "@/lib/api";
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
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [cancelled, setCancelled] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        if (!id) throw new Error("缺少作品编号，请从草稿箱重新开始。");
        const result = await api<{ job: GenerationJob | null }>(`/works/${encodeURIComponent(id)}/job`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!result.job) throw new Error("这份草稿还没有生成任务，请返回创作页开始生成。");
        setJob(result.job);
        setProgress(result.job.progress);
        if (result.job.status === "succeeded") {
          refreshData();
          router.replace(`/result?id=${encodeURIComponent(id)}`);
          return;
        }
        if (result.job.status === "failed" || result.job.status === "cancelled") {
          throw new Error(result.job.error || "生成已取消，草稿已保留，可重新创作。");
        }
        timer = setTimeout(poll, 800);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "读取任务失败，请刷新重试。");
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [router, id, cancelled]);
  return (
    <section className="generation-stage">
      <h1>{mode === "words" ? "正在编写你的歌词…" : "正在生成你的音乐…"}</h1>
      <p>服务器正在处理你的创作任务，离开页面后仍会继续。</p>
      <span className="demo-label">演示生成 · 返回示例歌词，不生成真实音频</span>
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
      {job && !error && <p role="status">{job.status === "queued" ? "等待处理" : "正在处理"} · {job.progress}%</p>}
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
          { label: "任务入队", icon: FileText },
          { label: "演示处理", icon: Music2 },
          { label: "准备示例", icon: AudioLines },
          { label: "保存结果", icon: SlidersHorizontal },
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
      {job && !error && <button className="button secondary" onClick={async () => {
        try {
          const result = await api<{ job: GenerationJob }>(`/jobs/${job.id}/cancel`, { method: "POST" });
          refreshData();
          if (result.job.status === "succeeded") router.replace(`/result?id=${encodeURIComponent(job.workId)}`);
          else { setCancelled(true); setError("任务已取消，草稿已保留。"); }
        }
        catch (err) { setError(err instanceof Error ? err.message : "取消失败"); }
      }}>取消任务，保留草稿</button>}
      <Link
        href={id ? "/profile?tab=drafts" : "/create"}
        className="button secondary"
      >
        {id ? "暂时离开，保留草稿" : "取消生成"}
      </Link>
    </section>
  );
}
