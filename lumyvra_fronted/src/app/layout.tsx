import type { Metadata, Viewport } from "next";
import { SiteShell } from "@/components/site-shell";
import "@fontsource-variable/manrope";
import "@fontsource-variable/noto-sans-sc";
import "./globals.css";
import "./music-landing.css";
import "./studio-theme.css";
import "./campaign.css";
import "./login-scene.css";
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
        <SiteShell year={new Date().getFullYear()}>{children}</SiteShell>
      </body>
    </html>
  );
}
