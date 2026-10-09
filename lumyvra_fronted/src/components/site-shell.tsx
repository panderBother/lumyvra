"use client";
import { type ReactNode, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Navigation } from "./navigation";
import { api, type User } from "@/lib/api";
import { loginPath } from "@/lib/auth-routing";
import { useUser } from "@/lib/use-api";

export function SiteShell({ children, year }: { children: ReactNode; year: number }) {
  const path = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const auth = path === "/login";
  async function allowHomeAction(event: MouseEvent<HTMLDivElement>) {
    if (path !== "/" || !(event.target instanceof Element)) return;
    const control = event.target.closest("a,button");
    if (!control || control.closest("[data-allow-guest]")) return;
    // Navigation and form submissions are checked by the server proxy. Only local UI buttons need interception.
    if (control instanceof HTMLAnchorElement || control.getAttribute("type") === "submit") return;
    if (control.closest(".motion-control,.particle-motion-toggle,.mobile-menu")) return;
    if (user) return;
    event.preventDefault(); event.stopPropagation();
    try {
      const { user } = await api<{ user: User | null }>("/me");
      if (user) {
        // Re-dispatch once, after fresh session validation, to preserve each component's normal handler.
        control.setAttribute("data-allow-guest", "");
        try { (control as HTMLElement).click(); } finally { control.removeAttribute("data-allow-guest"); }
        return;
      }
    } catch { /* Authentication failures use the same login entry. */ }
    router.push(loginPath("/"));
  }
  return <>
    <div className={`site-frame${auth ? " login-frame" : ""}`} onClickCapture={allowHomeAction}>
      {!auth && <Navigation />}
      <main id="main-content">{children}</main>
    </div>
    {!auth && <footer className="site-footer">
      <span className="footer-brand">Lumyvra <span>让每一份灵感，都有自己的声音。</span></span>
      <div><Link href="/about">关于我们</Link><Link href="/help">帮助中心</Link><span>© {year} Lumyvra</span></div>
    </footer>}
  </>;
}
