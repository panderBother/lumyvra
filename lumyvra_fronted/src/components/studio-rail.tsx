import Link from "next/link";
import {
  Music2,
  House,
  Disc3,
  Heart,
  UserRound,
  CircleHelp,
} from "lucide-react";
export function StudioRail() {
  return (
    <aside className="studio-rail" aria-label="工作台导航">
      {[
        { href: "/", icon: House, label: "首页" },
        { href: "/create", icon: Music2, label: "音乐创作" },
        { href: "/community", icon: Disc3, label: "作品广场" },
        { href: "/profile?tab=favorites", icon: Heart, label: "我的收藏" },
        { href: "/profile", icon: UserRound, label: "个人中心" },
        { href: "/help", icon: CircleHelp, label: "帮助" },
      ].map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          aria-label={label}
          title={label}
          className={href === "/create" ? "active" : ""}
        >
          <Icon size={21} />
        </Link>
      ))}
    </aside>
  );
}
