"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, refreshData, type GenerationJob } from "@/lib/api";
import { Check, Music2, AudioLines, FileText, SlidersHorizontal, Sparkles } from "lucide-react";
import { generationFlow } from "@/lib/generation-flow";
import { type WorkMode } from "@/lib/works";
import { GenerationParticles } from "./generation-particles";

const stepIcons = { input: FileText, lyrics: Sparkles, music: Music2, audio: AudioLines, save: SlidersHorizontal };

export function GenerationProgress({ mode = "text", id }: { mode?: string; id?: string }) {
  const router = useRouter();
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [clock, setClock] = useState(() => Date.now());

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
        if (result.job.status === "succeeded") {
          refreshData();
          router.replace(`/result?id=${encodeURIComponent(id)}`);
          return;
        }
        if (result.job.status === "failed" || result.job.status === "cancelled") return;
        timer = setTimeout(poll, 1500);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "读取任务失败，请重新连接。");
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [router, id, retry]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Restored tasks must reflect their saved inputs, even with a stale URL mode.
  const savedMode = job?.input?.mode ?? mode;
  const taskMode: WorkMode = savedMode === "lyrics" || savedMode === "words" ? savedMode : "text";
  const isDemo = job?.provider === "demo";
  const flow = generationFlow(taskMode, job?.input?.genre === "纯音乐", isDemo);
  const stage = job?.status === "cancelling" ? "cancelling" : job?.stage || job?.status || "queued";
  const phase = flow.phase(stage);
  const stageLabel = error ? "任务状态暂时无法读取" : flow.stageLabels[stage] || "正在处理";
  const elapsed = job?.startedAt ? Math.max(0, Math.floor((clock - Date.parse(job.startedAt)) / 1000)) : 0;
  const active = Boolean(job && ["queued", "running", "cancelling"].includes(job.status));
  const terminal = job?.status === "failed" || job?.status === "cancelled";
  const terminalMessage = job?.status === "failed" ? job.errorCode === "ENGINE_UNAVAILABLE"
    ? "音乐生成未完成，任务已停止。请返回创作页重试，草稿和旧版本仍保留。（ENGINE_UNAVAILABLE）"
    : job.error || "生成失败，草稿和旧版本仍保留。"
    : "任务已取消，草稿和旧版本仍保留。";
  return <section className={`generation-stage${terminal ? " is-terminal" : ""}`} data-mode={taskMode}>
    <span className="generation-mode-label">{flow.label}<span aria-hidden="true"> / </span>{terminal ? "已停止" : "创作进行中"}</span>
    <h1>{terminal ? job?.status === "failed" ? "这次生成未完成" : "生成已取消" : flow.title}</h1>
    <p className="generation-description">{terminal ? "任务已停止。草稿和已有版本已保留，可以返回创作页调整并重新生成。" : flow.description}</p>
    {isDemo && <span className="demo-label">演示生成 · 返回示例歌词，不生成真实音频</span>}
    {error && <p className="form-error" role="alert">{error} <Link href="/profile?tab=drafts">返回草稿箱</Link></p>}
    {terminal && <p className="form-error" role="alert">{terminalMessage}</p>}
    {!terminal && <div className="generation-live-status">
      <p role="status"><span className={`generation-status-dot${active && !error ? " is-active" : ""}`} />{job ? stageLabel : error ? stageLabel : "正在读取任务…"}</p>
      {job?.startedAt && <span className="generation-elapsed">已用时 {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>}
    </div>}
    <GenerationParticles words={taskMode === "words"} active={active && !terminal && !error && stage !== "cancelling"} />
    <ol className="generation-steps" style={{ "--step-count": flow.steps.length } as CSSProperties} aria-label={`${flow.label}流程`}>
      {flow.steps.map((step, i) => {
        const complete = isDemo ? (job?.progress || 0) >= (i + 1) * 25 : phase > i;
        const Icon = stepIcons[step.icon];
        return <li key={step.label} className={complete ? "complete" : ""} aria-current={active && !error && !complete && phase === i ? "step" : undefined}>
          <span>{complete ? <Check size={16} /> : <Icon size={16} />}</span><p>{step.label}</p>
        </li>;
      })}
    </ol>
    {!terminal && !error && <div className={isDemo ? "progress-track" : "progress-track is-indeterminate"} role="progressbar" aria-label={`${flow.label}状态`}
      aria-valuenow={isDemo ? job?.progress || 0 : undefined} aria-valuemin={0} aria-valuemax={100}
      aria-valuetext={stageLabel}>
      <i style={{ width: isDemo ? `${job?.progress || 0}%` : "28%" }} />
    </div>}
    {!terminal && <p className="generation-persistence">{job ? "任务已保存，离开页面后仍会继续。新候选不会覆盖旧版本。" : "正在连接任务，已有草稿和版本仍保留。"}</p>}
    {!isDemo && !terminal && <p className="generation-quote">{taskMode === "words" ? "歌词完成后会进入歌词版本页。" : "完整歌曲在本地生成，耗时取决于歌曲时长和本机资源。"}当前显示真实阶段。</p>}
    <div className="generation-actions">
    {active && job && !error && <button className="button secondary" disabled={cancelling || job.status === "cancelling"}
      onClick={async () => {
        setCancelling(true);
        try {
          const result = await api<{ job: GenerationJob }>(`/jobs/${job.id}/cancel`, { method: "POST" });
          setJob(result.job); refreshData();
          if (result.job.status === "succeeded") router.replace(`/result?id=${encodeURIComponent(job.workId)}`);
        } catch (err) { setError(err instanceof Error ? err.message : "取消请求失败，请检查任务状态。"); }
        finally { setCancelling(false); }
      }}>{cancelling || job.status === "cancelling" ? "正在取消…" : "取消任务，保留旧版本"}</button>}
    {error && !terminal && <button className="button secondary" onClick={() => { setError(""); setRetry(value => value + 1); }}>重新读取任务</button>}
    {terminal && id && <Link href={`/create?draft=${encodeURIComponent(id)}`} className="button primary">返回创作并重试</Link>}
    <Link href={id ? "/profile?tab=drafts" : "/create"} className="button secondary">{terminal ? "返回草稿箱" : "暂时离开"}</Link>
    </div>
  </section>;
}
