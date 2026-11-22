"use client";

import React from "react";

interface DiffViewProps {
  originalDraft: string;
  revisedText: string;
  improvementPoints: string[];
  competencyKeywords: string[];
  followUpQuestions: string[];
}

/**
 * 자기소개서 수정 전/후 나란히 비교 컴포넌트 (개발 지시서 4-D, 6-5 준수)
 */
export default function DiffView({
  originalDraft,
  revisedText,
  improvementPoints,
  competencyKeywords,
  followUpQuestions,
}: DiffViewProps) {
  return (
    <div className="space-y-6">
      {/* 6-5. 자소서 윤리 필수 안내문 */}
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900 shadow-sm">
        ⚠️ AI는 표현만 다듬었습니다. 사실과 다른 부분이 없는지 꼭 확인하세요. (초안에 없는 경험·수치·자격은 추가하지 않습니다)
      </div>

      {/* 수정 전 / 수정 후 나란히 비교 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
              수정 전 (본인 초안)
            </span>
            <span className="text-xs text-slate-500">{originalDraft.length}자</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {originalDraft}
          </p>
        </div>

        <div className="rounded-2xl border-2 border-teal-500 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-full bg-teal-600 px-3 py-1 text-xs font-bold text-white">
              수정 후 (간호 직무역량 중심 다듬기)
            </span>
            <span className="text-xs font-semibold text-teal-700">{revisedText.length}자</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
            {revisedText}
          </p>
        </div>
      </div>

      {/* 드러난 간호 직무역량 키워드 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-bold text-slate-900">
          🏷️ 드러난 간호 직무역량 키워드
        </h3>
        <div className="flex flex-wrap gap-2">
          {competencyKeywords.map((kw, i) => (
            <span
              key={i}
              className="rounded-full bg-teal-50 px-3.5 py-1.5 text-xs font-bold text-teal-800 ring-1 ring-teal-200"
            >
              #{kw}
            </span>
          ))}
        </div>
      </div>

      {/* 보완 포인트 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-bold text-slate-900">✨ 주요 보완 포인트</h3>
        <ul className="list-inside list-disc space-y-2 text-sm text-slate-700">
          {improvementPoints.map((pt, i) => (
            <li key={i} className="leading-relaxed">
              {pt}
            </li>
          ))}
        </ul>
      </div>

      {/* 추가로 채워야 할 정보 질문 목록 */}
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
        <h3 className="mb-2 text-sm font-bold text-indigo-950">
          ❓ 자소서 완성도를 높이기 위해 추가로 채워야 할 질문 목록
        </h3>
        <p className="mb-3 text-xs text-indigo-700">
          AI가 임의로 지어내지 않고 비워둔 맥락입니다. 아래 질문에 대한 본인의 실제 사실을 한두 문장 보충해 보세요.
        </p>
        <ul className="space-y-2 text-sm font-medium text-indigo-900">
          {followUpQuestions.map((q, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 rounded bg-indigo-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                Q{i + 1}
              </span>
              <span className="leading-relaxed">{q}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
