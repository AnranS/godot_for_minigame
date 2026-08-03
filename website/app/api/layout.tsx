import type { Metadata } from "next";
import { apiMethods, apiSignals } from "./api-data.generated";
import { releaseData } from "../site-data.generated";

const apiUrl = "https://anrans.github.io/godot_for_minigame/api/";

export const metadata: Metadata = {
  title: `MiniGameSDK v${releaseData.pluginVersion} API 参考 — Godot Mini Game`,
  description: `MiniGameSDK v${releaseData.pluginVersion} 完整 API 参考：${apiMethods.length} 个公开方法、${apiSignals.length} 个信号、参数默认值、返回类型、平台兼容性与源码链接。`,
  alternates: { canonical: apiUrl },
  openGraph: {
    url: apiUrl,
    title: "MiniGameSDK API 参考",
    description: "可搜索的 Godot 微信、抖音与 TikTok SDK 接口文档；按宿主能力门控，不承诺全部接口跨平台兼容。",
  },
};

export default function ApiLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
