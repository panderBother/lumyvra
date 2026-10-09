import { GenerationProgress } from "@/components/generation-progress";
export const metadata = { title: "正在生成音乐" };
export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; id?: string }>;
}) {
  const { mode, id } = await searchParams;
  const validMode = mode === "lyrics" || mode === "words" ? mode : "text";
  return (
    <div className="container page-space workspace-page">
      <GenerationProgress
        mode={validMode}
        id={typeof id === "string" ? id : undefined}
      />
    </div>
  );
}
