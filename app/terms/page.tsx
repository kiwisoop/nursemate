"use client";

import React, { useState } from "react";
import abbreviationsData from "@/data/abbreviations.json";
import { saveAbbrRecord } from "@/lib/storage";

interface AbbrItem {
  id: number;
  abbr: string;
  fullName: string;
  meaning: string;
  acceptableFullNames: string[];
  acceptableMeanings: string[];
  category: string;
}

interface EtymologyItem {
  affix: string;
  type: string;
  meaning: string;
  examples: Array<{ word: string; breakdown: string; korean: string }>;
}

const DEFAULT_AFFIXES = [
  "hyper-",
  "hypo-",
  "tachy-",
  "brady-",
  "-itis",
  "-emia",
  "-ectomy",
  "-otomy",
  "-osis",
];

/**
 * 대소문자·띄어쓰기·하이픈을 무시하고 문자열을 정규화하여 비교합니다. (개발 지시서 4-C 준수)
 */
function normalizeAnswer(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s\-_.,/()]/g, "")
    .trim();
}

function checkAbbrAnswer(
  item: AbbrItem,
  userFullName: string,
  userMeaning: string
): { isFullCorrect: boolean; isMeaningCorrect: boolean; isBothCorrect: boolean } {
  const normUserFull = normalizeAnswer(userFullName);
  const normUserMeaning = normalizeAnswer(userMeaning);

  const validFulls = [item.fullName, ...(item.acceptableFullNames || [])].map(normalizeAnswer);
  const validMeanings = [item.meaning, ...(item.acceptableMeanings || [])].map(normalizeAnswer);

  const isFullCorrect =
    normUserFull.length > 0 && validFulls.some((vf) => vf === normUserFull);
  const isMeaningCorrect =
    normUserMeaning.length > 0 &&
    validMeanings.some((vm) => vm === normUserMeaning || normUserMeaning.includes(vm));

  return {
    isFullCorrect,
    isMeaningCorrect,
    isBothCorrect: isFullCorrect && isMeaningCorrect,
  };
}

export default function TermsPage() {
  const [activeTab, setActiveTab] = useState<"etymology" | "quiz">("etymology");

  // ==========================================
  // 탭 1: 어원 표 상태
  // ==========================================
  const [selectedAffixes, setSelectedAffixes] = useState<string[]>(DEFAULT_AFFIXES);
  const [etymologyItems, setEtymologyItems] = useState<EtymologyItem[]>([]);
  const [isEtymologyLoading, setIsEtymologyLoading] = useState(false);
  const [etymologyError, setEtymologyError] = useState<string | null>(null);

  const toggleAffix = (affix: string) => {
    setSelectedAffixes((prev) =>
      prev.includes(affix) ? prev.filter((a) => a !== affix) : [...prev, affix]
    );
  };

  const handleFetchEtymology = async () => {
    if (isEtymologyLoading) return;
    if (selectedAffixes.length === 0) {
      setEtymologyError("접두사/어근/접미사를 하나 이상 선택해 주세요.");
      return;
    }

    setIsEtymologyLoading(true);
    setEtymologyError(null);

    try {
      const res = await fetch("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affixes: selectedAffixes }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "어원 표 생성에 실패했습니다.");
      }
      setEtymologyItems(data.items || []);
    } catch (err) {
      setEtymologyError(
        err instanceof Error ? err.message : "어원 표를 불러오는 중 오류가 발생했습니다."
      );
    } finally {
      setIsEtymologyLoading(false);
    }
  };

  // ==========================================
  // 탭 2: 임상 약어 30개 퀴즈 상태 (고정 데이터 기반)
  // ==========================================
  const allAbbrs = abbreviationsData as AbbrItem[];
  const [quizPool, setQuizPool] = useState<AbbrItem[]>(allAbbrs);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [fullNameInput, setFullNameInput] = useState("");
  const [meaningInput, setMeaningInput] = useState("");
  const [isRetryMode, setIsRetryMode] = useState(false);

  // 현재 문항 채점 결과
  const [gradedResult, setGradedResult] = useState<{
    isFullCorrect: boolean;
    isMeaningCorrect: boolean;
    isBothCorrect: boolean;
    userFullName: string;
    userMeaning: string;
  } | null>(null);

  // 이번 라운드 누적 결과
  const [roundHistory, setRoundHistory] = useState<
    Array<{
      item: AbbrItem;
      userFullName: string;
      userMeaning: string;
      isCorrect: boolean;
    }>
  >([]);
  const [isQuizFinished, setIsQuizFinished] = useState(false);

  const currentAbbr = quizPool[currentIdx];

  // 한 문제 채점하기
  const handleGradeCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAbbr || gradedResult) return;

    const check = checkAbbrAnswer(currentAbbr, fullNameInput, meaningInput);
    setGradedResult({
      ...check,
      userFullName: fullNameInput.trim() || "(미입력)",
      userMeaning: meaningInput.trim() || "(미입력)",
    });

    setRoundHistory((prev) => [
      ...prev,
      {
        item: currentAbbr,
        userFullName: fullNameInput.trim() || "(미입력)",
        userMeaning: meaningInput.trim() || "(미입력)",
        isCorrect: check.isBothCorrect,
      },
    ]);
  };

  // 다음 문제로 넘어가기 (마지막 문항이면 결과 저장 및 완료 화면)
  const handleNextQuestion = () => {
    if (currentIdx + 1 < quizPool.length) {
      setCurrentIdx((prev) => prev + 1);
      setFullNameInput("");
      setMeaningInput("");
      setGradedResult(null);
    } else {
      finishQuizRound(roundHistory);
    }
  };

  // 라운드 종료 및 localStorage(/my) 저장
  const finishQuizRound = (
    finalHistory: Array<{
      item: AbbrItem;
      userFullName: string;
      userMeaning: string;
      isCorrect: boolean;
    }>
  ) => {
    setIsQuizFinished(true);
    const correctCount = finalHistory.filter((h) => h.isCorrect).length;
    const wrongList = finalHistory
      .filter((h) => !h.isCorrect)
      .map((h) => ({
        abbr: h.item.abbr,
        fullName: h.item.fullName,
        meaning: h.item.meaning,
        userFullName: h.userFullName,
        userMeaning: h.userMeaning,
      }));

    saveAbbrRecord({
      score: correctCount,
      total: quizPool.length,
      wrongAbbrs: wrongList,
    });
  };

  // 틀린 약어만 모아서 재출제 시작
  const handleStartWrongRetry = () => {
    const wrongItems = roundHistory.filter((h) => !h.isCorrect).map((h) => h.item);
    if (wrongItems.length === 0) return;

    setQuizPool(wrongItems);
    setCurrentIdx(0);
    setFullNameInput("");
    setMeaningInput("");
    setGradedResult(null);
    setRoundHistory([]);
    setIsQuizFinished(false);
    setIsRetryMode(true);
  };

  // 처음부터 30문항 전체 다시 시작
  const handleResetFullQuiz = () => {
    setQuizPool(allAbbrs);
    setCurrentIdx(0);
    setFullNameInput("");
    setMeaningInput("");
    setGradedResult(null);
    setRoundHistory([]);
    setIsQuizFinished(false);
    setIsRetryMode(false);
  };

  const wrongInRound = roundHistory.filter((h) => !h.isCorrect);
  const correctInRound = roundHistory.filter((h) => h.isCorrect);

  return (
    <div className="space-y-6">
      {/* 상단 제목 및 탭 전환 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
            기능 C | 의학용어 어원 & 임상 약어 30선
          </span>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
            🔤 의학용어 어원 표 & 임상 약어 퀴즈
          </h1>
        </div>

        <div className="flex rounded-xl bg-slate-200/80 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("etymology")}
            className={`rounded-lg px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
              activeTab === "etymology"
                ? "bg-white text-teal-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            1. 어원 분해 표
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("quiz")}
            className={`rounded-lg px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
              activeTab === "quiz"
                ? "bg-white text-teal-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            2. 임상 약어 30개 퀴즈
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* 탭 1: 의학용어 어원 분해 표 */}
      {/* ========================================== */}
      {activeTab === "etymology" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-1 text-base font-extrabold text-slate-900 sm:text-lg">
              🧩 학습할 접두사 / 어근 / 접미사 선택
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              원하는 어원을 선택하고 [어원 표 생성하기]를 누르면 뜻, 예시 단어 3개, 한국어 용어 표를 정리해 드립니다.
            </p>

            <div className="mb-4 flex flex-wrap gap-2">
              {DEFAULT_AFFIXES.map((affix) => {
                const isSelected = selectedAffixes.includes(affix);
                return (
                  <button
                    key={affix}
                    type="button"
                    onClick={() => toggleAffix(affix)}
                    className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition sm:text-sm ${
                      isSelected
                        ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                        : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {isSelected ? "✓ " : "+ "}
                    {affix}
                  </button>
                );
              })}
            </div>

            {etymologyError && (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                <span>⚠️ {etymologyError}</span>
                <button
                  type="button"
                  onClick={handleFetchEtymology}
                  className="rounded-lg bg-rose-600 px-3 py-1 text-white"
                >
                  다시 시도
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleFetchEtymology}
                disabled={isEtymologyLoading}
                className="rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 sm:text-sm"
              >
                {isEtymologyLoading
                  ? "⏳ 어원 표 정리 중..."
                  : `📊 선택한 어원(${selectedAffixes.length}개) 표 생성하기`}
              </button>
              <button
                type="button"
                onClick={() => setSelectedAffixes(DEFAULT_AFFIXES)}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                전체 선택
              </button>
            </div>
          </div>

          {etymologyItems.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-base font-extrabold text-slate-900">
                📖 의학용어 어원 분해 결과 표
              </h3>
              <table className="w-full border-collapse border border-slate-200 text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-teal-50 text-teal-950">
                    <th className="border border-slate-200 px-3 py-2.5 font-extrabold">어원</th>
                    <th className="border border-slate-200 px-3 py-2.5 font-extrabold">구분</th>
                    <th className="border border-slate-200 px-3 py-2.5 font-extrabold">의미 (뜻)</th>
                    <th className="border border-slate-200 px-3 py-2.5 font-extrabold">
                      예시 단어 3개 & 한국어 용어
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {etymologyItems.map((item, idx) => (
                    <tr key={idx} className="odd:bg-white even:bg-slate-50/70">
                      <td className="border border-slate-200 px-3 py-3 font-extrabold text-teal-800">
                        {item.affix}
                      </td>
                      <td className="border border-slate-200 px-3 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                          {item.type}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-3 py-3 font-semibold text-slate-800">
                        {item.meaning}
                      </td>
                      <td className="border border-slate-200 px-3 py-3">
                        <ul className="space-y-1.5">
                          {item.examples.map((ex, i) => (
                            <li key={i} className="flex flex-wrap items-center gap-1.5">
                              <strong className="text-slate-900">{ex.word}</strong>
                              <span className="text-xs text-slate-500">({ex.breakdown})</span>
                              <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-900">
                                {ex.korean}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 탭 2: 임상 약어 30개 퀴즈 */}
      {/* ========================================== */}
      {activeTab === "quiz" && (
        <div className="space-y-6">
          {/* 고정 데이터 안내 배너 */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs font-semibold text-emerald-950 sm:text-sm">
            🛡️ 환각 방지 적용: 임상 약어 30개의 정답(풀네임·뜻)은 AI가 임의로 생성하지 않고 검증된 고정 데이터(<code>data/abbreviations.json</code>)로 정확하게 채점합니다. (대소문자·띄어쓰기 무시)
          </div>

          {!isQuizFinished && currentAbbr ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-teal-600 px-3 py-1 text-xs font-extrabold text-white">
                    {isRetryMode ? "🔁 오답 재출제 모드" : "임상 약어 퀴즈"} ({currentIdx + 1} /{" "}
                    {quizPool.length})
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    분류: {currentAbbr.category}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  현재 정답: {correctInRound.length}개 / 오답: {wrongInRound.length}개
                </span>
              </div>

              {/* 출제 약어 대형 카드 */}
              <div className="my-6 rounded-2xl bg-slate-50 py-8 text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Clinical Abbreviation
                </span>
                <div className="mt-1 text-4xl font-black tracking-tight text-teal-700 sm:text-5xl">
                  {currentAbbr.abbr}
                </div>
              </div>

              {/* 입력 및 채점 폼 */}
              <form onSubmit={handleGradeCurrent} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      영문 풀네임 (Full Name) — 대소문자·띄어쓰기 무관
                    </label>
                    <input
                      type="text"
                      value={fullNameInput}
                      onChange={(e) => setFullNameInput(e.target.value)}
                      disabled={Boolean(gradedResult)}
                      placeholder="예: Blood Pressure"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      한국어 뜻 (Meaning) — 띄어쓰기 무관
                    </label>
                    <input
                      type="text"
                      value={meaningInput}
                      onChange={(e) => setMeaningInput(e.target.value)}
                      disabled={Boolean(gradedResult)}
                      placeholder="예: 혈압"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
                    />
                  </div>
                </div>

                {!gradedResult ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <button
                      type="submit"
                      className="rounded-xl bg-teal-600 px-6 py-3 text-xs font-extrabold text-white shadow-sm hover:bg-teal-700 sm:text-sm"
                    >
                      ✓ 채점하기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFullNameInput(currentAbbr.fullName);
                        setMeaningInput(currentAbbr.meaning);
                      }}
                      className="text-xs font-semibold text-slate-500 underline hover:text-teal-700"
                    >
                      정답 예시 자동 채우기 (학습용)
                    </button>
                  </div>
                ) : (
                  <div
                    className={`space-y-3 rounded-xl border p-4 ${
                      gradedResult.isBothCorrect
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-rose-300 bg-rose-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-md px-2.5 py-1 text-xs font-extrabold text-white ${
                          gradedResult.isBothCorrect ? "bg-emerald-600" : "bg-rose-600"
                        }`}
                      >
                        {gradedResult.isBothCorrect
                          ? "정답입니다! 🎉"
                          : "오답입니다 (마지막에 재출제됩니다)"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 sm:text-sm">
                      <div>
                        <span className="font-bold text-slate-700">정답 풀네임: </span>
                        <strong className="text-slate-900">{currentAbbr.fullName}</strong>{" "}
                        <span className="text-xs">
                          ({gradedResult.isFullCorrect ? "✅ 일치" : "❌ 불일치"})
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700">정답 한국어 뜻: </span>
                        <strong className="text-slate-900">{currentAbbr.meaning}</strong>{" "}
                        <span className="text-xs">
                          ({gradedResult.isMeaningCorrect ? "✅ 일치" : "❌ 불일치"})
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleNextQuestion}
                        className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-slate-800 sm:text-sm"
                      >
                        {currentIdx + 1 < quizPool.length
                          ? "다음 약어 문제 →"
                          : "퀴즈 결과 확인 및 기록 저장 →"}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          ) : (
            /* 퀴즈 완주 결과 및 틀린 약어 재출제 화면 */
            <div className="space-y-6 rounded-2xl border-2 border-teal-600 bg-white p-6 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-extrabold text-teal-800">
                    퀴즈 완주! 내 기록(/my)에 자동 저장되었습니다
                  </span>
                  <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                    🏆 임상 약어 퀴즈 결과: {correctInRound.length} / {quizPool.length}점
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  {wrongInRound.length > 0 && (
                    <button
                      type="button"
                      onClick={handleStartWrongRetry}
                      className="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-rose-700 sm:text-sm"
                    >
                      🔁 틀린 약어({wrongInRound.length}개)만 모아서 재출제
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleResetFullQuiz}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 sm:text-sm"
                  >
                    전체 30문항 처음부터 다시 풀기
                  </button>
                </div>
              </div>

              {wrongInRound.length === 0 ? (
                <div className="rounded-xl bg-emerald-50 p-5 text-center text-sm font-bold text-emerald-900">
                  🎉 모든 약어를 완벽하게 맞히셨습니다!
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-sm font-extrabold text-rose-800">
                    📌 이번 라운드에서 틀린 약어 목록 ({wrongInRound.length}개)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-200 text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-rose-50 text-rose-950">
                          <th className="border border-slate-200 px-3 py-2 font-bold">약어</th>
                          <th className="border border-slate-200 px-3 py-2 font-bold">정답 풀네임</th>
                          <th className="border border-slate-200 px-3 py-2 font-bold">정답 뜻</th>
                          <th className="border border-slate-200 px-3 py-2 font-bold">내 입력</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wrongInRound.map((w, idx) => (
                          <tr key={idx} className="odd:bg-white even:bg-slate-50">
                            <td className="border border-slate-200 px-3 py-2 font-extrabold text-rose-700">
                              {w.item.abbr}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 font-semibold">
                              {w.item.fullName}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 font-semibold">
                              {w.item.meaning}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-500">
                              {w.userFullName} / {w.userMeaning}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
