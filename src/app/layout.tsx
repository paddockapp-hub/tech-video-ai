import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShortsMaking - 시네마틱 3D 쇼츠 제작",
  description:
    "주제별 3D 장면과 시네마틱 카메라로 교육·공학 쇼츠를 제작하는 플랫폼",
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
