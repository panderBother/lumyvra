"use client";
import Link from "next/link";
import { useState } from "react";
import { Headphones, Search } from "lucide-react";
import { tracks } from "@/lib/music";
import { TrackArtwork } from "./ui";
import { PublishedWorks } from "./local-library";
import { useWorks } from "@/lib/use-works";
import { FavoriteButton } from "./favorite-button";
import { searchPublishedWorks } from "@/lib/works";

export function MusicGallery({
  community = false,
  initialQuery = "",
}: {
  community?: boolean;
  initialQuery?: string;
}) {
  const [filter, setFilter] = useState("推荐");
  const [tab, setTab] = useState("推荐");
  const [query, setQuery] = useState(initialQuery);
  const { works: favoriteWorks } = useWorks("favorites");
  const liked = favoriteWorks.map(w => w.id);
  const { works, loaded } = useWorks();
  const hasLocalResults =
    community &&
    searchPublishedWorks(tab === "收藏" ? favoriteWorks : works, query).length > 0;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const categories = community
    ? ["推荐", "最新", "最热", "收藏"]
    : ["推荐", "流行", "民谣", "电子", "古风", "轻音乐"];
  const visible = (tab === "收藏" && community ? [] : tracks).filter(
    (t) =>
      (!normalizedQuery ||
        `${t.title}${t.artist}${t.genre}${t.mood}`
          .toLocaleLowerCase()
          .includes(normalizedQuery)) &&
      (community
        ? tab !== "收藏" || liked.includes(t.id)
        : filter === "推荐" || t.genre === filter),
  );
  const ordered =
    community && tab === "最新"
      ? [...visible].reverse()
      : community && tab === "最热"
        ? [...visible].sort((a, b) => parseFloat(b.plays) - parseFloat(a.plays))
        : visible;
  return (
    <>
      <div className="gallery-toolbar">
        <div
          className="pills"
          role="group"
          aria-label={community ? "作品排序" : "音乐风格"}
        >
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => (community ? setTab(c) : setFilter(c))}
              aria-pressed={(community ? tab : filter) === c}
              className={
                (community ? tab : filter) === c ? "pill selected" : "pill"
              }
            >
              {c}
            </button>
          ))}
        </div>
        {community ? (
          <label className="search-field">
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索作品、创作者、风格"
              aria-label="搜索作品"
            />
          </label>
        ) : (
          <Link className="subtle-link" href="/community">
            更多 <span>›</span>
          </Link>
        )}
      </div>
      {community && <PublishedWorks query={query} favorites={tab === "收藏"} />}
      <div className={community ? "track-grid community-grid" : "track-grid"}>
        {ordered.map((t) => (
          <article className="track-card" key={t.id}>
            <Link href={`/player/${t.id}`} aria-label={`查看 ${t.title}`}>
              <TrackArtwork
                track={t}
                variant={community ? "community" : "compact"}
              />
            </Link>
            <div className="track-title-row">
              <Link href={`/player/${t.id}`}>
                <h3>{t.title}</h3>
              </Link>
              {community && <FavoriteButton id={t.id} />}
            </div>
            {community && (
              <p className="track-genre">
                {t.genre} / {t.mood}
              </p>
            )}
            <div className="track-meta">
              {community ? (
                <span className="artist">
                  <span className="mini-avatar">{t.artist[0]}</span>
                  {t.artist}
                </span>
              ) : (
                <span>
                  <Headphones size={12} />
                  {t.plays}
                </span>
              )}
              {community && <span>{t.duration}</span>}
            </div>
          </article>
        ))}
      </div>
      {ordered.length === 0 &&
        !hasLocalResults &&
        (!community || loaded || tab === "收藏") && (
          <div className="empty-state">
            {tab === "收藏"
              ? "点击作品旁的爱心，将喜欢的作品加入这里。"
              : "没有找到相关作品，试试其他关键词或风格。"}
          </div>
        )}
    </>
  );
}
