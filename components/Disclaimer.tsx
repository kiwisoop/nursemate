import React from "react";

/**
 * 모든 화면 하단 고정 안내문 컴포넌트 (개발 지시서 3장, 6장, 9장 준수)
 */
export default function Disclaimer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-teal-200 bg-teal-50/95 px-4 py-2.5 text-center text-xs font-medium text-teal-900 shadow-sm backdrop-blur print:static print:border-t print:bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-2">
        <span className="inline-block rounded bg-teal-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
          안내
        </span>
        <span>
          본 서비스는 학습 보조용입니다. 의료 내용은 반드시 교재와 교수님 자료로 최종 확인하세요.
        </span>
      </div>
    </footer>
  );
}
