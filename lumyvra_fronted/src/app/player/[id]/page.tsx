import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Expand } from "lucide-react";
import { tracks, lyrics, coverUrl } from "@/lib/music";
import { Playback, TrackActions } from "@/components/track-controls";
import { PublishedPlayer } from "@/components/published-player";
export function generateStaticParams() {
  return tracks.map((t) => ({ id: t.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: tracks.find((t) => t.id === id)?.title ?? "作品播放" };
}
export default async function Player({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const track = tracks.find((t) => t.id === id);
  if (!track) return <PublishedPlayer id={id} />;
  return (
    <div className="player-page">
      <div className="player-backdrop">
        <Image
          src={coverUrl(track.cover)}
          alt=""
          fill
          sizes="100vw"
          priority
          quality={90}
        />
      </div>
      <div className="player-overlay" />
      <div className="player-top">
        <Link
          href="/community"
          className="icon-button"
          aria-label="返回作品广场"
        >
          <ArrowLeft />
        </Link>
        <span>正在聆听 · {track.genre}</span>
        <Link href={`/result?id=${id}`} className="icon-button" aria-label="作品信息">
          <Expand size={20} />
        </Link>
      </div>
      <div className="immersive-content">
        <h1>{track.title}</h1>
        <p className="player-artist">{track.artist}</p>
        <div className="immersive-lyrics">
          {id === "summer" ? (
            lyrics.map((l, i) => (
              <p key={l} className={i === 2 ? "current" : ""}>
                {l}
              </p>
            ))
          ) : (
            <>
              <p>{track.title}</p>
              <p className="current">让旋律带你，去往想象中的远方</p>
              <p>纯音乐 · 无歌词</p>
            </>
          )}
        </div>
        <Playback large />
        <TrackActions id={id} />
      </div>
    </div>
  );
}
