"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import QuestionCard from "@/components/QuestionCard";
import {
  AbbrQuizRecord,
  InterviewRecord,
  StudyQuestion,
  WrongNoteItem,
  getAbbrRecords,
  getInterviewRecords,
  getWrongNotes,
  removeWrongNote,
} from "@/lib/storage";

export default function MyRecordsPage() {
  const [activeTab, setActiveTab] = useState<"wrong" | "abbr" | "interview">("wrong");
  const [wrongNotes, setWrongNotes] = useState<WrongNoteItem[]>([]);
  const [abbrRecords, setAbbrRecords] = useState<AbbrQuizRecord[]>([]);
  const [interviewRecords, setInterviewRecords] = useState<InterviewRecord[]>([]);

  // 오답노트 내 [다시 설명] 상태
  const [reExplainUid, setReExplainUid] = useState<string | null>(null);
  const [isReExplainLoading, setIsReExplainLoading] = useState(false);
  const [reExplainResult, setReExplainResult] = useState<{
    uid: string;
    easyExplanation: string;
    questions: StudyQuestion[];
  } | null>(null);
  const [simSelected, setSimSelected] = useState<Record<number, number>>({});

  useEffect(() => {
    setWrongNotes(getWrongNotes());
    setAbbrRecords(getAbbrRecords());
    setInterviewRecords(getInterviewRecords());
  }, []);

  const handleDeleteWrongNote = (uid: string) => {
    const updated = removeWrongNote(uid);
    setWrongNotes(updated);
    if (reExplainResult?.uid === uid) {
      setReExplainResult(null);
    }
  };

  const handleReExplainInMy = async (item: WrongNoteItem) => {
    if (isReExplainLoading) return;
    setReExplainUid(item.uid);
    setIsReExplainLoading(true);

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "wrong_review",
          question: item.question,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReExplainResult({
          uid: item.uid,
          easyExplanation: data.easyExplanation,
          questions: data.questions || [],
        });
        setSimSelected({});
      }
    } finally {
      setIsReExplainLoading(false);
      setReExplainUid(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 상단 제목 및 요약 배지 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-extrabold text-teal-800">
            내 학습 & 취업 준비 기록 (브라우저 localStorage 저장)
          </span>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
            📒 내 기록 (오답노트 · 약어 오답 · 면접 점수)
          </h1>
          <p className="text-xs text-slate-500">
            새로고침하거나 다시 방문해도 이 브라우저에 학습 기록이 안전하게 유지됩니다.
          </p>
        </div>

        <div className="flex rounded-xl bg-slate-200/80 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("wrong")}
            className={`rounded-lg px-3.5 py-2 text-xs font-extrabold transition sm:text-sm ${
              activeTab === "wrong"
                ? "bg-white text-teal-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            오답노트 ({wrongNotes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("abbr")}
            className={`rounded-lg px-3.5 py-2 text-xs font-extrabold transition sm:text-sm ${
              activeTab === "abbr"
                ? "bg-white text-teal-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            약어 오답 ({abbrRecords.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("interview")}
            className={`rounded-lg px-3.5 py-2 text-xs font-extrabold transition sm:text-sm ${
              activeTab === "interview"
                ? "bg-white text-teal-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            면접 점수 ({interviewRecords.length})
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* 1. 강의록 문제 오답노트 탭 */}
      {/* ========================================== */}
      {activeTab === "wrong" && (
        <div className="space-y-4">
          {wrongNotes.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <p className="mb-3 text-sm font-bold text-slate-700">
                아직 저장된 강의록 오답 문제가 없습니다.
              </p>
              <Link
                href="/study"
                className="inline-block rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-teal-700 sm:text-sm"
              >
                📄 강의록 문제 풀러 가기 →
              </Link>
            </div>
          ) : (
            wrongNotes.map((item) => {
              const q = item.question;
              const hasPages = Array.isArray(q.sourcePages) && q.sourcePages.length > 0;
              const isShowingReExplain = reExplainResult?.uid === item.uid;

              return (
                <div
                  key={item.uid}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-extrabold text-rose-800">
                        [{item.subject}] {item.unit}
                      </span>
                      {hasPages ? (
                        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800">
                          근거 페이지: {q.sourcePages.map((p) => `p.${p}`).join(", ")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                          ⚠️ 근거 확인 필요
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteWrongNote(item.uid)}
                      className="text-xs font-semibold text-slate-400 hover:text-rose-600"
                    >
                      복습 완료(삭제) ✕
                    </button>
                  </div>

                  <p className="text-sm font-extrabold leading-relaxed text-slate-900 sm:text-base">
                    {q.stem}
                  </p>

                  <div className="space-y-1.5 text-xs sm:text-sm">
                    {q.choices.map((c, idx) => {
                      const num = idx + 1;
                      const isAns = num === q.answer;
                      const isUserWrong = num === item.selectedChoice;
                      return (
                        <div
                          key={num}
                          className={`rounded-xl border px-3.5 py-2.5 ${
                            isAns
                              ? "border-emerald-400 bg-emerald-50 font-bold text-emerald-950"
                              : isUserWrong
                              ? "border-rose-300 bg-rose-50 text-rose-900"
                              : "border-slate-100 bg-slate-50 text-slate-600"
                          }`}
                        >
                          {c}{" "}
                          {isAns && (
                            <span className="ml-2 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              정답
                            </span>
                          )}
                          {isUserWrong && !isAns && (
                            <span className="ml-2 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              내가 고른 오답
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700 sm:text-sm">
                    <strong className="text-slate-900">해설: </strong>
                    {q.explanation}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleReExplainInMy(item)}
                      disabled={isReExplainLoading && reExplainUid === item.uid}
                      className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
                    >
                      {isReExplainLoading && reExplainUid === item.uid
                        ? "쉬운 설명 & 유사문제 생성 중..."
                        : "💡 [다시 설명] 쉬운 설명 + 유사문제 3개 풀기"}
                    </button>
                  </div>

                  {isShowingReExplain && reExplainResult && (
                    <div className="mt-4 space-y-4 rounded-2xl border-2 border-teal-500 bg-teal-50/40 p-4">
                      <h4 className="text-sm font-extrabold text-teal-950">
                        💡 쉬운 개념 재설명
                      </h4>
                      <p className="whitespace-pre-line rounded-xl bg-white p-3.5 text-xs leading-relaxed text-slate-800 sm:text-sm">
                        {reExplainResult.easyExplanation}
                      </p>
                      <div className="space-y-3">
                        {reExplainResult.questions.map((sq, idx) => (
                          <QuestionCard
                            key={sq.id || idx}
                            question={sq}
                            selectedChoice={simSelected[idx] ?? null}
                            onSelectChoice={(cNum) =>
                              setSimSelected((prev) => ({ ...prev, [idx]: cNum }))
                            }
                            indexLabel={`오답 복습 유사문제 ${idx + 1} / 3`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 2. 임상 약어 퀴즈 기록 & 약어 오답 탭 */}
      {/* ========================================== */}
      {activeTab === "abbr" && (
        <div className="space-y-4">
          {abbrRecords.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <p className="mb-3 text-sm font-bold text-slate-700">
                아직 저장된 약어 퀴즈 기록이 없습니다.
              </p>
              <Link
                href="/terms"
                className="inline-block rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-teal-700 sm:text-sm"
              >
                🔤 임상 약어 30개 퀴즈 풀러 가기 →
              </Link>
            </div>
          ) : (
            abbrRecords.map((rec) => (
              <div
                key={rec.id}
                className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs text-slate-400">
                      {new Date(rec.completedAt).toLocaleString("ko-KR")}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900">
                      임상 약어 퀴즈 점수: {rec.score} / {rec.total}점
                    </h3>
                  </div>
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-extrabold text-teal-800">
                    틀린 약어 {rec.wrongAbbrs.length}개
                  </span>
                </div>

                {rec.wrongAbbrs.length === 0 ? (
                  <p className="text-xs font-bold text-emerald-700">
                    🎉 만점! 틀린 약어가 없습니다.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-200 text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700">
                          <th className="border border-slate-200 px-3 py-2 font-bold">약어</th>
                          <th className="border border-slate-200 px-3 py-2 font-bold">정답 풀네임</th>
                          <th className="border border-slate-200 px-3 py-2 font-bold">정답 뜻</th>
                          <th className="border border-slate-200 px-3 py-2 font-bold">당시 내 입력</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rec.wrongAbbrs.map((w, idx) => (
                          <tr key={idx}>
                            <td className="border border-slate-200 px-3 py-2 font-extrabold text-rose-700">
                              {w.abbr}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 font-semibold">
                              {w.fullName}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 font-semibold">
                              {w.meaning}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-500">
                              {w.userFullName} / {w.userMeaning}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 3. 모의 면접 점수 & 총평 기록 탭 */}
      {/* ========================================== */}
      {activeTab === "interview" && (
        <div className="space-y-4">
          {interviewRecords.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <p className="mb-3 text-sm font-bold text-slate-700">
                아직 저장된 모의 면접 점수 기록이 없습니다.
              </p>
              <Link
                href="/career/interview"
                className="inline-block rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-teal-700 sm:text-sm"
              >
                🎙️ 부서별 모의 면접 시작하기 →
              </Link>
            </div>
          ) : (
            interviewRecords.map((rec) => (
              <div
                key={rec.id}
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs text-slate-400">
                      {new Date(rec.completedAt).toLocaleString("ko-KR")}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900">
                      🏥 {rec.hospital} · {rec.department} ({rec.applicantType})
                    </h3>
                  </div>
                  <div className="rounded-xl bg-teal-600 px-4 py-1.5 text-sm font-black text-white">
                    {rec.totalScore} / 100점
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-slate-800 sm:text-sm">
                  {rec.overallReview}
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-emerald-50 p-3 text-xs">
                    <strong className="mb-1 block text-emerald-900">👍 강점</strong>
                    <ul className="list-inside list-disc space-y-1 text-emerald-800">
                      {rec.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3 text-xs">
                    <strong className="mb-1 block text-amber-900">📌 보완점</strong>
                    <ul className="list-inside list-disc space-y-1 text-amber-800">
                      {rec.weaknesses.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
