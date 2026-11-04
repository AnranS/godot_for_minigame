import type { Metadata } from "next";
import { releaseData } from "../site-data.generated";

const pageUrl = "https://anrans.github.io/godot_for_minigame/guide/";

export const metadata: Metadata = {
  title: `接入指引 - Godot Mini Game v${releaseData.pluginVersion}`,
  description: "Godot 游戏接入微信、抖音与 TikTok 小游戏的完整指引：前期准备、引擎版本、兼容性一览、适配要点、开放能力、构建测试与提审发布。",
  alternates: { canonical: pageUrl },
  openGraph: {
    url: pageUrl,
    title: "Godot Mini Game 接入指引",
    description: "兼容性一览、适配要点与微信、抖音、TikTok 接入流程。",
  },
};

export default function GuideLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
