import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KnifeTruck",
  description: "수원 기준 칼갈이 트럭 제보와 지역 알림 흐름을 검증하는 MVP 프로젝트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
