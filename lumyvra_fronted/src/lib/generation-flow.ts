import type { WorkMode } from "./works";

type FlowStep = { label: string; icon: "input" | "lyrics" | "music" | "audio" | "save"; stages: string[] };

// Stage positions belong to each workflow, rather than to a shared numeric scale.
export function generationFlow(mode: WorkMode, instrumental = false, demo = false) {
  const words = mode === "words";
  const steps: FlowStep[] = demo ? [
    { label: "任务入队", icon: "input", stages: ["queued", "submitting"] },
    { label: "演示处理", icon: "lyrics", stages: ["planning"] },
    { label: "准备示例", icon: "lyrics", stages: ["loading", "generating"] },
    { label: "保存结果", icon: "save", stages: ["saving"] },
  ] : words ? [
    { label: "保存灵感", icon: "input", stages: ["queued", "submitting"] },
    { label: "创作歌词", icon: "lyrics", stages: ["planning"] },
    { label: "保存歌词", icon: "save", stages: ["saving"] },
  ] : [
    { label: mode === "lyrics" ? "保存原歌词" : "保存灵感", icon: "input", stages: ["queued", "submitting"] },
    { label: mode === "lyrics" || instrumental ? "制定编曲方案" : "创作歌词与方案", icon: "lyrics", stages: ["planning"] },
    { label: "谱曲与生成", icon: "music", stages: ["composing", "loading", "generating"] },
    { label: "音频校验", icon: "audio", stages: ["validating"] },
    { label: "保存歌曲", icon: "save", stages: ["saving"] },
  ];
  const stageLabels: Record<string, string> = {
    queued: "等待处理", submitting: "正在提交任务",
    planning: words ? "创作主歌、副歌与歌词段落" : mode === "lyrics" ? "保留原歌词，制定演唱与编曲方案" : instrumental ? "制定器乐与编曲方案" : "创作歌词与制作方案",
    composing: "规划旋律与编曲", loading: "加载音乐模型",
    generating: instrumental ? "生成器乐与伴奏" : "生成演唱与伴奏",
    validating: "校验音频完整性", saving: words ? "保存歌词版本" : "保存歌曲版本",
    completed: words ? "歌词已完成" : "歌曲已完成",
    cancelling: "正在取消任务", reconnecting: "等待推理服务恢复连接",
  };
  return {
    steps, stageLabels,
    label: words ? "文生歌词" : mode === "lyrics" ? "歌词生音乐" : "文生音乐",
    title: words ? "让灵感，长成歌词。" : mode === "lyrics" ? "让你的文字，唱起来。" : instrumental ? "让灵感，成为旋律。" : "让灵感，成为一首歌。",
    description: words ? "根据主题创作歌词，完成后可编辑，再选择是否谱成歌曲。"
      : mode === "lyrics" ? "保留你写下的歌词，为它谱曲、编曲并生成演唱。"
        : instrumental ? "根据描述规划旋律与编曲，生成纯音乐。" : "从你的描述出发，创作歌词、旋律、演唱与伴奏。",
    phase(stage: string) {
      if (stage === "completed") return steps.length;
      return steps.findIndex(step => step.stages.includes(stage));
    },
  };
}
