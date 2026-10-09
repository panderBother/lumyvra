"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Menu, X, UserRound, Sparkles } from "lucide-react";
import { useState } from "react";
import { Logo } from "./ui";
import { useUser } from "@/lib/use-api";

const links = [
  ["/", "首页"],
  ["/promo", "创作灵感"],
  ["/create", "创作"],
  ["/community", "作品广场"],
  ["/membership", "会员"],
  ["/help", "帮助"],
];
export function Navigation() {
  const path = usePathname();
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo />
        <nav
          className={open ? "main-nav open" : "main-nav"}
          aria-label="主导航"
        >
          {links.map(([href, label]) => (
            <Link
              href={href}
              key={href}
              className={path === href ? "active" : ""}
              aria-current={path === href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <form action="/community" className="header-search">
            <Search size={16} />
            <input name="q" aria-label="搜索音乐" placeholder="搜索音乐" />
          </form>
          <Link href="/create" className="button small member-button">
            <Sparkles size={14} /> 开启创作
          </Link>
          {user ? <Link href="/profile" className="avatar" aria-label="个人中心">
            <UserRound size={18} />
          </Link> : <div className="nav-auth-actions">
            <Link href="/login" className="nav-login">登录</Link>
            <Link href="/login?mode=register" className="button small nav-register">注册</Link>
          </div>}
          <button
            className="icon-button mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label={open ? "关闭菜单" : "打开菜单"}
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
