import type { Metadata } from "next";
import { PageHeading } from "@/components/ui";
import { MusicGallery } from "@/components/music-gallery";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export const metadata: Metadata = { title: "作品广场" };
export default async function Community({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <div className="container page-space community-page">
      <div className="collection-heading">
        <PageHeading
          title="听见另一种可能。"
          description="作品广场 / 在不同的故事里，找到与你同频的声音。"
        />
        <Link href="/create" className="button gradient">
          带着灵感去创作 <ArrowUpRight size={17} />
        </Link>
      </div>
      <MusicGallery community initialQuery={q} key={q} />
      <section className="hot-tags">
        <h3>热门标签</h3>
        {["夏天", "治愈", "星空", "城市", "电子", "民谣", "学习", "R&B"].map(
          (t) => (
            <Link
              className="pill"
              href={`/community?q=${encodeURIComponent(t)}`}
              key={t}
            >
              # {t}
            </Link>
          ),
        )}
      </section>
    </div>
  );
}
