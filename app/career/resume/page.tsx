"use client";

import React, { useState } from "react";
import DiffView from "@/components/DiffView";

interface ResumeReviewResult {
  revisedText: string;
  improvementPoints: string[];
  competencyKeywords: string[];
  followUpQuestions: string[];
}

export default function ResumePage() {
  const [hospital, setHospital] = useState("서울대학교병원");
  const [question, setQuestion] = useState(
    "임상실습 또는 학부 생활 중 환자안전이나 팀워크를 발휘했던 경험을 구체적으로 기술해 주세요."
  );
  const [draft, setDraft] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ResumeReviewResult | null>(null);

  const handleLoadSampleDraft = () => {
    setHospital("서울아산병원");
    setQuestion(
      "임상실습 중 환자의 불편이나 위험 요인을 발견하고 적극적으로 해결하려 노력했던 경험을 작성해 주세요."
    );
    setDraft(
      "성인간호학 내과병동 실습을 할 때 어지럼증을 호소하시는 고령 환자분을 보았습니다. 저는 낙상 위험이 있다고 생각해서 먼저 환자분 곁을 지키며 침상 난간이 올려져 있는지 확인하고 담당 간호사 선생님께 바로 말씀드렸습니다. 그 후 환자분이 화장실에 가실 때 부축을 도왔고 안전한 병동 환경을 만드는 데 보람을 느꼈습니다."
    );
    setErrorMessage(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    if (!hospital.trim() || !question.trim() || !draft.trim()) {
      setErrorMessage("지원 병원명, 자소서 문항, 본인 초안을 모두 입력해 주세요.");
      return;
    }

    if (draft.trim().length < 20) {
      setErrorMessage("정확한 첨삭을 위해 본인 초안을 최소 20자 이상 입력해 주세요.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospital: hospital.trim(),
          question: question.trim(),
          draft: draft.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "자기소개서 첨삭 요청에 실패했습니다.");
      }
      setResult(data);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "첨삭 처리 중 오류가 발생했습니다. 입력값은 유지되오니 다시 시도해 주세요."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 상단 제목 */}
      <div className="space-y-2">
        <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-extrabold text-indigo-800">
          기능 D | 병원 자기소개서 직무역량 첨삭
        </span>
        <h1 className="text-2xl font-extrabold text-slate-900">
          ✍️ 병원 자기소개서 첨삭 (수정 전/후 비교)
        </h1>
        <p className="text-xs text-slate-600 sm:text-sm">
          지원자가 쓰지 않은 경험·수치·자격은 절대 새로 지어내지 않고, 본인의 실제 경험 안에서 간호 직무역량(환자안전, 의사소통, 협업)이 돋보이도록 문장을 다듬어 드립니다.
        </p>
      </div>

      {/* 개인정보 미저장 안내 */}
      <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-xs font-semibold text-slate-700 sm:text-sm">
        🔒 개인정보 보호: 입력하신 자기소개서 초안 및 개인정보(이름, 연락처 등)는 서버나 브라우저 저장소에 절대 저장되지 않으며 첨삭 응답 즉시 폐기됩니다.
      </div>

      {/* 자소서 입력 폼 */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-extrabold text-slate-900">
            1. 지원 병원 및 자소서 초안 입력
          </h2>
          <button
            type="button"
            onClick={handleLoadSampleDraft}
            className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100"
          >
            ✨ 간호학과 실습 자소서 샘플 초안 불러오기
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-700">
            지원 병원명 <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={hospital}
            onChange={(e) => setHospital(e.target.value)}
            placeholder="예: 서울대학교병원, 세브란스병원, 서울아산병원, 삼성서울병원"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-700">
            자기소개서 문항 (양식) <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="예: 지원동기 및 입사 후 포부, 실습 중 환자안전을 실천한 경험 등"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">
              본인 초안 (실제 겪은 사실만 적어주세요) <span className="text-rose-500">*</span>
            </label>
            <span className="text-xs text-slate-500">{draft.length}자</span>
          </div>
          <textarea
            rows={6}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="본인이 실습이나 학부 활동에서 실제로 겪은 상황과 행동을 편하게 적어주세요. (이름, 연락처 등 민감한 개인정보는 입력하지 마세요)"
            className="w-full rounded-xl border border-slate-300 p-3.5 text-sm leading-relaxed focus:border-teal-500 focus:outline-none"
          />
        </div>

        {errorMessage && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800 sm:text-sm">
            <span>⚠️ {errorMessage}</span>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isLoading}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
            >
              다시 시도
            </button>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-xl bg-teal-600 px-6 py-3 text-xs font-extrabold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 sm:text-sm"
          >
            {isLoading ? "⏳ 직무역량 중심 문장 다듬는 중..." : "✨ 자소서 첨삭 및 비교하기"}
          </button>
        </div>
      </form>

      {/* 첨삭 결과 비교 화면 */}
      {result && (
        <DiffView
          originalDraft={draft}
          revisedText={result.revisedText}
          improvementPoints={result.improvementPoints}
          competencyKeywords={result.competencyKeywords}
          followUpQuestions={result.followUpQuestions}
        />
      )}
    </div>
  );
}
