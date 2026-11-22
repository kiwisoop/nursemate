"use client";

import React, { useState } from "react";

export interface InterviewTurn {
  questionNumber: number;
  category: string;
  question: string;
  userAnswer?: string;
  feedback?: {
    goodPoints: string;
    improvementPoints: string;
    betterExample: string;
  };
}

export interface FinalInterviewEval {
  totalScore: number;
  overallReview: string;
  strengths: string[];
  weaknesses: string[];
}

interface ChatBoxProps {
  hospital: string;
  department: string;
  applicantType: string;
  turns: InterviewTurn[];
  isLoading: boolean;
  errorMessage: string | null;
  finalEval: FinalInterviewEval | null;
  onSubmitAnswer: (answerText: string) => void;
  onRetryLast: () => void;
  onRestart: () => void;
}

/**
 * 채팅형 모의 면접 컴포넌트 (개발 지시서 4-E 준수)
 */
export default function ChatBox({
  hospital,
  department,
  applicantType,
  turns,
  isLoading,
  errorMessage,
  finalEval,
  onSubmitAnswer,
  onRetryLast,
  onRestart,
}: ChatBoxProps) {
  const [answerInput, setAnswerInput] = useState("");
  const currentTurn = turns[turns.length - 1];
  const isFinished = Boolean(finalEval);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerInput.trim() || isLoading || isFinished) return;
    onSubmitAnswer(answerInput.trim());
    setAnswerInput("");
  };

  return (
    <div className="space-y-4">
      {/* 상단 면접관 정보 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-teal-200 bg-teal-50/70 px-4 py-3">
        <div>
          <span className="text-xs font-bold text-teal-700">모의 면접 진행 중</span>
          <h3 className="text-sm font-extrabold text-slate-900">
            🏥 {hospital} · {department} ({applicantType})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-teal-700 px-3 py-1 text-xs font-bold text-white">
            진행률: {Math.min(turns.length, 10)} / 10문항
          </span>
          <button
            type="button"
            onClick={onRestart}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            처음부터
          </button>
        </div>
      </div>

      {/* 대화 목록 */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        {turns.map((turn) => (
          <div key={turn.questionNumber} className="space-y-3">
            {/* 면접관 질문 말풍선 */}
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                면접관
              </div>
              <div className="max-w-2xl rounded-2xl rounded-tl-none border border-slate-200 bg-slate-50 p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                    Q{turn.questionNumber}. [{turn.category}]
                  </span>
                </div>
                <p className="text-sm font-semibold leading-relaxed text-slate-900">
                  {turn.question}
                </p>
              </div>
            </div>

            {/* 지원자 답변 말풍선 */}
            {turn.userAnswer && (
              <div className="flex justify-end">
                <div className="max-w-xl rounded-2xl rounded-tr-none bg-teal-600 p-4 text-sm leading-relaxed text-white shadow-sm">
                  {turn.userAnswer}
                </div>
              </div>
            )}

            {/* 답변별 3단계 피드백 */}
            {turn.feedback && (
              <div className="ml-11 rounded-xl border border-teal-200 bg-teal-50/40 p-4 text-xs sm:text-sm">
                <div className="mb-2 font-bold text-teal-900">
                  📋 Q{turn.questionNumber} 면접관 피드백
                </div>
                <div className="space-y-2 text-slate-800">
                  <p>
                    <strong className="text-emerald-700">(1) 좋았던 점:</strong>{" "}
                    {turn.feedback.goodPoints}
                  </p>
                  <p>
                    <strong className="text-amber-700">(2) 보완할 점:</strong>{" "}
                    {turn.feedback.improvementPoints}
                  </p>
                  <p className="rounded-lg bg-white p-2.5 text-slate-700 ring-1 ring-teal-100">
                    <strong className="text-teal-700">(3) 더 나은 답변 예시:</strong>{" "}
                    {turn.feedback.betterExample}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
            <span className="h-2 w-2 animate-ping rounded-full bg-teal-600" />
            면접관이 답변을 분석하고 피드백을 작성하고 있습니다...
          </div>
        )}

        {errorMessage && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            <span>⚠️ {errorMessage}</span>
            <button
              type="button"
              onClick={onRetryLast}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-white hover:bg-rose-700"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>

      {/* 10문항 완료 후 최종 총평 및 100점 만점 점수 */}
      {finalEval && (
        <div className="rounded-2xl border-2 border-teal-600 bg-white p-6 shadow-md">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">
                10문항 면접 완주! (내 기록 /my 에 자동 저장됨)
              </span>
              <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                🏆 모의 면접 최종 총평
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-500">종합 점수</span>
              <div className="text-3xl font-black text-teal-600">
                {finalEval.totalScore}
                <span className="text-base font-bold text-slate-500"> / 100점</span>
              </div>
            </div>
          </div>

          <p className="mb-4 text-sm leading-relaxed text-slate-800">
            {finalEval.overallReview}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-emerald-50 p-4">
              <h4 className="mb-2 text-xs font-bold text-emerald-900">👍 강점</h4>
              <ul className="list-inside list-disc space-y-1 text-xs text-emerald-800">
                {finalEval.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <h4 className="mb-2 text-xs font-bold text-amber-900">📌 보완할 점</h4>
              <ul className="list-inside list-disc space-y-1 text-xs text-amber-800">
                {finalEval.weaknesses.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 답변 입력 폼 */}
      {!isFinished && currentTurn && (
        <form onSubmit={handleSend} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="mb-1.5 block text-xs font-bold text-slate-700">
            Q{currentTurn.questionNumber}에 대한 나의 답변 입력
          </label>
          <textarea
            rows={3}
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            placeholder="실제 면접관 앞에서 답하듯 구체적인 간호 행동과 근거를 포함해 작성해 보세요..."
            disabled={isLoading}
            className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-teal-500 focus:outline-none disabled:bg-slate-50"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              순서: 인성(1~3) → 직무(4~7) → 상황 대처(8~10)
            </span>
            <button
              type="submit"
              disabled={isLoading || !answerInput.trim()}
              className="rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 sm:text-sm"
            >
              {isLoading ? "전송 중..." : "답변 제출하기"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
