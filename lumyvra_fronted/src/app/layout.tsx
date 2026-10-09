import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Navigation } from "@/components/navigation";
import "@fontsource-variable/manrope";
import "@fontsource-variable/noto-sans-sc";
import "./globals.css";
import "./music-landing.css";
import "./studio-theme.css";
import "./campaign.css";
export const metadata: Metadata = {
  title: { default: "Lumyvra · 让灵感成为音乐", template: "%s · Lumyvra" },
  description:
    "用 AI，让每个人都能创作属于自己的音乐。文字生音乐、歌词生音乐，探索你的音乐灵感。",
  applicationName: "Lumyvra",
};
export const viewport: Viewport = { themeColor: "#10110f" };
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <a href="#main-content" className="skip-link">
          跳转到内容
        </a>
        <div className="site-frame">
          <Navigation />
          <main id="main-content">{children}</main>
        </div>
        <footer className="site-footer">
          <span className="footer-brand">
            Lumyvra <span>让每一份灵感，都有自己的声音。</span>
          </span>
          <div>
            <Link href="/about">关于我们</Link>
            <Link href="/help">帮助中心</Link>
            <span>© {new Date().getFullYear()} Lumyvra</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
