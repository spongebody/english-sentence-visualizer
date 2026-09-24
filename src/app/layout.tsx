import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "句子研读 · 英语句子成分",
  description: "先看清主干，再读懂长句。",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
