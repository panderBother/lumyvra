import { Disc3 } from "lucide-react";
import { MembershipPlans } from "@/components/membership";
export const metadata = { title: "会员订阅" };
export default function MembershipPage() {
  return (
    <div className="container page-space membership-page">
      <section className="membership-intro">
        <div>
          <span className="eyebrow">会员订阅</span>
          <h1>
            给你的灵感，
            <br />
            <span>更多发挥的空间。</span>
          </h1>
          <p>从第一首歌到持续创作，找到适合自己的节奏。</p>
        </div>
        <div className="membership-record" aria-hidden="true">
          <Disc3 strokeWidth={0.5} />
        </div>
      </section>
      <MembershipPlans />
      <div className="membership-bottom">
        <h2>每一段旋律，都始于一个灵感。</h2>
        <p>从免费创作开始，探索属于你的音乐世界。</p>
      </div>
    </div>
  );
}
