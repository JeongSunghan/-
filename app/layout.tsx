import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "우리 동네 칼갈이 | KnifeTruck",
  description: "수원 기준 칼갈이 트럭 제보와 지역 알림 흐름을 검증하는 MVP 프로젝트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <a className="skip-link" href="#main-content">
          본문으로 건너뛰기
        </a>
        {children}
      </body>
    </html>
  );
}
