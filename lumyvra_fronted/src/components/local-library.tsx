"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, FilePenLine } from "lucide-react";
import { useWorks } from "@/lib/use-works";
import { modes, searchPublishedWorks, workDuration } from "@/lib/works";
import { coverUrl } from "@/lib/music";
export function LocalLibrary({ tab }: { tab: string }) {
  const { works, loaded, error } = useWorks();
  const [filter, setFilter] = useState("全部");
  const list = works.filter(
    (w) =>
      (tab === "history" ||
        w.status === (tab === "drafts" ? "draft" : "published")) &&
      (filter === "全部" || modes[w.mode] === filter),
  );
  return (
    <>
      <p className="library-local-note">
        {tab === "drafts"
          ? "这里的作品尚未发布。继续创作，或打开已完成的草稿进行发布。"
          : tab === "history"
            ? "每一次创作，都保存在这里。"
            : "已发布的作品会显示在本地作品广场。"}{" "}
        当前作品仅保存在此浏览器。
      </p>
      <div className="pills">
        {["全部", ...Object.values(modes)].map((m) => (
          <button
            key={m}
            className={`pill ${filter === m ? "selected" : ""}`}
            aria-pressed={filter === m}
            onClick={() => setFilter(m)}
          >
            {m}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : !loaded ? (
        <p role="status">正在读取作品…</p>
      ) : !list.length ? (
        <div className="empty-state">
          <FilePenLine size={28} />
          <p>
            {tab === "drafts" ? "还没有未发布的草稿" : "这里还没有相关作品"}
          </p>
          <Link
            className="button gradient"
            href={tab === "works" ? "/profile?tab=drafts" : "/create"}
          >
            {tab === "works" ? "从草稿发布作品" : "开始一次创作"}
          </Link>
        </div>
      ) : (
        <div className="local-work-list">
          {list.map((w) => (
            <article className="local-work-row" key={w.id}>
              <Link href={`/result?id=${w.id}`}>
                <Image
                  src={coverUrl(w.cover)}
                  alt={w.title}
                  width={72}
                  height={72}
                />
              </Link>
              <div className="local-work-name">
                <Link href={`/result?id=${w.id}`}>
                  <h3>{w.title}</h3>
                </Link>
                <p>
                  {modes[w.mode]} · {w.genre} · {workDuration(w.seconds)}
                </p>
              </div>
              <span
                className={`work-status ${w.status === "published" ? "is-published" : ""}`}
              >
                {w.status === "published"
                  ? "已发布"
                  : w.ready
                    ? "未发布草稿"
                    : "待生成草稿"}
              </span>
              <time dateTime={w.updatedAt}>
                {new Date(w.updatedAt).toLocaleDateString("zh-CN")}
              </time>
              <Link
                className="button secondary small"
                href={w.ready ? `/result?id=${w.id}` : `/create?draft=${w.id}`}
              >
                {w.status === "published"
                  ? "查看作品"
                  : w.ready
                    ? "查看 / 发布"
                    : "继续创作"}
                <ArrowUpRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
export function PublishedWorks({ query = "" }: { query?: string }) {
  const { works } = useWorks();
  const list = searchPublishedWorks(works, query);
  if (!list.length) return null;
  return (
    <section className="local-published">
      <div className="section-heading">
        <h2>新发布 · 本地演示</h2>
        <Link className="subtle-link" href="/profile">
          管理我的作品
        </Link>
      </div>
      <div className="inspiration-grid">
        {list.map((w) => (
          <article key={w.id} className="inspiration-card">
            <Link href={`/result?id=${w.id}`} className="inspiration-art">
              <Image
                src={coverUrl(w.cover)}
                alt={w.title}
                fill
                sizes="(max-width:760px) 90vw, 30vw"
              />
            </Link>
            <h3>{w.title}</h3>
            <p className="inspiration-description">
              {w.description || `${w.genre} / ${w.mood}`}
            </p>
            <div className="inspiration-card-footer">
              <Link href={`/result?id=${w.id}`} className="subtle-link">
                查看作品
              </Link>
              {w.allowRemix && (
                <Link
                  href={`/create?remix=${w.id}`}
                  className="button secondary small"
                >
                  做同款 <ArrowUpRight size={14} />
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
