"use client";

import React from "react";
import { StudyQuestion } from "@/lib/storage";

interface QuestionCardProps {
  question: StudyQuestion;
  selectedChoice: number | null;
  onSelectChoice: (choiceNumber: number) => void;
  onRequestReExplain?: (question: StudyQuestion) => void;
  isReExplaining?: boolean;
  indexLabel?: string;
}

/**
 * 국시형 5지선다 문항 카드 컴포넌트 (개발 지시서 4-A, 4-B, 6-1 준수)
 * - 사용자가 보기를 고르면 정답 여부 + 해설 + 근거 페이지("p.12") 표시
 * - sourcePages가 비어 있는 문제는 "근거 확인 필요" 배지 표시
 */
export default function QuestionCard({
  question,
  selectedChoice,
  onSelectChoice,
  onRequestReExplain,
  isReExplaining = false,
  indexLabel,
}: QuestionCardProps) {
  const isAnswered = selectedChoice !== null;
  const isCorrect = isAnswered && selectedChoice === question.answer;
  const hasSourcePages =
    Array.isArray(question.sourcePages) && question.sourcePages.length > 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">
          {indexLabel || `문항 ${question.id}`}
        </span>

        {/* 근거 페이지 배지 (응답 전/후 모두 또는 해설과 함께 명확히 표시) */}
        {hasSourcePages ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            📄 근거 페이지: {question.sourcePages.map((p) => `p.${p}`).join(", ")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
            ⚠️ 근거 확인 필요
          </span>
        )}
      </div>

      {/* 문제 지문 */}
      <p className="mb-4 text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">
        {question.stem}
      </p>

      {/* 5지선다 보기 */}
      <div className="space-y-2.5">
        {question.choices.map((choiceText, idx) => {
          const choiceNum = idx + 1;
          const isThisSelected = selectedChoice === choiceNum;
          const isThisAnswer = question.answer === choiceNum;

          let btnStyle =
            "border-slate-200 bg-white text-slate-800 hover:border-teal-400 hover:bg-teal-50/40";
          if (isAnswered) {
            if (isThisAnswer) {
              btnStyle = "border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold";
            } else if (isThisSelected && !isThisAnswer) {
              btnStyle = "border-rose-400 bg-rose-50 text-rose-900";
            } else {
              btnStyle = "border-slate-200 bg-slate-50 text-slate-500";
            }
          }

          return (
            <button
              key={choiceNum}
              type="button"
              onClick={() => onSelectChoice(choiceNum)}
              disabled={isAnswered}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ${btnStyle}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="leading-relaxed">{choiceText}</span>
                {isAnswered && isThisAnswer && (
                  <span className="shrink-0 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
                    정답
                  </span>
                )}
                {isAnswered && isThisSelected && !isThisAnswer && (
                  <span className="shrink-0 rounded bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
                    선택한 오답
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 정답 확인 및 해설 영역 */}
      {isAnswered && (
        <div
          className={`mt-5 rounded-xl border p-4 ${
            isCorrect
              ? "border-emerald-200 bg-emerald-50/60"
              : "border-rose-200 bg-rose-50/60"
          }`}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-extrabold text-white ${
                  isCorrect ? "bg-emerald-600" : "bg-rose-600"
                }`}
              >
                {isCorrect ? "정답입니다! 🎉" : `오답입니다 (정답: ${question.answer}번)`}
              </span>
              {!isCorrect && (
                <span className="text-xs font-medium text-rose-700">
                  * 오답노트(/my)에 자동 저장되었습니다.
                </span>
              )}
            </div>

            {hasSourcePages ? (
              <span className="rounded-md bg-teal-700 px-2.5 py-1 text-xs font-bold text-white">
                근거: {question.sourcePages.map((p) => `p.${p}`).join(", ")}
              </span>
            ) : (
              <span className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-bold text-white">
                근거 확인 필요
              </span>
            )}
          </div>

          <p className="text-sm leading-relaxed text-slate-800">{question.explanation}</p>

          {onRequestReExplain && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => onRequestReExplain(question)}
                disabled={isReExplaining}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
              >
                {isReExplaining
                  ? "개념 설명 및 유사문제 생성 중..."
                  : "💡 [다시 설명] 쉬운 개념 설명 + 유사문제 3개"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
