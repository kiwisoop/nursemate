"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/study", label: "강의록 문제" },
  { href: "/terms", label: "용어·약어" },
  { href: "/career/resume", label: "자소서 첨삭" },
  { href: "/career/interview", label: "모의 면접" },
  { href: "/my", label: "내 기록" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-sm font-extrabold text-white shadow-sm">
              N+
            </span>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-slate-900">
                NurseMate
              </span>
              <span className="ml-1.5 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                널스메이트
              </span>
            </div>
          </Link>
        </div>

        {/* 모바일 우선 가로 스크롤 탭 내비게이션 */}
        <nav className="-mx-1 flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
                  isActive
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
