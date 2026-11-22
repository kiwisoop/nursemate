"use client";

import React, { useState } from "react";
import QuestionCard from "@/components/QuestionCard";
import { StudyQuestion, saveWrongNote } from "@/lib/storage";

interface SummaryItem {
  heading: string;
  content: string;
}

interface SummaryNoteData {
  title: string;
  keyTable: Array<{
    category: string;
    corePoint: string;
    nursingIntervention: string;
  }>;
  memoryPoints: string[];
  cautionNote: string;
}

interface ScheduleData {
  strategy: string;
  schedule: Array<{
    date: string;
    subject: string;
    topic: string;
    hours: string;
    goal: string;
  }>;
}

/**
 * 마크다운 **굵게** 텍스트를 깔끔하게 렌더링하는 헬퍼
 */
function renderBoldMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="rounded bg-amber-100/80 px-1 font-extrabold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

/**
 * 3페이지 분량의 샘플 성인간호학 강의록 PDF File 생성기 (단계 2 검증 및 원클릭 체험용)
 */
function createSampleNursingPdfFile(): File {
  const samplePages = [
    `성인간호학 호흡기계 및 산소화 간호 강의록 (1페이지)

만성폐쇄성폐질환(COPD) 환자는 만성적인 기도 염증과 기류 제한으로 인해 호흡곤란과 고탄산혈증이 나타난다. COPD 환자에게 고농도 산소를 급격히 투여하면 저산소성 호흡 자극이 소실되어 호흡억제(CO2 narcosis)가 발생할 수 있으므로 비강 캐뉼라로 1~2L/min의 저농도 산소를 투여하고 입술 오므리기 호흡(Pursed-lip breathing)을 교육한다.

호흡곤란 환자의 가장 우선적인 간호중재는 반좌위(Semi-Fowler's position) 또는 기좌호흡위(Orthopneic position)를 취해주어 횡격막 하강과 폐 확장을 돕는 것이다.`,
    `성인간호학 순환기계 및 혈전 예방 간호 강의록 (2페이지)

심부정맥혈전증(DVT)은 수술 후 장기 부동 환자에서 정맥 혈류 정체와 과응고 상태로 인해 주로 하지 심부정맥에 혈전이 형성되는 질환이다. DVT 예방을 위한 최우선 간호중재는 수술 후 조기 이상(Early ambulation)을 격려하고 간헐적 공기압박기(IPC) 또는 탄력스타킹을 적용하며 하지 거상 및 발목 펌프 운동을 시행하는 것이다.

만약 DVT가 확진된 환자에게는 색전증(폐색전증) 위험이 있으므로 절대 환측 다리를 마사지하지 않으며 침상 안정을 유지하고 처방된 항응고제(Heparin, Warfarin) 투여 시 출혈 징후를 면밀히 사정한다.`,
    `성인간호학 수혈 간호 및 환자안전 관리 강의록 (3페이지)

수혈 전 간호사는 반드시 2인의 의료진이 함께 혈액형(ABO, Rh), 혈액번호, 유통기한, 환자 이름과 등록번호를 교차 확인해야 하며, 수혈 시작 후 처음 15분 동안은 15~20gtt/min의 느린 속도로 주입하면서 용혈성 수혈부작용 여부를 집중 관찰한다.

수혈 중 환자가 오한, 발열, 요통, 호흡곤란, 빈맥 등 급성 수혈부작용 증상을 호소할 경우 가장 우선적인 간호중재는 즉시 수혈을 중단하고, 새로운 수액세트로 교체하여 0.9% 생리식염수(Normal Saline)로 정맥로를 확보한 뒤 활력징후를 사정하고 주치의에게 보고하는 것이다.`,
  ];

  const rawContent = samplePages.join("\n[PAGE_SPLIT]\n");
  return new File([rawContent], "성인간호학_호흡순환수혈_강의록_샘플.pdf", {
    type: "application/pdf",
  });
}

export default function StudyPage() {
  // 입력 폼 상태
  const [subject, setSubject] = useState("성인간호학");
  const [unit, setUnit] = useState("호흡·순환기 및 수혈 환자안전 간호");
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // 로딩 및 오류 상태
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 생성된 학습 데이터 상태
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [truncatedNotice, setTruncatedNotice] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState<{ total: number; used: number } | null>(null);
  const [extractedTextForNote, setExtractedTextForNote] = useState<string>("");

  // 기능 B-1: [다시 설명] 상태
  const [reExplainLoadingId, setReExplainLoadingId] = useState<number | null>(null);
  const [reExplainData, setReExplainData] = useState<{
    targetQuestionId: number;
    easyExplanation: string;
    questions: StudyQuestion[];
  } | null>(null);
  const [similarAnswers, setSimilarAnswers] = useState<Record<number, number>>({});

  // 기능 B-2: [요약노트] 상태
  const [isNoteLoading, setIsNoteLoading] = useState(false);
  const [summaryNote, setSummaryNote] = useState<SummaryNoteData | null>(null);

  // 기능 B-3: [일정표] 상태
  const [examDate, setExamDate] = useState("2026-12-15");
  const [dailyHours, setDailyHours] = useState(4);
  const [weakSubjects, setWeakSubjects] = useState("성인간호학, 약리학, 기본간호학");
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);

  // 샘플 PDF 불러오기
  const handleLoadSamplePdf = () => {
    const sample = createSampleNursingPdfFile();
    setPdfFile(sample);
    setSubject("성인간호학");
    setUnit("호흡·순환기 및 수혈 환자안전 간호");
    setErrorMessage(null);
  };

  // 강의록 업로드 및 국시형 문제 10문항 생성 요청
  const handleGenerateStudy = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    if (!subject.trim() || !unit.trim()) {
      setErrorMessage("과목명과 단원명을 모두 입력해 주세요.");
      return;
    }

    if (!pdfFile) {
      setErrorMessage("강의록 PDF 파일을 선택하거나 [샘플 강의록 PDF 불러오기]를 눌러주세요.");
      return;
    }

    if (pdfFile.size > 20 * 1024 * 1024) {
      setErrorMessage("PDF 파일 크기는 최대 20MB까지 업로드할 수 있습니다.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setReExplainData(null);

    try {
      const formData = new FormData();
      formData.append("subject", subject.trim());
      formData.append("unit", unit.trim());
      formData.append("file", pdfFile);

      const res = await fetch("/api/study", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "강의록 문제 생성에 실패했습니다.");
      }

      setSummary(data.summary || []);
      setQuestions(data.questions || []);
      setCurrentIdx(0);
      setSelectedAnswers({});
      setTruncatedNotice(data.truncatedNotice || null);
      setPageInfo({ total: data.totalPages || 1, used: data.usedPages || 1 });
      setExtractedTextForNote(data.extractedTextForNote || "");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "오류가 발생했습니다. 입력값은 유지되오니 다시 시도해 주세요."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 문항 보기 선택 처리 (오답 시 localStorage 오답노트 자동 저장)
  const handleSelectChoice = (question: StudyQuestion, choiceNum: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [question.id]: choiceNum }));
    if (choiceNum !== question.answer) {
      saveWrongNote(subject, unit, question, choiceNum);
    }
  };

  // 기능 B-1: [다시 설명] 호출
  const handleRequestReExplain = async (question: StudyQuestion) => {
    if (reExplainLoadingId !== null) return;
    setReExplainLoadingId(question.id);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "wrong_review",
          question,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "다시 설명 생성 중 오류가 발생했습니다.");
      }
      setReExplainData({
        targetQuestionId: question.id,
        easyExplanation: data.easyExplanation,
        questions: data.questions || [],
      });
      setSimilarAnswers({});
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "다시 설명 요청에 실패했습니다."
      );
    } finally {
      setReExplainLoadingId(null);
    }
  };

  // 기능 B-2: [요약노트] 호출
  const handleGenerateSummaryNote = async () => {
    if (isNoteLoading) return;
    setIsNoteLoading(true);
    setErrorMessage(null);

    const baseContent =
      extractedTextForNote ||
      summary.map((s) => `${s.heading}\n${s.content}`).join("\n\n") ||
      `${subject} ${unit} 핵심 강의 내용`;

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "summary_note",
          content: baseContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "요약노트 생성에 실패했습니다.");
      }
      setSummaryNote(data);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "요약노트 생성 중 오류가 발생했습니다."
      );
    } finally {
      setIsNoteLoading(false);
    }
  };

  // 기능 B-3: [일정표] 호출
  const handleGenerateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isScheduleLoading) return;

    if (!examDate.trim() || dailyHours <= 0 || !weakSubjects.trim()) {
      setErrorMessage("시험일, 하루 공부 시간, 약한 과목을 모두 입력해 주세요.");
      return;
    }

    setIsScheduleLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "schedule",
          examDate,
          dailyHours,
          weakSubjects,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "학습 일정표 생성에 실패했습니다.");
      }
      setScheduleData(data);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "일정표 생성 중 오류가 발생했습니다."
      );
    } finally {
      setIsScheduleLoading(false);
    }
  };

  const currentQuestion = questions[currentIdx];
  const answeredCount = Object.keys(selectedAnswers).length;
  const correctCount = questions.filter((q) => selectedAnswers[q.id] === q.answer).length;

  return (
    <div className="space-y-8">
      {/* 상단 페이지 제목 */}
      <div className="no-print space-y-2">
        <span className="inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-extrabold text-teal-800">
          기능 A · B | 강의록 기반 학습 & 시험 직전 정리
        </span>
        <h1 className="text-2xl font-extrabold text-slate-900">
          📄 강의록 PDF → 요약 · 국시형 10문항 · 오답 복습
        </h1>
        <p className="text-xs text-slate-600 sm:text-sm">
          강의록 PDF를 업로드하면 페이지 번호(p.N)를 보존하여 핵심 요약과 사례 중심 5지선다 10문항을 출제합니다.
        </p>
      </div>

      {/* 6-4. 저작권 및 개인정보 필수 안내 배너 */}
      <div className="no-print rounded-xl border border-teal-200 bg-teal-50/80 p-4 text-xs font-semibold text-teal-900 sm:text-sm">
        🔒 본인 학습용 자료만 올려주세요. 국시 기출 원문은 저장·공유하지 않습니다. (업로드된 PDF는 서버에 저장되지 않고 문제 생성 직후 메모리에서 즉시 폐기됩니다)
      </div>

      {/* PDF 업로드 폼 */}
      <form
        onSubmit={handleGenerateStudy}
        className="no-print space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              과목명 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="예: 성인간호학, 기본간호학, 아동간호학"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              단원명 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="예: 호흡기계 COPD 간호, 수혈 간호"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold text-slate-700">
              강의록 PDF 파일 (최대 20MB) <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleLoadSamplePdf}
              className="rounded-lg bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100"
            >
              ✨ 샘플 성인간호학 강의록 PDF(3p) 불러오기
            </button>
          </div>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setPdfFile(f);
              setErrorMessage(null);
            }}
            className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:border-teal-400"
          />
          {pdfFile && (
            <p className="mt-1.5 text-xs font-semibold text-teal-700">
              ✅ 선택된 파일: {pdfFile.name} ({(pdfFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* 오류 안내 및 [다시 시도] 버튼 (7장 오류 처리 준수) */}
        {errorMessage && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 sm:text-sm">
            <span>⚠️ {errorMessage}</span>
            <button
              type="button"
              onClick={() => handleGenerateStudy()}
              disabled={isLoading}
              className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
            >
              다시 시도
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-xl bg-teal-600 px-6 py-3 text-xs font-extrabold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50 sm:text-sm"
          >
            {isLoading
              ? "⏳ PDF 텍스트 추출 및 국시형 10문항 생성 중..."
              : "🚀 요약 + 국시형 10문항 생성하기"}
          </button>

          <button
            type="button"
            onClick={handleGenerateSummaryNote}
            disabled={isNoteLoading}
            className="rounded-xl border border-teal-300 bg-teal-50 px-4 py-3 text-xs font-bold text-teal-800 hover:bg-teal-100 disabled:opacity-50 sm:text-sm"
          >
            {isNoteLoading ? "요약노트 작성 중..." : "📝 [요약노트] A4 1장 핵심 정리 생성"}
          </button>
        </div>
      </form>

      {/* 긴 PDF 절단 안내 배너 (7장 준수: "앞 N페이지만 사용했습니다") */}
      {truncatedNotice && (
        <div className="no-print rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs font-bold text-amber-900 sm:text-sm">
          ℹ️ 긴 PDF 안내: 모델 입력 한도에 맞춰 <strong>{truncatedNotice}</strong> (전체 {pageInfo?.total}p 중 {pageInfo?.used}p 반영)
        </div>
      )}

      {/* 1. 소제목별 요약 출력 */}
      {summary.length > 0 && (
        <section className="no-print space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                📌 [{subject}] {unit} — 소제목별 핵심 요약
              </h2>
              <p className="text-xs text-slate-500">
                시험에 나올 만한 핵심 개념은 <strong>굵게</strong> 표시됩니다.
              </p>
            </div>
            {pageInfo && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                분석된 페이지: 총 {pageInfo.used}페이지
              </span>
            )}
          </div>

          <div className="space-y-4">
            {summary.map((item, idx) => (
              <div key={idx} className="rounded-xl bg-slate-50 p-4">
                <h3 className="mb-2 text-sm font-extrabold text-teal-900">
                  {item.heading}
                </h3>
                <div className="whitespace-pre-line text-xs leading-relaxed text-slate-700 sm:text-sm">
                  {renderBoldMarkdown(item.content)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. 국시형 5지선다 10문항 (한 문항씩 표시) */}
      {questions.length > 0 && currentQuestion && (
        <section className="no-print space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 sm:text-lg">
                ✍️ 국시형 5지선다 문제 풀이 ({currentIdx + 1} / {questions.length})
              </h2>
              <p className="text-xs text-slate-500">
                진행 현황: {answeredCount}문항 풀이 완료 (정답 {correctCount}개) · 틀린 문제는 내 기록(/my)에 자동 저장됩니다.
              </p>
            </div>

            {/* 문항 번호 바로가기 버튼 */}
            <div className="flex flex-wrap gap-1.5">
              {questions.map((q, idx) => {
                const ans = selectedAnswers[q.id];
                const isCurrent = idx === currentIdx;
                let pillClass = "bg-slate-100 text-slate-700 hover:bg-slate-200";
                if (ans !== undefined) {
                  pillClass =
                    ans === q.answer
                      ? "bg-emerald-600 text-white"
                      : "bg-rose-600 text-white";
                }
                if (isCurrent) {
                  pillClass += " ring-2 ring-teal-600 ring-offset-1";
                }
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentIdx(idx);
                      setReExplainData(null);
                    }}
                    className={`h-8 w-8 rounded-lg text-xs font-extrabold transition ${pillClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 현재 문항 카드 */}
          <QuestionCard
            question={currentQuestion}
            selectedChoice={selectedAnswers[currentQuestion.id] ?? null}
            onSelectChoice={(choiceNum) => handleSelectChoice(currentQuestion, choiceNum)}
            onRequestReExplain={handleRequestReExplain}
            isReExplaining={reExplainLoadingId === currentQuestion.id}
            indexLabel={`국시형 문항 ${currentIdx + 1} / ${questions.length}`}
          />

          {/* 이전 / 다음 문항 이동 버튼 */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setCurrentIdx((prev) => Math.max(0, prev - 1));
                setReExplainData(null);
              }}
              disabled={currentIdx === 0}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 sm:text-sm"
            >
              ← 이전 문항
            </button>
            <span className="text-xs font-bold text-slate-500">
              {currentIdx + 1} / {questions.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1));
                setReExplainData(null);
              }}
              disabled={currentIdx === questions.length - 1}
              className="rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-40 sm:text-sm"
            >
              다음 문항 →
            </button>
          </div>
        </section>
      )}

      {/* 기능 B-1: [다시 설명] 쉬운 개념 설명 + 유사문제 3개 */}
      {reExplainData && (
        <section className="no-print space-y-4 rounded-2xl border-2 border-teal-500 bg-teal-50/40 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-teal-950 sm:text-lg">
              💡 [다시 설명] 문항 {reExplainData.targetQuestionId}번 핵심 개념 쉬운 해설 & 유사문제 3개
            </h3>
            <button
              type="button"
              onClick={() => setReExplainData(null)}
              className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
            >
              닫기
            </button>
          </div>

          <div className="rounded-xl bg-white p-4 text-xs leading-relaxed text-slate-800 shadow-sm sm:text-sm">
            <div className="whitespace-pre-line">
              {renderBoldMarkdown(reExplainData.easyExplanation)}
            </div>
          </div>

          <div className="space-y-4">
            {reExplainData.questions.map((simQ, idx) => (
              <QuestionCard
                key={simQ.id || idx}
                question={simQ}
                selectedChoice={similarAnswers[idx] ?? null}
                onSelectChoice={(choiceNum) =>
                  setSimilarAnswers((prev) => ({ ...prev, [idx]: choiceNum }))
                }
                indexLabel={`유사문제 ${idx + 1} / 3`}
              />
            ))}
          </div>
        </section>
      )}

      {/* 기능 B-2: A4 1장 분량 [요약노트] (인쇄용 CSS 적용) */}
      {summaryNote && (
        <section className="a4-print-sheet space-y-4 rounded-2xl border-2 border-slate-300 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <span className="rounded bg-teal-700 px-2 py-0.5 text-[11px] font-bold text-white">
                A4 1장 시험 직전 요약노트
              </span>
              <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                {summaryNote.title} ({subject} - {unit})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
            >
              🖨️ A4 1장으로 인쇄 / PDF 저장
            </button>
          </div>

          {/* 핵심 요약 표 */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300 text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-teal-50 text-teal-950">
                  <th className="border border-slate-300 px-3 py-2 font-bold">구분 / 개념</th>
                  <th className="border border-slate-300 px-3 py-2 font-bold">시험 핵심 내용</th>
                  <th className="border border-slate-300 px-3 py-2 font-bold">최우선 간호중재 · 기준</th>
                </tr>
              </thead>
              <tbody>
                {summaryNote.keyTable.map((row, idx) => (
                  <tr key={idx} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border border-slate-300 px-3 py-2 font-bold text-slate-900">
                      {row.category}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-800">
                      {row.corePoint}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 font-medium text-teal-900">
                      {row.nursingIntervention}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 필수 암기 포인트 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-2 text-sm font-extrabold text-slate-900">
              ⚡ 시험장 들어가기 직전 필수 암기 포인트
            </h3>
            <ul className="space-y-1.5 text-xs font-medium text-slate-800 sm:text-sm">
              {summaryNote.memoryPoints.map((pt, i) => (
                <li key={i}>{pt}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900">
            ⚠️ 단골 오답 주의: {summaryNote.cautionNote}
          </div>
        </section>
      )}

      {/* 기능 B-3: 시험 대비 [일정표] 생성기 */}
      <section className="no-print space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            📅 [일정표] 시험 대비 맞춤형 학습 계획표 만들기
          </h2>
          <p className="text-xs text-slate-500">
            시험일, 하루 공부 가능 시간, 취약 과목을 입력하면 날짜별 복습 일정표를 표로 짜드립니다.
          </p>
        </div>

        <form onSubmit={handleGenerateSchedule} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">시험일</label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">
              하루 공부 시간 (시간)
            </label>
            <input
              type="number"
              min={1}
              max={16}
              value={dailyHours}
              onChange={(e) => setDailyHours(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">
              약한 과목 (쉼표로 구분)
            </label>
            <input
              type="text"
              value={weakSubjects}
              onChange={(e) => setWeakSubjects(e.target.value)}
              placeholder="예: 성인간호학, 약리학"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isScheduleLoading}
              className="w-full rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 sm:text-sm"
            >
              {isScheduleLoading ? "일정표 생성 중..." : "일정표 짜기"}
            </button>
          </div>
        </form>

        {scheduleData && (
          <div className="space-y-3 pt-2">
            <div className="rounded-xl bg-teal-50 p-3.5 text-xs font-semibold text-teal-900 sm:text-sm">
              🎯 학습 전략: {scheduleData.strategy}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-200 text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="border border-slate-200 px-3 py-2 font-bold">날짜/일차</th>
                    <th className="border border-slate-200 px-3 py-2 font-bold">집중 과목</th>
                    <th className="border border-slate-200 px-3 py-2 font-bold">학습 내용</th>
                    <th className="border border-slate-200 px-3 py-2 font-bold">시간</th>
                    <th className="border border-slate-200 px-3 py-2 font-bold">목표</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.schedule.map((item, idx) => (
                    <tr key={idx} className="odd:bg-white even:bg-slate-50">
                      <td className="border border-slate-200 px-3 py-2 font-bold text-teal-800">
                        {item.date}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 font-semibold">
                        {item.subject}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">{item.topic}</td>
                      <td className="border border-slate-200 px-3 py-2">{item.hours}</td>
                      <td className="border border-slate-200 px-3 py-2 text-slate-600">
                        {item.goal}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
