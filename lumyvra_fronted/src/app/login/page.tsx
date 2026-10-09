import { Logo } from "@/components/ui";
import { LoginForm } from "@/components/login-form";
import Image from "next/image";
export const metadata = { title: "登录 / 注册" };
export default function LoginPage() {
  return (
    <div className="auth-page">
      <section className="auth-editorial">
        <Image
          src="/assets/hd/promo.webp"
          alt="城市日落中弹吉他的人"
          fill
          sizes="(max-width: 760px) 100vw, 55vw"
          quality={90}
          priority
        />
        <div>
          <p>音乐，让故事有了回响。</p>
          <h2>
            下一首，
            <br />
            写给你自己。
          </h2>
          <span>Lumyvra · 让每一份灵感被听见</span>
        </div>
      </section>
      <div className="auth-form-area">
        <section className="auth-card panel">
          <Logo />
          <h1>欢迎回到你的音乐世界</h1>
          <p>灵感在这里相遇，旋律从这里开始。</p>
          <LoginForm />
        </section>
      </div>
    </div>
  );
}
