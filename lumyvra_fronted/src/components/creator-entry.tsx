"use client";
import Link from "next/link";
import { Creator } from "./creator";
import { useWork } from "@/lib/use-works";
import { inspirations } from "@/lib/inspiration";
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
  const { work, loaded, error } = useWork(draft || remix);
  if ((remix || draft) && !loaded)
    return <p role="status">正在读取账号作品…</p>;
  if ((remix || draft) && error)
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  const source = draft
    ? (work?.status === "draft" ? work : undefined)
    : remix
      ? (work?.status === "published" && work.allowRemix ? work : undefined)
      : inspirations.find((i) => i.id === template);
  if ((remix || draft || template) && !source)
    return (
      <div className="empty-state">
        <p>
          这份草稿或灵感不可用，请确认已登录正确账号，且来源作品开放了做同款。
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
