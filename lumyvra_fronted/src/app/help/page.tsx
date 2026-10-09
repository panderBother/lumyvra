import { PageHeading } from "@/components/ui";
import { HelpContent } from "@/components/help-content";
import Link from "next/link";
import { ArrowUpRight, Headphones } from "lucide-react";
export const metadata = { title: "帮助中心" };
export default function HelpPage() {
  return (
    <div className="container page-space support-page">
      <aside className="support-intro">
        <Headphones size={35} strokeWidth={1} />
        <PageHeading
          title={"创作的路上，\n我们陪着你。"}
          description="帮助中心 / 从第一步开始，解答每一个小疑问。"
        />
        <Link href="/create" className="text-cta">
          回到创作工作台 <ArrowUpRight size={18} />
        </Link>
      </aside>
      <section className="support-questions" aria-label="常见问题">
        <HelpContent />
      </section>
    </div>
  );
}
