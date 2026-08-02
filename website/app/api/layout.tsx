import type { Metadata } from "next";

const apiUrl = "https://anrans.github.io/godot_for_minigame/api/";

export const metadata: Metadata = {
  title: "MiniGameSDK API 参考 — Godot Mini Game",
  description:
    "MiniGameSDK 完整 API 参考：220 个公开方法、81 个信号、参数默认值、返回类型、平台兼容性与源码链接。",
  alternates: { canonical: apiUrl },
  openGraph: {
    url: apiUrl,
    title: "MiniGameSDK API 参考",
    description: "可搜索的 Godot 微信与抖音小游戏 SDK 完整接口文档。",
  },
};

export default function ApiLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
