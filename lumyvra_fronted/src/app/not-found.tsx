import { GradientLink, PageHeading } from "@/components/ui";
export default function NotFound() {
  return (
    <div className="container page-space empty-page">
      <PageHeading
        eyebrow="404"
        title="这段旋律，还没有被发现"
        description="页面不存在，回到首页继续探索吧。"
      />
      <GradientLink href="/">回到首页</GradientLink>
    </div>
  );
}
