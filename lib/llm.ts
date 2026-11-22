/**
 * LLM 통합 호출 모듈 (개발 지시서 2장, 4장, 6장, 7장 준수)
 * - 모든 LLM API 호출은 오직 이 파일(lib/llm.ts) 한 곳에서만 수행합니다.
 * - 환경변수 LLM_PROVIDER, LLM_MODEL, LLM_API_KEY로 제공자와 모델을 교체할 수 있습니다.
 * - JSON 응답 파싱 실패 시 1회 자동 재시도하며, 그래도 실패하면 명확한 오류를 던집니다.
 * - 개인정보 보호를 위해 사용자 입력 원문을 서버 로그에 절대 남기지 않습니다.
 */

export type LlmProvider = "gemini" | "openai" | "anthropic" | "mock";

export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  apiKey: string;
}

/**
 * 현재 환경변수 설정에서 LLM 구성을 읽어옵니다.
 */
export function getLlmConfig(): LlmConfig {
  const rawProvider = (process.env.LLM_PROVIDER || "gemini").toLowerCase();
  const provider: LlmProvider =
    rawProvider === "openai" || rawProvider === "anthropic" || rawProvider === "mock"
      ? rawProvider
      : "gemini";

  const defaultModels: Record<LlmProvider, string> = {
    gemini: "gemini-2.5-flash",
    openai: "gpt-4o-mini",
    anthropic: "claude-3-5-sonnet-latest",
    mock: "nursemate-korean-nursing-v1",
  };

  const model = process.env.LLM_MODEL || defaultModels[provider];
  const apiKey = process.env.LLM_API_KEY || "";

  return { provider, model, apiKey };
}

/**
 * LLM에 텍스트 프롬프트를 보내고 문자열 응답을 받습니다.
 */
export async function callLlmText(prompt: string, timeoutMs: number = 45000): Promise<string> {
  if (prompt.includes("[SIMULATE_LLM_ERROR]")) {
    throw new Error("LLM 서버 응답 시간이 초과되었거나 일시적인 오류가 발생했습니다.");
  }

  const { provider, model, apiKey } = getLlmConfig();
  const hasRealKey = Boolean(apiKey && apiKey !== "your_api_key_here" && apiKey.trim().length > 5);

  if (provider === "mock" || !hasRealKey) {
    return generateSmartFallbackJson(prompt);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (provider === "gemini") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Gemini API 호출 실패 (상태 코드: ${res.status})`);
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Gemini API로부터 빈 응답을 받았습니다.");
      }
      return text;
    }

    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        throw new Error(`OpenAI API 호출 실패 (상태 코드: ${res.status})`);
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error("OpenAI API로부터 빈 응답을 받았습니다.");
      }
      return text;
    }

    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        throw new Error(`Anthropic API 호출 실패 (상태 코드: ${res.status})`);
      }
      const data = await res.json();
      const text = data?.content?.[0]?.text;
      if (!text) {
        throw new Error("Anthropic API로부터 빈 응답을 받았습니다.");
      }
      return text;
    }

    return generateSmartFallbackJson(prompt);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("LLM 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
    }
    throw err instanceof Error
      ? err
      : new Error("LLM 호출 중 알 수 없는 오류가 발생했습니다.");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * LLM 응답에서 JSON만 추출하여 파싱합니다.
 */
export function parseJsonSafe<T>(rawText: string): T {
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // 중괄호 영역만 추출하여 재파싱 시도
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const sliced = cleaned.slice(firstBrace, lastBrace + 1);
      return JSON.parse(sliced) as T;
    }
    throw new Error("LLM 응답을 JSON으로 변환하지 못했습니다.");
  }
}

/**
 * LLM을 호출하여 JSON으로 파싱합니다.
 * 파싱 실패 시 1회 자동 재시도하며, 그래도 실패하면 오류를 던집니다. (개발 지시서 4-A 준수)
 */
export async function callLlmJson<T>(
  prompt: string,
  customGenerator?: (attempt: number) => Promise<string>
): Promise<T> {
  const runner = customGenerator || (() => callLlmText(prompt));

  try {
    const firstRaw = await runner(1);
    return parseJsonSafe<T>(firstRaw);
  } catch (firstErr) {
    // 호출 자체 에러(타임아웃/강제 시뮬레이션 오류)는 즉시 전달하되, JSON 파싱 실패는 1회 재시도
    if (
      firstErr instanceof Error &&
      (firstErr.message.includes("시간이 초과") || firstErr.message.includes("서버 응답"))
    ) {
      throw firstErr;
    }

    try {
      const retryPrompt = `${prompt}\n\n[주의] 이전 응답이 유효한 JSON이 아니었습니다. 반드시 설명 없이 순수 JSON 객체만 출력하세요.`;
      const secondRaw = customGenerator ? await customGenerator(2) : await callLlmText(retryPrompt);
      return parseJsonSafe<T>(secondRaw);
    } catch {
      throw new Error("AI 응답 형식을 처리하는 중 오류가 발생했습니다. 다시 시도해 주세요.");
    }
  }
}

// ============================================================================
// 로컬 개발 및 데모 환경을 위한 한국 간호학 문맥 기반 스마트 생성기
// (API 키 미설정 시 또는 LLM_PROVIDER=mock 일 때 입력 자료에 근거해 동작)
// ============================================================================

function generateSmartFallbackJson(prompt: string): string {
  // 1. 강의록 요약 및 10문항 생성 (Prompt A)
  if (prompt.includes("[강의 자료]")) {
    return JSON.stringify(buildFallbackStudyResponse(prompt));
  }

  // 2. 오답 복습 (Prompt B-1)
  if (prompt.includes("[오답 복습]")) {
    return JSON.stringify(buildFallbackWrongReview(prompt));
  }

  // 3. 요약노트 (Prompt B-2)
  if (prompt.includes("[요약노트]")) {
    return JSON.stringify(buildFallbackSummaryNote(prompt));
  }

  // 4. 일정표 (Prompt B-3)
  if (prompt.includes("[일정표]")) {
    return JSON.stringify(buildFallbackSchedule(prompt));
  }

  // 5. 의학용어 어원 표 (Prompt C)
  if (prompt.includes("의학용어를 접두사/어근/접미사로 분해해")) {
    return JSON.stringify(buildFallbackTerms(prompt));
  }

  // 6. 자기소개서 첨삭 (Prompt D)
  if (prompt.includes("자기소개서 문항과 지원자가 쓴 초안")) {
    return JSON.stringify(buildFallbackResume(prompt));
  }

  // 7. 모의 면접 채팅 (Prompt E-1)
  if (prompt.includes("[모의 면접]")) {
    return JSON.stringify(buildFallbackInterviewChat(prompt));
  }

  // 8. 면접 후기 분석 (Prompt E-2)
  if (prompt.includes("[후기 분석]")) {
    return JSON.stringify(buildFallbackInterviewReview(prompt));
  }

  // 9. 기본 헬스체크 / 테스트 API 응답
  return JSON.stringify({
    status: "ok",
    message: "NurseMate AI 엔진이 정상적으로 응답했습니다.",
  });
}

function buildFallbackStudyResponse(prompt: string) {
  const lectureSplit = prompt.split("[강의 자료]");
  const lectureText = lectureSplit[1] ? lectureSplit[1].trim() : "";

  // 강의 자료 내의 [p.N] 문단들을 파싱
  const lineMatches = Array.from(lectureText.matchAll(/\[p\.(\d+)\]\s*([^\n]+)/g));
  const parsedLines =
    lineMatches.length > 0
      ? lineMatches.map((m) => ({
          page: Number(m[1]) || 1,
          text: m[2].trim(),
        }))
      : [{ page: 1, text: lectureText || "기본 간호학 활력징후 및 환자안전 간호중재 핵심 개념" }];

  const availablePages = Array.from(new Set(parsedLines.map((l) => l.page)));

  // 소제목별 요약 구성 (입력 텍스트 기반)
  const summary = [];
  const chunkSize = Math.max(1, Math.ceil(parsedLines.length / 3));
  for (let i = 0; i < parsedLines.length; i += chunkSize) {
    const slice = parsedLines.slice(i, i + chunkSize);
    const pagesLabel = Array.from(new Set(slice.map((s) => `p.${s.page}`))).join(", ");
    const combinedText = slice
      .map((s) => {
        // 첫 핵심 어구를 굵게 강조
        const words = s.text.split(" ");
        if (words.length >= 3) {
          return `- **[p.${s.page}] ${words.slice(0, 3).join(" ")}**: ${words.slice(3).join(" ")}`;
        }
        return `- **[p.${s.page}] 핵심 개념**: ${s.text}`;
      })
      .join("\n");

    summary.push({
      heading: `핵심 요약 ${summary.length + 1} (${pagesLabel})`,
      content: combinedText,
    });
  }

  // 국시형 5지선다 10문항 생성 (자료의 실제 문장과 페이지 번호를 근거로 매핑)
  const clinicalTemplates = [
    {
      scenario: "입원 중인 환자의 상태를 사정하던 중 강의록에 제시된 주요 임상 징후가 관찰되었다.",
      ask: "이 환자에게 가장 우선적으로 수행해야 할 간호중재 또는 옳은 설명은?",
      distractors: [
        "처방 없이 진통제를 즉시 증량하여 투여한다.",
        "활력징후 측정을 중단하고 24시간 뒤 재평가한다.",
        "환자를 평평한 앙와위로 눕히고 수분 섭취를 강제한다.",
        "보고 없이 기존 처치를 임의로 변경한다.",
      ],
    },
    {
      scenario: "병동 실습 중인 간호학생이 해당 단원의 핵심 병태생리와 간호 사정 기준을 학습하고 있다.",
      ask: "강의 자료에 근거할 때 다음 중 가장 옳은 설명은?",
      distractors: [
        "정상 범위를 벗어난 활력징후는 기록하지 않아도 된다.",
        "무균술이 필요한 처치 시 손위생을 생략할 수 있다.",
        "환자 확인은 병실 호실 번호만으로 수행한다.",
        "산소포화도 저하 시 산소 공급을 즉시 중단한다.",
      ],
    },
    {
      scenario: "응급실에 내원한 환자가 해당 단원과 관련된 증상을 호소하고 있어 초기 간호사정을 시행하였다.",
      ask: "강의 자료의 근거에 부합하는 최우선 간호 판단은?",
      distractors: [
        "환자의 주관적 통증 호소는 사정 기록에서 제외한다.",
        "검사 결과가 나올 때까지 기도 유지 사정을 보류한다.",
        "금식(NPO) 처방 환자에게 경구 수분 섭취를 권장한다.",
        "낙상 고위험 환자의 침상 난간을 모두 내려둔다.",
      ],
    },
  ];

  const questions = Array.from({ length: 10 }, (_, idx) => {
    const qNum = idx + 1;
    const sourceLine = parsedLines[idx % parsedLines.length];
    const secondLine = parsedLines[(idx + 1) % parsedLines.length];
    const tpl = clinicalTemplates[idx % clinicalTemplates.length];

    const correctChoiceIndex = (idx % 5) + 1; // 1 ~ 5 골고루 분포
    const circledNumbers = ["①", "②", "③", "④", "⑤"];

    const correctStatement =
      sourceLine.text.length > 10
        ? sourceLine.text.slice(0, 95)
        : `강의 자료(p.${sourceLine.page})에 제시된 표준 간호중재 지침에 따라 환자 상태를 사정하고 보고한다.`;

    const choices: string[] = [];
    let distractorIdx = 0;
    for (let c = 1; c <= 5; c++) {
      if (c === correctChoiceIndex) {
        choices.push(`${circledNumbers[c - 1]} ${correctStatement}`);
      } else {
        choices.push(`${circledNumbers[c - 1]} ${tpl.distractors[distractorIdx % tpl.distractors.length]}`);
        distractorIdx++;
      }
    }

    const pages = Array.from(
      new Set([sourceLine.page, secondLine ? secondLine.page : sourceLine.page])
    ).filter((p) => availablePages.includes(p));

    return {
      id: qNum,
      stem: `[문항 ${qNum}] ${tpl.scenario} ${tpl.ask}`,
      choices,
      answer: correctChoiceIndex,
      explanation: `강의 자료 p.${pages.join(", p.")}에 따르면 "${correctStatement}"이(가) 핵심 근거입니다. 나머지 보기는 환자안전 원칙 및 강의록의 내용과 상충하므로 오답입니다.`,
      sourcePages: pages.length > 0 ? pages : [1],
    };
  });

  return { summary, questions };
}

function buildFallbackWrongReview(prompt: string) {
  const wrongPart = prompt.split("[틀린 문제]")[1] || prompt;
  const pageMatch = wrongPart.match(/"sourcePages"\s*:\s*\[([\d,\s]+)\]/);
  const pages = pageMatch
    ? pageMatch[1]
        .split(",")
        .map((n) => Number(n.trim()))
        .filter((n) => !isNaN(n) && n > 0)
    : [1];
  const basePage = pages.length > 0 ? pages[0] : 1;

  return {
    easyExplanation:
      "이 문제의 핵심은 **환자안전과 우선순위 간호사정(ABC 원칙 및 강의록 핵심 지침)**입니다.\n\n- **핵심 포인트 1**: 환자의 증상이나 징후가 변화할 때는 임의로 처치를 중단하지 않고 **활력징후와 핵심 징후를 먼저 사정**합니다.\n- **핵심 포인트 2**: 강의록(p." +
      basePage +
      ")에 명시된 근거 기준을 적용하여 가장 비침습적이고 즉각적인 간호중재를 먼저 선택해야 합니다.",
    questions: [
      {
        id: 1,
        stem: "[유사문제 1] 동일한 개념을 적용할 때, 환자 상태 변화 발견 시 간호사가 가장 먼저 수행해야 할 행동은?",
        choices: [
          "① 강의 자료의 지침에 따라 즉각 활력징후와 주요 증상을 사정한다.",
          "② 다음 근무조 인계 시간까지 기다렸다가 보고한다.",
          "③ 처방 없이 약물 용량을 두 배로 증량한다.",
          "④ 보호자에게 환자 관찰을 전적으로 위임한다.",
          "⑤ 의무기록 작성만 하고 환자 사정은 생략한다.",
        ],
        answer: 1,
        explanation: `강의록 p.${basePage}의 핵심 개념과 동일하게 환자 상태 변화 시 즉각적인 사정이 최우선입니다.`,
        sourcePages: [basePage],
      },
      {
        id: 2,
        stem: "[유사문제 2] 해당 단원의 간호중재를 수행할 때 환자안전을 위해 반드시 확인해야 할 항목으로 옳은 것은?",
        choices: [
          "① 구두 기억에만 의존하여 투약한다.",
          "② 손위생과 정확한 환자 확인 절차를 준수하고 근거 기반 중재를 시행한다.",
          "③ 금기사항 확인 없이 침습적 처치를 강행한다.",
          "④ 이상 소견이 있어도 정상으로 기록한다.",
          "⑤ 환자 교육 없이 퇴원 조치를 완료한다.",
        ],
        answer: 2,
        explanation: `강의록 p.${basePage}에 근거하여 표준 간호 절차와 환자 확인이 필수적입니다.`,
        sourcePages: [basePage],
      },
      {
        id: 3,
        stem: "[유사문제 3] 실습 중 지도교수님이 해당 개념의 임상적 근거를 질문하셨을 때 가장 적절한 답변은?",
        choices: [
          "① 주관적 추측만으로 간호중재를 결정합니다.",
          "② 환자 사정 결과와 관계없이 동일한 처치를 반복합니다.",
          "③ 강의록에 제시된 병태생리적 근거와 우선순위에 따라 중재를 계획하고 평가합니다.",
          "④ 처방 확인 절차를 생략하여 시간을 단축합니다.",
          "⑤ 부작용 모니터링은 퇴원 후에만 실시합니다.",
        ],
        answer: 3,
        explanation: `강의록 p.${basePage}의 병태생리 및 간호과정(사정-진단-계획-수행-평가) 근거에 부합합니다.`,
        sourcePages: [basePage],
      },
    ],
  };
}

function buildFallbackSummaryNote(prompt: string) {
  const raw = prompt.split("[자료]")[1]?.trim() || "간호학 핵심 강의록";
  const snippets = raw
    .split("\n")
    .map((s) => s.replace(/\[p\.\d+\]/g, "").trim())
    .filter((s) => s.length > 5)
    .slice(0, 5);

  return {
    title: "시험 직전 A4 핵심 요약노트",
    keyTable: [
      {
        category: "1. 핵심 병태생리 및 사정",
        corePoint: snippets[0] || "활력징후(BP, HR, RR, BT) 및 주요 임상 증상 초기 사정",
        nursingIntervention: "이상 징후 발견 시 즉각 사정 후 주치의 보고 및 기록",
      },
      {
        category: "2. 최우선 간호중재",
        corePoint: snippets[1] || "기도 유지(Airway), 호흡(Breathing), 순환(Circulation) 우선순위 적용",
        nursingIntervention: "산소포화도 모니터링, 체위 변경(반좌위 등), 투약 5 Rights 준수",
      },
      {
        category: "3. 합병증 예방 및 환자안전",
        corePoint: snippets[2] || "감염 예방(무균술), 낙상 예방, 욕창 및 심부정맥혈전증(DVT) 예방",
        nursingIntervention: "손위생 철저, 침상 난간 올리기, 조기 이상 격려",
      },
      {
        category: "4. 환자 및 보호자 교육",
        corePoint: snippets[3] || "퇴원 후 자가간호 및 위험 증상 발생 시 내원 기준 안내",
        nursingIntervention: "이해하기 쉬운 용어로 설명 후 Teach-back(되묻기)으로 이해도 확인",
      },
    ],
    memoryPoints: [
      "★ 국시 단골 1순위: 환자 상태 급변 시 '즉시 사정(V/S 측정)'이 '임의 처치'보다 항상 우선!",
      "★ 호흡곤란 환자 기본 체위: 반좌위(Semi-Fowler's position) 또는 기좌호흡위(Orthopneic position)",
      "★ 투약 전 필수 확인: 5 Rights (정확한 환자, 약물, 용량, 경로, 시간) + 알레르기 유무",
      "★ 불확실한 수치는 반드시 담당 교수님 강의록 원문 페이지(p.N)와 전공 교재로 최종 대조할 것",
    ],
    cautionNote:
      "오답 선지에 '즉시 처방 없이 증량', '앙와위 유지', '관찰 보류'가 나오면 95% 이상 오답이므로 주의하세요!",
  };
}

function buildFallbackSchedule(prompt: string) {
  const dateMatch = prompt.match(/시험일은 \[([^\]]+)\]/);
  const hoursMatch = prompt.match(/하루 \[(\d+)시간\]/);
  const subjectsMatch = prompt.match(/약한 과목은 \[([^\]]+)\]/);

  const examDate = dateMatch ? dateMatch[1] : "시험일";
  const dailyHours = hoursMatch ? Number(hoursMatch[1]) : 4;
  const subjects = subjectsMatch
    ? subjectsMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : ["성인간호학", "기본간호학", "약리학"];

  if (subjects.length === 0) subjects.push("성인간호학");

  const schedule = Array.from({ length: 7 }, (_, i) => {
    const subj = subjects[i % subjects.length];
    const phase =
      i < 3 ? "개념 총정리 및 강의록 요약" : i < 5 ? "국시형 문제 풀이 및 오답노트" : "최종 약점 보완 및 A4 요약노트 암기";
    return {
      date: `D-${7 - i} (${i + 1}일차)`,
      subject: subj,
      topic: `${subj} ${phase}`,
      hours: `${dailyHours}시간`,
      goal:
        i === 6
          ? `시험(${examDate}) 전 오답노트 100% 복습 완료`
          : `${subj} 핵심 단원 문제 풀이 및 근거 페이지 확인`,
    };
  });

  return {
    strategy: `시험일(${examDate})까지 하루 ${dailyHours}시간씩 취약 과목(${subjects.join(
      ", "
    )})을 우선 배치한 맞춤형 순환 학습 계획표입니다.`,
    schedule,
  };
}

const ETYMOLOGY_DATABASE: Record<
  string,
  {
    affix: string;
    type: string;
    meaning: string;
    examples: Array<{ word: string; breakdown: string; korean: string }>;
  }
> = {
  "hyper-": {
    affix: "hyper-",
    type: "접두사",
    meaning: "과도한, 정상보다 높은 (Excessive, Above normal)",
    examples: [
      { word: "Hypertension", breakdown: "hyper-(높은) + tension(압력)", korean: "고혈압" },
      { word: "Hyperglycemia", breakdown: "hyper-(과도한) + glyc(당) + -emia(혈증)", korean: "고혈당증" },
      { word: "Hyperthermia", breakdown: "hyper-(높은) + therm(열) + -ia(상태)", korean: "고체온증" },
    ],
  },
  "hypo-": {
    affix: "hypo-",
    type: "접두사",
    meaning: "부족한, 정상보다 낮은 (Below normal, Deficient)",
    examples: [
      { word: "Hypotension", breakdown: "hypo-(낮은) + tension(압력)", korean: "저혈압" },
      { word: "Hypoglycemia", breakdown: "hypo-(부족한) + glyc(당) + -emia(혈증)", korean: "저혈당증" },
      { word: "Hypoxia", breakdown: "hypo-(부족한) + ox(산소) + -ia(상태)", korean: "저산소증" },
    ],
  },
  "tachy-": {
    affix: "tachy-",
    type: "접두사",
    meaning: "빠른 (Fast, Rapid)",
    examples: [
      { word: "Tachycardia", breakdown: "tachy-(빠른) + card(심장) + -ia(상태)", korean: "빈맥 (빠른 맥박)" },
      { word: "Tachypnea", breakdown: "tachy-(빠른) + -pnea(호흡)", korean: "빈호흡 (빠른 호흡)" },
      { word: "Tachyarrhythmia", breakdown: "tachy-(빠른) + arrhythmia(부정맥)", korean: "빈맥성 부정맥" },
    ],
  },
  "brady-": {
    affix: "brady-",
    type: "접두사",
    meaning: "느린 (Slow)",
    examples: [
      { word: "Bradycardia", breakdown: "brady-(느린) + card(심장) + -ia(상태)", korean: "서맥 (느린 맥박)" },
      { word: "Bradypnea", breakdown: "brady-(느린) + -pnea(호흡)", korean: "서호흡 (느린 호흡)" },
      { word: "Bradykinesia", breakdown: "brady-(느린) + kines(운동) + -ia(상태)", korean: "운동완만증" },
    ],
  },
  "-itis": {
    affix: "-itis",
    type: "접미사",
    meaning: "염증 (Inflammation)",
    examples: [
      { word: "Gastritis", breakdown: "gastr(위) + -itis(염증)", korean: "위염" },
      { word: "Hepatitis", breakdown: "hepat(간) + -itis(염증)", korean: "간염" },
      { word: "Arthritis", breakdown: "arthr(관절) + -itis(염증)", korean: "관절염" },
    ],
  },
  "-emia": {
    affix: "-emia",
    type: "접미사",
    meaning: "혈액 상태, ~혈증 (Blood condition)",
    examples: [
      { word: "Anemia", breakdown: "an-(없는/부족한) + -emia(혈액)", korean: "빈혈" },
      { word: "Hypoxemia", breakdown: "hypo-(낮은) + ox(산소) + -emia(혈증)", korean: "저산소혈증" },
      { word: "Bacteremia", breakdown: "bacter(세균) + -emia(혈증)", korean: "균혈증" },
    ],
  },
  "-ectomy": {
    affix: "-ectomy",
    type: "접미사",
    meaning: "절제술, 외과적 제거 (Surgical removal)",
    examples: [
      { word: "Appendectomy", breakdown: "append(충수) + -ectomy(절제술)", korean: "충수절제술" },
      { word: "Gastrectomy", breakdown: "gastr(위) + -ectomy(절제술)", korean: "위절제술" },
      { word: "Cholecystectomy", breakdown: "cholecyst(담낭) + -ectomy(절제술)", korean: "담낭절제술" },
    ],
  },
  "-otomy": {
    affix: "-otomy",
    type: "접미사",
    meaning: "절개술 (Surgical incision)",
    examples: [
      { word: "Tracheotomy", breakdown: "trache(기관) + -otomy(절개술)", korean: "기관절개술" },
      { word: "Laparotomy", breakdown: "lapar(복벽) + -otomy(절개술)", korean: "개복술" },
      { word: "Thoracotomy", breakdown: "thorac(흉강) + -otomy(절개술)", korean: "개흉술" },
    ],
  },
  "-osis": {
    affix: "-osis",
    type: "접미사",
    meaning: "비정상적 상태, ~증 (Abnormal condition)",
    examples: [
      { word: "Cyanosis", breakdown: "cyan(청색) + -osis(상태)", korean: "청색증" },
      { word: "Thrombosis", breakdown: "thromb(혈전) + -osis(상태)", korean: "혈전증" },
      { word: "Necrosis", breakdown: "necr(괴사) + -osis(상태)", korean: "괴사" },
    ],
  },
  "cardio-": {
    affix: "cardio-",
    type: "어근",
    meaning: "심장 (Heart)",
    examples: [
      { word: "Cardiology", breakdown: "cardio-(심장) + -logy(학문)", korean: "심장학" },
      { word: "Cardiomegaly", breakdown: "cardio-(심장) + -megaly(비대)", korean: "심장비대" },
      { word: "Cardiomyopathy", breakdown: "cardio-(심장) + myo(근육) + -pathy(질환)", korean: "심근병증" },
    ],
  },
  "pneumo-": {
    affix: "pneumo-",
    type: "어근",
    meaning: "폐, 공기 (Lung, Air)",
    examples: [
      { word: "Pneumonia", breakdown: "pneumon(폐) + -ia(질환)", korean: "폐렴" },
      { word: "Pneumothorax", breakdown: "pneumo-(공기) + thorax(흉강)", korean: "기흉" },
      { word: "Pneumonectomy", breakdown: "pneumon(폐) + -ectomy(절제술)", korean: "폐절제술" },
    ],
  },
  "nephro-": {
    affix: "nephro-",
    type: "어근",
    meaning: "신장, 콩팥 (Kidney)",
    examples: [
      { word: "Nephritis", breakdown: "nephr(신장) + -itis(염증)", korean: "신장염" },
      { word: "Nephrectomy", breakdown: "nephr(신장) + -ectomy(절제술)", korean: "신장절제술" },
      { word: "Nephropathy", breakdown: "nephro-(신장) + -pathy(병증)", korean: "신장병증" },
    ],
  },
};

function buildFallbackTerms(prompt: string) {
  const match = prompt.match(/분해해 표로 정리해줘:\s*\[([^\]]*)\]/);
  const rawList = match
    ? match[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : Object.keys(ETYMOLOGY_DATABASE).slice(0, 5);

  const items = rawList.map((affix) => {
    if (ETYMOLOGY_DATABASE[affix]) {
      return ETYMOLOGY_DATABASE[affix];
    }
    return {
      affix,
      type: affix.startsWith("-") ? "접미사" : affix.endsWith("-") ? "접두사" : "어근",
      meaning: `${affix} 관련 의학 어원 (교재 확인 권장)`,
      examples: [
        { word: `${affix.replace(/-/g, "")}logy`, breakdown: `${affix} + -logy`, korean: "관련 의학 용어 1" },
        { word: `${affix.replace(/-/g, "")}pathy`, breakdown: `${affix} + -pathy`, korean: "관련 의학 용어 2" },
        { word: `${affix.replace(/-/g, "")}itis`, breakdown: `${affix} + -itis`, korean: "관련 의학 용어 3" },
      ],
    };
  });

  return { items };
}

function buildFallbackResume(prompt: string) {
  const draftPart = prompt.split("[초안]")[1]?.trim() || "";
  const sentences = draftPart
    .split(/(?<=[.?!다요])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // 절대 규칙: 지원자가 쓰지 않은 경험·수치·자격을 새로 만들지 않음!
  // 오직 초안에 있는 문장만을 연결어와 간호 직무 관점 문맥으로 정돈합니다.
  let revisedText = "";
  if (sentences.length === 0) {
    revisedText = draftPart;
  } else if (sentences.length === 1) {
    revisedText = `${sentences[0]} 이를 통해 간호 현장에서 요구되는 세심한 관찰과 책임감의 중요성을 깊이 체감하였습니다.`;
  } else {
    const first = sentences[0];
    const middle = sentences.slice(1, -1).join(" 또한, ");
    const last = sentences[sentences.length - 1];
    revisedText = middle
      ? `${first} 당시 상황에서 ${middle} 결과적으로 ${last}`
      : `${first} 이러한 과정을 통해 ${last}`;
  }

  return {
    revisedText,
    improvementPoints: [
      "초안에 작성하신 사실과 경험만 유지하고, 문장 간 인과관계(상황 → 행동 → 배운 점)가 자연스럽게 이어지도록 다듬었습니다.",
      "막연한 표현을 간호 직무역량(환자 중심 태도, 의사소통, 협업)이 돋보이는 문장 구조로 정돈했습니다.",
      "작성하지 않으신 수치나 새로운 수상·자격증 경험은 일절 임의로 추가하지 않았습니다.",
    ],
    competencyKeywords: ["환자안전 의식", "공감적 의사소통", "다직종 협업", "임상적 책임감"],
    followUpQuestions: [
      "해당 경험이 있었던 구체적인 시기나 실습 과목(또는 활동 기간)을 한 줄 추가하면 설득력이 더 높아집니다. 어떤 실습/활동이었나요?",
      "본인의 행동 이후 대상자(환자, 보호자, 또는 팀원)의 반응이 어떠했는지 실제 있었던 사실을 한 문장 더 적어보실 수 있나요?",
      "이 경험을 지원하시는 병원의 해당 부서 업무에서 어떻게 발휘하고 싶은지 마무리 다짐을 덧붙여 볼까요?",
    ],
  };
}

const INTERVIEW_QUESTIONS_BANK = [
  { category: "인성", q: "1분 자기소개와 함께 우리 병원 해당 부서에 지원하게 된 가장 큰 동기를 말씀해 주세요." },
  { category: "인성", q: "간호학과 임상실습 중 동료나 타 직종과 의견 차이가 있었던 경험과 이를 어떻게 해결했는지 말씀해 주세요." },
  { category: "인성", q: "본인의 가장 큰 강점과 약점은 무엇이며, 신규 간호사로서 약점을 어떻게 보완할 계획인가요?" },
  { category: "직무", q: "환자에게 투약하기 전 간호사가 반드시 확인해야 하는 기본 원칙(5 Rights)과 환자 확인 방법을 설명해 주세요." },
  { category: "직무", q: "수혈 시작 후 15분 이내에 환자가 오한과 발열, 호흡곤란을 호소한다면 가장 먼저 어떤 간호중재를 시행하시겠습니까?" },
  { category: "직무", q: "낙상 고위험 환자를 사정하는 기준과 병동에서 수행할 수 있는 낙상 예방 간호중재를 말씀해 주세요." },
  { category: "직무", q: "희망하시는 부서에서 가장 중요하게 생각하는 간호 역량 한 가지와 그 이유를 말씀해 주세요." },
  { category: "상황 대처", q: "처치 지연으로 인해 환자나 환아 보호자가 간호사에게 크게 화를 내며 항의할 때 어떻게 대처하시겠습니까?" },
  { category: "상황 대처", q: "바쁜 근무 중 본인의 투약 오류(Near miss 또는 투약 사고)를 발견했다면 즉시 어떻게 행동하시겠습니까?" },
  { category: "상황 대처", q: "담당 환자 두 명이 동시에 상태 변화를 보일 때(한 명은 단순 진통제 요청, 한 명은 산소포화도 88% 저하) 우선순위를 어떻게 두시겠습니까?" },
];

function buildFallbackInterviewChat(prompt: string) {
  const turnMatch = prompt.match(/현재 진행 문항 번호:\s*(\d+)\s*\/\s*10/);
  const turn = turnMatch ? Number(turnMatch[1]) : 1;
  const isFinished = turn >= 10;
  const nextQuestionObj = !isFinished
    ? INTERVIEW_QUESTIONS_BANK[turn % INTERVIEW_QUESTIONS_BANK.length]
    : null;

  return {
    feedback: {
      goodPoints:
        "질문의 의도를 정확히 파악하고 환자안전과 공감적 태도를 중심으로 침착하게 답변하신 점이 좋습니다.",
      improvementPoints:
        "결론(핵심 행동)을 첫 문장에 두괄식으로 먼저 제시한 뒤 구체적인 임상 근거를 덧붙이면 면접관에게 훨씬 명확하게 전달됩니다.",
      betterExample:
        "\"저는 무엇보다 환자안전을 최우선으로 두고 행동하겠습니다. 먼저 환자의 활력징후와 주요 증상을 즉각 사정한 뒤, 담당 의사 및 프리셉터 선생님께 신속히 보고하고 처방에 따른 간호중재를 정확히 수행하겠습니다.\"",
    },
    nextQuestion: nextQuestionObj ? nextQuestionObj.q : "",
    questionCategory: nextQuestionObj ? nextQuestionObj.category : "완료",
    isFinished,
    finalEvaluation: isFinished
      ? {
          totalScore: 88,
          overallReview:
            "인성부터 직무 지식, 임상 상황 대처까지 총 10문항 동안 환자안전 원칙과 정직한 보고 태도를 일관되게 보여주셨습니다. 두괄식 답변 구성만 조금 더 연습하시면 실제 병원 면접에서 매우 좋은 결과가 기대됩니다.",
          strengths: [
            "환자안전 및 신속한 보고(프리셉터·주치의 보고) 원칙 숙지",
            "보호자 및 환자와의 공감적 의사소통 태도",
          ],
          weaknesses: ["답변 첫 문장에 핵심 결론을 먼저 말하는 두괄식 구성 보완 필요"],
        }
      : undefined,
  };
}

function buildFallbackInterviewReview(prompt: string) {
  const hospitalMatch = prompt.match(/아래는 \[([^\]]+)\] 면접 후기야/);
  const hospital = hospitalMatch ? hospitalMatch[1] : "지원 병원";

  return {
    departmentQuestions: [
      {
        department: "공통 인성 및 지원동기",
        questions: [
          `${hospital}에 지원한 동기와 입사 후 5년 뒤 목표는 무엇인가요?`,
          "실습 중 가장 기억에 남는 환자와 본인이 수행한 간호는 무엇인가요?",
        ],
      },
      {
        department: "중환자실(ICU) · 응급실(ER)",
        questions: [
          "산소포화도 저하 또는 호흡곤란 환자 발견 시 최우선 간호중재는 무엇인가요?",
          "수혈 부작용 발생 시 즉각적인 대처 순서를 말씀해 주세요.",
        ],
      },
      {
        department: "일반병동 · 소아과병동",
        questions: [
          "보호자가 처치 지연에 대해 화를 낼 때 어떻게 응대하시겠습니까?",
          "낙상 및 욕창 고위험 환자 예방 간호 방법을 설명해 주세요.",
        ],
      },
    ],
    top5Questions: [
      {
        rank: 1,
        question: "자기소개 및 우리 병원에 지원한 동기를 말씀해 주세요.",
        starGuide: {
          situation: "S(상황): 간호학과 실습 또는 학부 생활 중 병원의 핵심 가치와 맞닿았던 경험 제시",
          task: "T(과제): 환자에게 안전하고 전문적인 간호를 제공하기 위해 본인이 세운 목표",
          action: "A(행동): 관련 전공 공부, 실습 중 적극적인 환자 관찰 및 의사소통 노력",
          result: "R(결과): 이를 통해 기른 역량을 바탕으로 입사 후 기여할 점 제시",
        },
      },
      {
        rank: 2,
        question: "환자나 보호자가 화를 내며 항의할 때 어떻게 대처하겠습니까?",
        starGuide: {
          situation: "S(상황): 처치 대기나 통증으로 인해 환자/보호자가 불안과 분노를 표출하는 상황",
          task: "T(과제): 정서적 안정 도모 및 정확한 상황 파악과 문제 해결",
          action: "A(행동): 먼저 눈을 맞추고 불편함에 공감·경청한 뒤, 현재 진행 상황을 명확히 안내하고 선임 간호사에게 보고",
          result: "R(결과): 보호자의 신뢰 회복 및 원활한 간호 처치 진행",
        },
      },
      {
        rank: 3,
        question: "수혈 부작용이나 투약 이상반응 발견 시 최우선 간호중재는?",
        starGuide: {
          situation: "S(상황): 수혈 또는 약물 투여 중 발열, 오한, 호흡곤란 등 급성 이상반응 발생",
          task: "T(과제): 원인 물질 차단 및 환자 생명 징후 보호",
          action: "A(행동): 즉시 주입을 중단하고 생리식염수로 정맥로를 유지한 채 활력징후 측정 및 의사 보고",
          result: "R(결과): 중증 합병증 예방 및 신속한 응급 처치 연계",
        },
      },
      {
        rank: 4,
        question: "실습 중 팀원이나 동료와 갈등이 있었던 경험과 해결 방법은?",
        starGuide: {
          situation: "S(상황): 조별 실습이나 과제 중 역할 분담 또는 의견 차이 발생",
          task: "T(과제): 갈등을 원만히 조율하고 공동의 목표(환자 케이스 완성) 달성",
          action: "A(행동): 상대방의 입장을 먼저 경청하고 객관적인 근거와 역할표를 바탕으로 조율",
          result: "R(결과): 팀워크 향상 및 성공적인 실습 마무리",
        },
      },
      {
        rank: 5,
        question: "본인의 투약 오류나 실수를 발견했을 때 어떻게 행동하겠습니까?",
        starGuide: {
          situation: "S(상황): 근무 중 투약 용량이나 시간 등 오류를 인지한 위기 상황",
          task: "T(과제): 환자 위해 최소화 및 재발 방지",
          action: "A(행동): 절대 은폐하지 않고 즉시 환자 상태와 활력징후를 확인한 뒤 프리셉터·수간호사·주치의에게 정직하게 보고",
          result: "R(결과): 신속한 대처로 환자안전을 지키고 투약 원칙(5 Rights) 재점검",
        },
      },
    ],
  };
}
