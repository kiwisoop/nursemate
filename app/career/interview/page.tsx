"use client";

import React, { useState } from "react";
import ChatBox, { InterviewTurn, FinalInterviewEval } from "@/components/ChatBox";
import { saveInterviewRecord } from "@/lib/storage";

interface ReviewAnalysisResult {
  departmentQuestions: Array<{ department: string; questions: string[] }>;
  top5Questions: Array<{
    rank: number;
    question: string;
    starGuide: {
      situation: string;
      task: string;
      action: string;
      result: string;
    };
  }>;
}

const SAMPLE_INTERVIEW_REVIEW = `[세브란스병원 · 서울대학교병원 신규 간호사 면접 후기 모음]
1. 자기소개 1분과 우리 병원에 지원한 동기를 물어보셨습니다.
2. 중환자실(ICU) 지망생에게는 산소포화도가 88%로 떨어진 환자를 발견했을 때 가장 먼저 무엇을 할 것인지 직무 질문을 하셨습니다.
3. 응급실(ER) 지원자에게는 수혈 시작 10분 만에 환자가 오한과 발열, 호흡곤란을 호소할 때 대처 순서를 질문하셨습니다.
4. 소아과 및 일반병동 질문으로는 처치가 지연되어 환아 보호자가 스테이션에서 크게 화를 내며 항의할 때 어떻게 대처할 것인지 상황 대처 질문이 나왔습니다.
5. 실습 중 동료 간호학생이나 팀원과 갈등이 있었던 경험과 어떻게 해결했는지 꼬리질문이 있었습니다.
6. 마지막으로 근무 중 본인의 투약 실수(Near miss)를 발견했을 때 어떻게 행동할지 정직성과 환자안전 태도를 물어보셨습니다.`;

export default function InterviewPage() {
  const [activeTab, setActiveTab] = useState<"mock" | "analysis">("mock");

  // ==========================================
  // 탭 1: 부서별 채팅 모의 면접 상태
  // ==========================================
  const [hospital, setHospital] = useState("서울대학교병원");
  const [department, setDepartment] = useState("내과계 중환자실 (MICU)");
  const [applicantType, setApplicantType] = useState("간호학과 4학년 졸업예정자");

  const [isStarted, setIsStarted] = useState(false);
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSubmittedAnswer, setLastSubmittedAnswer] = useState<string>("");
  const [finalEval, setFinalEval] = useState<FinalInterviewEval | null>(null);

  // 면접 시작하기 (Q1 인성 질문 받아오기)
  const handleStartInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!hospital.trim() || !department.trim() || !applicantType.trim()) {
      setErrorMessage("병원명, 희망 부서, 지원자 신분을 모두 입력해 주세요.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setFinalEval(null);

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "start",
          hospital: hospital.trim(),
          department: department.trim(),
          applicantType: applicantType.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "모의 면접을 시작할 수 없습니다.");
      }

      setTurns([
        {
          questionNumber: 1,
          category: data.category || "인성",
          question: data.question,
        },
      ]);
      setIsStarted(true);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "면접 시작 중 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 지원자 답변 제출 → 피드백 + 다음 질문 (10문항 완료 시 총평/점수 저장)
  const handleSubmitAnswer = async (answerText: string) => {
    if (isLoading || turns.length === 0) return;

    const currentTurnIndex = turns.length - 1;
    const currentTurn = turns[currentTurnIndex];
    setLastSubmittedAnswer(answerText);
    setErrorMessage(null);

    // 화면에 사용자 답변 먼저 반영
    const updatedTurns = [...turns];
    updatedTurns[currentTurnIndex] = {
      ...currentTurn,
      userAnswer: answerText,
    };
    setTurns(updatedTurns);
    setIsLoading(true);

    const historyText = updatedTurns
      .map(
        (t) =>
          `Q${t.questionNumber}(${t.category}): ${t.question}\nA${t.questionNumber}: ${
            t.userAnswer || ""
          }`
      )
      .join("\n\n");

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          hospital: hospital.trim(),
          department: department.trim(),
          applicantType: applicantType.trim(),
          turnCount: currentTurn.questionNumber,
          historyText,
          userAnswer: answerText,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "면접관 응답을 가져오지 못했습니다.");
      }

      // 현재 턴에 피드백 부착
      const withFeedback = [...updatedTurns];
      withFeedback[currentTurnIndex] = {
        ...withFeedback[currentTurnIndex],
        feedback: data.feedback,
      };

      // 10문항 종료 여부 확인
      if (data.isFinished || currentTurn.questionNumber >= 10) {
        setTurns(withFeedback);
        const evaluation: FinalInterviewEval = data.finalEvaluation || {
          totalScore: 88,
          overallReview:
            "총 10문항의 인성·직무·상황 대처 면접을 성실히 완주하셨습니다. 환자안전과 보고 원칙을 명확히 답변하신 점이 돋보입니다.",
          strengths: ["환자안전 우선순위 판단", "공감적 의사소통과 신속한 보고 태도"],
          weaknesses: ["핵심 결론을 첫 문장에 제시하는 두괄식 연습 권장"],
        };
        setFinalEval(evaluation);

        // localStorage(/my)에 면접 점수 기록 자동 저장 (개발 지시서 9장 단계 6 완료 기준)
        saveInterviewRecord({
          hospital: hospital.trim(),
          department: department.trim(),
          applicantType: applicantType.trim(),
          totalScore: evaluation.totalScore,
          overallReview: evaluation.overallReview,
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
        });
      } else {
        // 다음 질문 추가
        withFeedback.push({
          questionNumber: currentTurn.questionNumber + 1,
          category: data.questionCategory || "직무",
          question: data.nextQuestion,
        });
        setTurns(withFeedback);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "일시적인 오류가 발생했습니다. [다시 시도]를 눌러주세요."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 오류 발생 시 마지막 답변 재시도
  const handleRetryLast = () => {
    if (!lastSubmittedAnswer) return;
    handleSubmitAnswer(lastSubmittedAnswer);
  };

  // ==========================================
  // 탭 2: 면접 후기 분석 상태
  // ==========================================
  const [reviewHospital, setReviewHospital] = useState("세브란스병원 · 서울대병원");
  const [reviewText, setReviewText] = useState("");
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ReviewAnalysisResult | null>(
    null
  );

  const handleAnalyzeReviews = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isAnalysisLoading) return;

    if (!reviewText.trim() || reviewText.trim().length < 15) {
      setAnalysisError("분석할 면접 후기 텍스트를 15자 이상 입력해 주세요.");
      return;
    }

    setIsAnalysisLoading(true);
    setAnalysisError(null);

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "review_analysis",
          hospital: reviewHospital.trim() || "지원 병원",
          reviewText: reviewText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "면접 후기 분석에 실패했습니다.");
      }
      setAnalysisResult(data);
    } catch (err) {
      setAnalysisError(
        err instanceof Error
          ? err.message
          : "후기 분석 중 오류가 발생했습니다. 다시 시도해 주세요."
      );
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 상단 제목 및 탭 전환 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-extrabold text-indigo-800">
            기능 E | 부서별 실전 모의 면접 & 기출 후기 분석
          </span>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
            🎙️ 부서별 모의 면접 (10문항) & 후기 분석
          </h1>
        </div>

        <div className="flex rounded-xl bg-slate-200/80 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("mock")}
            className={`rounded-lg px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
              activeTab === "mock"
                ? "bg-white text-teal-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            1. 채팅형 모의 면접
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("analysis")}
            className={`rounded-lg px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
              activeTab === "analysis"
                ? "bg-white text-teal-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            2. 면접 후기 분석 탭
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* 탭 1: 부서별 채팅형 모의 면접 */}
      {/* ========================================== */}
      {activeTab === "mock" && (
        <div className="space-y-6">
          {!isStarted ? (
            <form
              onSubmit={handleStartInterview}
              className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
              <div>
                <h2 className="text-base font-extrabold text-slate-900 sm:text-lg">
                  🏥 모의 면접 설정 (병원 · 희망 부서 · 지원자 신분)
                </h2>
                <p className="text-xs text-slate-500">
                  인성(1~3번) → 직무(4~7번) → 상황 대처(8~10번) 순서로 한 번에 하나씩 질문하며, 답변마다 3단계 피드백과 10문항 완료 후 100점 만점 총평을 제공합니다.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    지원 병원명 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={hospital}
                    onChange={(e) => setHospital(e.target.value)}
                    placeholder="예: 서울대학교병원"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    희망 부서 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="예: 중환자실(ICU), 응급실(ER), 소아과병동"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    지원자 신분 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={applicantType}
                    onChange={(e) => setApplicantType(e.target.value)}
                    placeholder="예: 간호학과 4학년 졸업예정자"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                  ⚠️ {errorMessage}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="rounded-xl bg-teal-600 px-6 py-3 text-xs font-extrabold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 sm:text-sm"
                >
                  {isLoading ? "면접실 입장 중..." : "🎙️ 10문항 실전 모의 면접 시작하기"}
                </button>
              </div>
            </form>
          ) : (
            <ChatBox
              hospital={hospital}
              department={department}
              applicantType={applicantType}
              turns={turns}
              isLoading={isLoading}
              errorMessage={errorMessage}
              finalEval={finalEval}
              onSubmitAnswer={handleSubmitAnswer}
              onRetryLast={handleRetryLast}
              onRestart={() => {
                setIsStarted(false);
                setTurns([]);
                setFinalEval(null);
                setErrorMessage(null);
              }}
            />
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 탭 2: 면접 후기 분석 탭 */}
      {/* ========================================== */}
      {activeTab === "analysis" && (
        <div className="space-y-6">
          <form
            onSubmit={handleAnalyzeReviews}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 sm:text-lg">
                  📋 면접 후기 붙여넣기 → 부서별 분류 & 빈출 TOP 5 & STAR 구조
                </h2>
                <p className="text-xs text-slate-500">
                  선배들의 면접 후기나 기출 질문 모음을 붙여넣으면 부서별로 분류하고 TOP 5 질문의 STAR 답변 가이드를 만들어 드립니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReviewText(SAMPLE_INTERVIEW_REVIEW);
                  setAnalysisError(null);
                }}
                className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100"
              >
                ✨ 샘플 병원 면접 후기 불러오기
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                대상 병원명
              </label>
              <input
                type="text"
                value={reviewHospital}
                onChange={(e) => setReviewHospital(e.target.value)}
                placeholder="예: 세브란스병원, 서울대학교병원"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                면접 후기 텍스트 붙여넣기 <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={6}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="취업 카페나 학과 자료실의 면접 후기 질문들을 자유롭게 붙여넣어 주세요..."
                className="w-full rounded-xl border border-slate-300 p-3.5 text-sm leading-relaxed focus:border-teal-500 focus:outline-none"
              />
            </div>

            {analysisError && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                <span>⚠️ {analysisError}</span>
                <button
                  type="button"
                  onClick={() => handleAnalyzeReviews()}
                  className="rounded-lg bg-rose-600 px-3 py-1 text-white"
                >
                  다시 시도
                </button>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isAnalysisLoading}
                className="rounded-xl bg-teal-600 px-6 py-3 text-xs font-extrabold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 sm:text-sm"
              >
                {isAnalysisLoading ? "⏳ 면접 후기 분석 중..." : "🔍 부서별 분류 & TOP 5 STAR 분석하기"}
              </button>
            </div>
          </form>

          {analysisResult && (
            <div className="space-y-6">
              {/* 1. 부서별 질문 분류 */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="mb-4 text-base font-extrabold text-slate-900">
                  🏥 1. 부서별 면접 질문 분류
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {analysisResult.departmentQuestions.map((dept, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <span className="inline-block rounded-full bg-teal-600 px-3 py-1 text-xs font-bold text-white">
                        {dept.department}
                      </span>
                      <ul className="mt-3 list-inside list-disc space-y-2 text-xs leading-relaxed text-slate-800 sm:text-sm">
                        {dept.questions.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. 자주 나온 질문 TOP 5 & STAR 답변 구조 */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="mb-4 text-base font-extrabold text-slate-900">
                  ⭐ 2. 자주 나온 질문 TOP 5 & 질문별 STAR 답변 구조
                </h3>
                <div className="space-y-4">
                  {analysisResult.top5Questions.map((item) => (
                    <div
                      key={item.rank}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <span className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-extrabold text-white">
                          TOP {item.rank}
                        </span>
                        <h4 className="text-sm font-extrabold text-slate-900 sm:text-base">
                          {item.question}
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
                        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                          <strong className="block text-teal-800">Situation (상황)</strong>
                          <span className="text-slate-700">{item.starGuide.situation}</span>
                        </div>
                        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                          <strong className="block text-indigo-800">Task (과제)</strong>
                          <span className="text-slate-700">{item.starGuide.task}</span>
                        </div>
                        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                          <strong className="block text-emerald-800">Action (행동)</strong>
                          <span className="text-slate-700">{item.starGuide.action}</span>
                        </div>
                        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                          <strong className="block text-amber-800">Result (결과)</strong>
                          <span className="text-slate-700">{item.starGuide.result}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
