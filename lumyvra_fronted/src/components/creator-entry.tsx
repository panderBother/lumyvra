"use client";
import Link from "next/link";
import { Creator } from "./creator";
import { useWorks } from "@/lib/use-works";
import { inspirations } from "@/lib/inspiration";
import { remixableWorks } from "@/lib/works";
export function CreatorEntry({
  mode,
  prompt,
  template,
  remix,
  draft,
  genre,
  mood,
}: {
  mode: string;
  prompt: string;
  template?: string;
  remix?: string;
  draft?: string;
  genre?: string;
  mood?: string;
}) {
  const { works, loaded, error } = useWorks();
  if ((remix || draft) && !loaded)
    return <p role="status">正在读取本地作品…</p>;
  if ((remix || draft) && error)
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  const source = draft
    ? works.find((w) => w.id === draft && w.status === "draft")
    : remix
      ? remixableWorks(works).find((w) => w.id === remix)
      : inspirations.find((i) => i.id === template);
  if ((remix || draft || template) && !source)
    return (
      <div className="empty-state">
        <p>
          这份草稿或灵感不可用，可能尚未开放做同款，或保存在另一个浏览器中。
        </p>
        <Link href="/promo" className="button secondary">
          重新选择灵感
        </Link>
      </div>
    );
  return (
    <Creator
      key={source?.id ?? `${mode}:${prompt}:${genre}:${mood}`}
      initialMode={source?.mode ?? mode}
      initialPrompt={source?.prompt ?? prompt}
      initialGenre={source?.genre ?? genre}
      initialMood={source?.mood ?? mood}
      initialSeconds={source?.seconds}
      initialCover={source?.cover}
      draftId={draft}
      sourceId={draft ? source?.sourceId : source?.id}
      sourceTitle={draft ? source?.sourceTitle : source?.title}
    />
  );
}
