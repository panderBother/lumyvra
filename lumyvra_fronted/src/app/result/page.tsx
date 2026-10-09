import Image from "next/image";
import Link from "next/link";
import { Check, Play } from "lucide-react";
import { lyrics, tracks, coverUrl } from "@/lib/music";
import {
  TrackActions,
  LyricsCopy,
  Playback,
} from "@/components/track-controls";
import { SectionHeading, TrackArtwork } from "@/components/ui";
import { LocalWorkDetail } from "@/components/local-work-detail";
export const metadata = { title: "生成结果" };
export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; id?: string }>;
}) {
  const { mode, id } = await searchParams;
  if (typeof id === "string") return <LocalWorkDetail id={id} />;
  const lyricsOnly = mode === "words";
  const modeLabel = lyricsOnly
    ? "文生歌词"
    : mode === "lyrics"
      ? "歌词生音乐"
      : "文生音乐";
  return (
    <div className="container page-space">
      <div className="result-title">
        <h1>{lyricsOnly ? "歌词生成结果" : "生成结果"}</h1>
        <span>
          <Check size={14} /> 演示作品
        </span>
        <Link className="subtle-link" href="/create">
          再创作一首 →
        </Link>
      </div>
      <div className="result-columns">
        <section>
          <div className="result-overview">
            <Link href="/player/summer" className="result-cover">
              <Image
                src={coverUrl(tracks[0].cover)}
                alt="夏日的风封面"
                fill
                sizes="(max-width: 760px) 40vw, (max-width: 1000px) 250px, (max-width: 1570px) 21vw, 330px"
                quality={90}
              />
              <span className="round-play">
                <Play fill="currentColor" />
              </span>
            </Link>
            <div className="result-info">
              <span className="eyebrow">YOUR NEW CREATION</span>
              <h2>夏日的风</h2>
              <div className="small-tags">
                <i>流行</i>
                <i>治愈</i>
              </div>
              <p>Luna · 示例作品</p>
              {lyricsOnly ? (
                <p className="muted">歌词示例 · 可复制后继续谱曲</p>
              ) : (
                <Playback />
              )}
            </div>
          </div>
          {lyricsOnly ? (
            <Link href="/create?mode=lyrics" className="button gradient">
              用歌词创作音乐
            </Link>
          ) : (
            <TrackActions />
          )}
          <div className="panel lyrics-panel">
            <div className="section-heading">
              <h2>歌词</h2>
              <LyricsCopy />
            </div>
            {lyrics.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
          <section className="recommendations">
            <SectionHeading title="相似推荐" href="/community" />
            <div className="track-grid">
              {tracks.slice(1, 5).map((t) => (
                <Link href={`/player/${t.id}`} key={t.id}>
                  <TrackArtwork track={t} />
                  <h3>{t.title}</h3>
                  <span className="muted">
                    {t.artist} · {t.duration}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </section>
        <aside className="result-sidebar">
          <div className="panel">
            <h2>歌词</h2>
            {lyrics.slice(0, 6).map((l) => (
              <p className="muted" key={l}>
                {l}
              </p>
            ))}
          </div>
          <div className="panel">
            <h2>创作信息</h2>
            <dl>
              {[
                ["创作方式", modeLabel],
                ["音乐风格", "流行"],
                ["情绪风格", "治愈、开心"],
                ["歌曲时长", "3分24秒"],
                ["作品类型", "静态演示作品"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
