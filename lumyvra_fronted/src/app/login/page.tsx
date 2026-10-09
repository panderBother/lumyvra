import { Logo } from "@/components/ui";
import { LoginForm } from "@/components/login-form";
import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import { LoginVisual } from "@/components/login-visual";
import { LandingMotionProvider } from "@/components/landing/landing-motion";
import { ParticleVeil } from "@/components/landing/particle-veil";
import { safeReturnPath } from "@/lib/auth-routing";
export const metadata = { title: "登录 / 注册" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <LandingMotionProvider>
    <div className="login-scene">
      <section className="login-cinema" aria-label="音乐创作视觉">
        <LoginVisual />
        <div className="login-cinema-shade" />
        <Link className="login-home" href="/"><ArrowUpLeft size={17} /> 返回首页</Link>
        <div className="login-cinema-copy">
          <p>每一个声音，都有它的形状。</p>
          <h2>
            把心里的回响，
            <br />
            写成你的歌。
          </h2>
          <span>Lumyvra — 为你的第一首，也为下一首。</span>
        </div>
      </section>
      <div className="login-form-side">
        <ParticleVeil variant="stars" />
        <section className="auth-card panel">
          <Logo />
          <h1>让灵感，从这里开始。</h1>
          <p>登录或创建账号，留住每一次创作。</p>
          <LoginForm key={params.mode || "login"} returnTo={safeReturnPath(params.next)} initialRegister={params.mode === "register"} authError={params.error} />
        </section>
      </div>
    </div>
    </LandingMotionProvider>
  );
}
