import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShortsMaking - 공학 쇼츠 제작 플랫폼",
  description:
    "Codex + Google Flow 워크플로우 기반 교육용 쇼츠 자동 제작 플랫폼",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
