import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Disclaimer from "@/components/Disclaimer";

export const metadata: Metadata = {
  title: "NurseMate (널스메이트) - 간호학과 AI 학습 & 취업 도우미",
  description:
    "간호학과 학생이 자기 강의록 PDF와 이력서 초안을 넣으면, 국시형 문제·용어 퀴즈·자소서 첨삭·모의면접을 제공하는 생성형 AI 웹앱",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 pb-20 text-slate-900 antialiased">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
        <Disclaimer />
      </body>
    </html>
  );
}
