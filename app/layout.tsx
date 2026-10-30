import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "하루 한 장",
  description: "계획과 실행, 돌아보기를 날짜별로 기록하는 다이어리",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
