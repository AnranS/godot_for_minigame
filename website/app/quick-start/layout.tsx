import type { Metadata } from "next";
import { releaseData } from "../site-data.generated";

const pageUrl = "https://anrans.github.io/godot_for_minigame/quick-start/";

export const metadata: Metadata = {
  title: `快速开始 - Godot Mini Game v${releaseData.pluginVersion}`,
  description: "从安装插件、添加 Web 导出预设到在微信开发者工具里运行 Godot 游戏的完整步骤，附真实截图；同时说明抖音与 TikTok 的运行方式。",
  alternates: { canonical: pageUrl },
  openGraph: {
    url: pageUrl,
    title: "Godot Mini Game 快速开始",
    description: "10 分钟把 Godot 游戏导出为小游戏并在开发者工具里运行。",
  },
};

export default function QuickStartLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
