import Link from "next/link";
import Image from "next/image";
import {
  AudioLines,
  ArrowUpRight,
  Music2,
  Mic2,
  NotebookPen,
  Headphones,
  Play,
  ChevronRight,
} from "lucide-react";
import type { ReactNode } from "react";
import { coverUrl, type Track } from "@/lib/music";

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Lumyvra 首页">
      <AudioLines aria-hidden="true" />
      <span>
        Lumy<span className="logo-light">vra</span>
      </span>
    </Link>
  );
}
export function GradientLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link className={`button gradient ${className}`} href={href}>
      {children}
    </Link>
  );
}
export function SectionHeading({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle?: string;
  href?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {href && (
        <Link className="subtle-link" href={href}>
          更多 <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}
const features = [
  {
    icon: Music2,
    title: "文生音乐",
    description: "用文字描绘你的旋律",
    mode: "text",
    color: "violet",
  },
  {
    icon: Mic2,
    title: "歌词生音乐",
    description: "输入歌词，生成完整歌曲",
    mode: "lyrics",
    color: "pink",
  },
  {
    icon: NotebookPen,
    title: "文生歌词",
    description: "用文字，写出你的灵感",
    mode: "words",
    color: "blue",
  },
  {
    icon: Headphones,
    title: "多风格支持",
    description: "流行、R&B、电子、古风…",
    mode: "text",
    color: "coral",
  },
];
export function FeatureCards() {
  return (
    <div className="feature-grid">
      {features.map(({ icon: Icon, title, description, mode, color }) => (
        <Link
          href={`/create?mode=${mode}`}
          className={`feature-card ${color}`}
          key={title}
        >
          <div className="feature-top">
            <span className="feature-icon">
              <Icon size={24} />
            </span>
            <ArrowUpRight size={17} className="feature-arrow" />
          </div>
          <h3>{title}</h3>
          <p>{description}</p>
        </Link>
      ))}
    </div>
  );
}
export function TrackArtwork({
  track,
  priority = false,
  variant = "compact",
}: {
  track: Track;
  priority?: boolean;
  variant?: "compact" | "community";
}) {
  return (
    <div className="track-art">
      <Image
        src={coverUrl(track.cover)}
        alt={`${track.title}的梦幻风景封面`}
        fill
        sizes={
          variant === "community"
            ? "(max-width: 760px) 46vw, 31vw"
            : "(max-width: 760px) 44vw, (max-width: 1000px) 29vw, 22vw"
        }
        quality={90}
        priority={priority}
      />
      <span className="art-play">
        <Play size={18} fill="currentColor" />
      </span>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="page-heading">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
}
