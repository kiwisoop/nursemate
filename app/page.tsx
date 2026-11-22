import React from "react";
import Link from "next/link";

const GRADE_CARDS = [
  {
    grade: "1~2학년 추천",
    badgeColor: "bg-emerald-100 text-emerald-800",
    borderColor: "hover:border-emerald-500",
    title: "의학용어 어원 & 임상 약어 30선",
    description:
      "해부생리학·기본간호학 진입 전 필수! 접두사/어근/접미사 어원 분해 표로 원리를 이해하고, BP·NPO·PRN 등 필수 임상 약어 30개를 퀴즈로 완벽 암기하세요.",
    primaryLink: { href: "/terms", label: "용어·약어 학습 시작하기 →" },
    highlights: ["어원 9종 기본 탑재 + 맞춤 어원 표", "고정 정답 기반 무오류 약어 30문항", "틀린 약어 끝까지 재출제"],
  },
  {
    grade: "2~4학년 추천",
    badgeColor: "bg-teal-100 text-teal-800",
    borderColor: "hover:border-teal-500",
    title: "강의록 PDF → 국시형 5지선다 문제 & 요약",
    description:
      "성인·모성·아동·정신·지역사회 강의록 PDF를 올리면 페이지 번호(p.N) 근거가 달린 소제목 요약과 한국 간호사 국가고시형 사례 문제 10문항을 즉시 만들어 줍니다.",
    primaryLink: { href: "/study", label: "강의록 문제 풀러 가기 →" },
    highlights: ["모든 해설에 근거 페이지(p.N) 표시", "틀린 문제 [다시 설명] + 유사문제 3개", "시험 직전 A4 1장 요약노트 & 일정표"],
  },
  {
    grade: "4학년 · 취준생 추천",
    badgeColor: "bg-indigo-100 text-indigo-800",
    borderColor: "hover:border-indigo-500",
    title: "병원 자소서 첨삭 & 부서별 모의 면접",
    description:
      "없는 사실은 절대 지어내지 않는 정직한 자소서 직무역량 다듬기와, 희망 병원·부서(ICU, ER, 병동 등) 맞춤형 10문항 채팅 면접으로 실전 감각을 완성하세요.",
    primaryLink: { href: "/career/resume", label: "자소서 첨삭 받기 →" },
    secondaryLink: { href: "/career/interview", label: "모의 면접 & 후기 분석 →" },
    highlights: ["수정 전/후 나란히 비교 & 역량 키워드", "인성→직무→상황 대처 10문항 면접", "면접 후기 TOP 5 & STAR 답변 구조"],
  },
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* 히어로 배너 */}
      <section className="rounded-3xl bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-600 p-6 text-white shadow-md sm:p-10">
        <div className="max-w-3xl space-y-4">
          <span className="inline-block rounded-full bg-white/20 px-3.5 py-1 text-xs font-bold tracking-wide text-white backdrop-blur">
            간호학과 학부생 & 신규 간호사 취준생을 위한 AI 파트너
          </span>
          <h1 className="text-2xl font-extrabold leading-tight sm:text-4xl">
            내 강의록과 자소서 초안으로 준비하는
            <br />
            <span className="text-teal-100">국시형 문제 · 의학용어 · 병원 취업</span>
          </h1>
          <p className="text-sm leading-relaxed text-teal-50 sm:text-base">
            NurseMate(널스메이트)는 업로드한 강의록 범위 안에서만 근거 페이지(p.N)와 함께 문제를 출제하고,
            본인이 겪은 실제 실습 경험만을 바탕으로 자기소개서를 다듬어 드립니다.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/study"
              className="rounded-xl bg-white px-5 py-3 text-xs font-extrabold text-teal-800 shadow-sm transition hover:bg-teal-50 sm:text-sm"
            >
              📄 강의록 PDF로 문제 만들기
            </Link>
            <Link
              href="/terms"
              className="rounded-xl bg-teal-800/70 px-5 py-3 text-xs font-bold text-white ring-1 ring-white/30 transition hover:bg-teal-800 sm:text-sm"
            >
              🔤 임상 약어 30개 퀴즈
            </Link>
            <Link
              href="/my"
              className="rounded-xl bg-teal-900/40 px-4 py-3 text-xs font-bold text-teal-50 transition hover:bg-teal-900/60 sm:text-sm"
            >
              📒 내 오답노트 · 기록 보기
            </Link>
          </div>
        </div>
      </section>

      {/* 학년별 추천 기능 카드 (개발 지시서 3장 준수) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">
              🎓 학년별 맞춤 추천 기능
            </h2>
            <p className="text-xs text-slate-500 sm:text-sm">
              현재 학년과 필요한 학습 단계에 맞춰 바로 시작해 보세요.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {GRADE_CARDS.map((card) => (
            <div
              key={card.grade}
              className={`flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all ${card.borderColor}`}
            >
              <div className="space-y-3">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-extrabold ${card.badgeColor}`}
                >
                  {card.grade}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 sm:text-lg">
                  {card.title}
                </h3>
                <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
                  {card.description}
                </p>

                <ul className="space-y-1.5 pt-2 text-xs text-slate-700">
                  {card.highlights.map((h, i) => (
                    <li key={i} className="flex items-center gap-1.5 font-medium">
                      <span className="text-teal-600">✓</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 space-y-2 pt-2">
                <Link
                  href={card.primaryLink.href}
                  className="block w-full rounded-xl bg-teal-600 px-4 py-2.5 text-center text-xs font-bold text-white shadow-sm transition hover:bg-teal-700 sm:text-sm"
                >
                  {card.primaryLink.label}
                </Link>
                {card.secondaryLink && (
                  <Link
                    href={card.secondaryLink.href}
                    className="block w-full rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-center text-xs font-bold text-teal-800 transition hover:bg-teal-100 sm:text-sm"
                  >
                    {card.secondaryLink.label}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 안전·윤리 3대 원칙 안내 카드 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="mb-3 text-sm font-extrabold text-slate-900 sm:text-base">
          🛡️ NurseMate가 지키는 학습 안전 & 윤리 약속
        </h3>
        <div className="grid grid-cols-1 gap-4 text-xs text-slate-600 sm:grid-cols-3 sm:text-sm">
          <div className="rounded-xl bg-slate-50 p-3.5">
            <strong className="mb-1 block text-slate-900">1. 명확한 근거 페이지 표시</strong>
            모든 강의록 문제 해설에는 근거 페이지(p.N)를 표시하며, 자료에 없는 내용은 임의로 출제하지 않습니다.
          </div>
          <div className="rounded-xl bg-slate-50 p-3.5">
            <strong className="mb-1 block text-slate-900">2. 자소서 허위 사실 생성 금지</strong>
            지원자가 작성하지 않은 경험, 수치, 자격증을 새로 지어내지 않고 오직 본인의 경험 문장만 다듬습니다.
          </div>
          <div className="rounded-xl bg-slate-50 p-3.5">
            <strong className="mb-1 block text-slate-900">3. 개인정보 및 원본 미저장</strong>
            업로드한 강의록 PDF와 자기소개서 원문은 서버에 저장되지 않으며 요청 처리 즉시 메모리에서 폐기됩니다.
          </div>
        </div>
      </section>
    </div>
  );
}
