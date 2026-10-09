"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Search, Sparkles } from "lucide-react";
import { inspirations, remixHref, workInspiration } from "@/lib/inspiration";
import { remixableWorks } from "@/lib/works";
import { useWorks } from "@/lib/use-works";
import { coverUrl } from "@/lib/music";
export function InspirationGallery({ compact = false }: { compact?: boolean }) {
  const { works, error } = useWorks();
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const items = [
    ...remixableWorks(works).map(workInspiration),
    ...inspirations,
  ];
  const visible = items.filter(
    (i) =>
      (category === "全部" ||
        (category === "情感"
          ? ["治愈", "浪漫"].includes(i.mood)
          : `${i.genre}${i.mood}`.includes(category))) &&
      `${i.title}${i.prompt}${i.genre}${i.mood}`.includes(query.trim()),
  );
  return (
    <>
      {compact && (
        <h2>
          <Sparkles size={18} /> 创作灵感
        </h2>
      )}
      <div className={compact ? "pills" : "inspiration-toolbar"}>
        <div className="pills" aria-label="灵感分类">
          {(compact
            ? ["全部", "治愈", "情感"]
            : ["全部", "治愈", "浪漫", "电子", "民谣", "轻音乐", "古风"]
          ).map((c) => (
            <button
              key={c}
              className={`pill ${category === c ? "selected" : ""}`}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        {!compact && (
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="搜索灵感"
              placeholder="搜索场景、风格或一句灵感"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {compact ? (
        visible.slice(0, 6).map((i) => (
          <Link className="inspiration-item" href={remixHref(i)} key={i.id}>
            <Image src={coverUrl(i.cover)} alt="" width={65} height={65} />
            <span>
              <strong>{i.title}</strong>
              <span className="small-tags">
                <i>{i.genre}</i>
                <i>{i.mood}</i>
              </span>
            </span>
            <ArrowUpRight size={15} />
          </Link>
        ))
      ) : (
        <div className="inspiration-grid">
          {visible.map((i) => (
            <article className="inspiration-card" key={i.id}>
              <Link
                className="inspiration-art"
                href={i.local ? `/result?id=${i.id}` : `/player/${i.id}`}
                aria-label={`查看${i.title}`}
              >
                <Image
                  src={coverUrl(i.cover)}
                  alt={i.title}
                  fill
                  quality={90}
                  sizes="(max-width: 760px) 90vw, (max-width: 1100px) 45vw, 30vw"
                />
              </Link>
              <div className="inspiration-card-heading">
                <h2>{i.title}</h2>
                <span>{i.local ? "社区灵感 · 本地" : "精选示例"}</span>
              </div>
              <p className="inspiration-description">{i.description}</p>
              <div className="small-tags">
                <i>{i.genre}</i>
                <i>{i.mood}</i>
              </div>
              <details className="inspiration-prompt">
                <summary>看看这首歌的创作灵感</summary>
                <p>{i.prompt}</p>
              </details>
              <div className="inspiration-card-footer">
                <span>{i.artist}</span>
                <Link className="button secondary small" href={remixHref(i)}>
                  做同款 <ArrowUpRight size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
      {!visible.length && (
        <p className="empty-state">没有找到相关灵感，试试其他关键词。</p>
      )}
      {compact && (
        <Link className="text-cta" href="/promo">
          浏览全部灵感 <ArrowUpRight size={16} />
        </Link>
      )}
    </>
  );
}
