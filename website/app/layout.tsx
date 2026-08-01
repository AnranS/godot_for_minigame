import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://anrans.github.io/godot_for_minigame/";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Godot Mini Game — 一键导出微信与抖音小游戏",
  description:
    "面向 Godot 4.x 的开源小游戏导出插件。内置真机兼容 WASM 引擎，一键发布到微信小游戏与抖音小游戏。",
  keywords: ["Godot", "微信小游戏", "抖音小游戏", "WeChat Mini Game", "Douyin Mini Game", "Godot plugin"],
  authors: [{ name: "AnranS", url: "https://github.com/AnranS" }],
  alternates: { canonical: siteUrl },
  icons: {
    icon: `${siteUrl}favicon.svg`,
    shortcut: `${siteUrl}favicon.svg`,
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    alternateLocale: "en_US",
    url: siteUrl,
    siteName: "Godot Mini Game",
    title: "Godot Mini Game — 把 Godot 游戏一键发布到微信与抖音",
    description: "真机兼容的 WASM 引擎、平台适配层与 20+ 类原生 API，全部收进一次导出。",
    images: [{ url: `${siteUrl}og.png`, width: 1200, height: 630, alt: "Godot Mini Game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Godot Mini Game",
    description: "One-click export from Godot to WeChat & Douyin mini games.",
    images: [`${siteUrl}og.png`],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
