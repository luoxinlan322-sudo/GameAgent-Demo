import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "游戏方案生成与评估",
  description: "游戏方案生成与评估",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
