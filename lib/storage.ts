/**
 * 브라우저 localStorage 도우미 (개발 지시서 2장, 4장 준수)
 * - 오답노트 (강의록 문제 오답)
 * - 약어 퀴즈 오답 및 최근 점수
 * - 모의 면접 점수 및 총평 기록
 * 개인정보(자소서 원문, 이름, 연락처 등)는 절대 저장하지 않습니다.
 */

export interface StudyQuestion {
  id: number;
  stem: string;
  choices: string[];
  answer: number; // 1~5
  explanation: string;
  sourcePages: number[];
}

export interface WrongNoteItem {
  uid: string;
  subject: string;
  unit: string;
  question: StudyQuestion;
  selectedChoice: number;
  savedAt: string;
}

export interface AbbrQuizRecord {
  id: string;
  score: number;
  total: number;
  wrongAbbrs: Array<{
    abbr: string;
    fullName: string;
    meaning: string;
    userFullName: string;
    userMeaning: string;
  }>;
  completedAt: string;
}

export interface InterviewRecord {
  id: string;
  hospital: string;
  department: string;
  applicantType: string;
  totalScore: number;
  overallReview: string;
  strengths: string[];
  weaknesses: string[];
  completedAt: string;
}

const KEYS = {
  WRONG_NOTES: "nursemate_wrong_notes_v1",
  ABBR_RECORDS: "nursemate_abbr_records_v1",
  INTERVIEW_RECORDS: "nursemate_interview_records_v1",
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

// ==========================================
// 1. 강의록 오답노트 관리
// ==========================================

export function getWrongNotes(): WrongNoteItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEYS.WRONG_NOTES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveWrongNote(
  subject: string,
  unit: string,
  question: StudyQuestion,
  selectedChoice: number
): WrongNoteItem[] {
  if (!isBrowser()) return [];
  const current = getWrongNotes();
  // 동일한 문제(stem 기준)가 이미 있으면 최신 선택으로 갱신
  const existingIndex = current.findIndex(
    (item) => item.question.stem === question.stem && item.subject === subject
  );

  const newItem: WrongNoteItem = {
    uid: `${Date.now()}_${question.id}`,
    subject: subject || "간호학 전공",
    unit: unit || "기본 단원",
    question,
    selectedChoice,
    savedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    current[existingIndex] = newItem;
  } else {
    current.unshift(newItem);
  }

  window.localStorage.setItem(KEYS.WRONG_NOTES, JSON.stringify(current));
  return current;
}

export function removeWrongNote(uid: string): WrongNoteItem[] {
  if (!isBrowser()) return [];
  const filtered = getWrongNotes().filter((item) => item.uid !== uid);
  window.localStorage.setItem(KEYS.WRONG_NOTES, JSON.stringify(filtered));
  return filtered;
}

export function clearWrongNotes(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEYS.WRONG_NOTES);
}

// ==========================================
// 2. 약어 퀴즈 기록 관리
// ==========================================

export function getAbbrRecords(): AbbrQuizRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEYS.ABBR_RECORDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAbbrRecord(
  record: Omit<AbbrQuizRecord, "id" | "completedAt">
): AbbrQuizRecord[] {
  if (!isBrowser()) return [];
  const current = getAbbrRecords();
  const newRecord: AbbrQuizRecord = {
    ...record,
    id: `abbr_${Date.now()}`,
    completedAt: new Date().toISOString(),
  };
  const updated = [newRecord, ...current].slice(0, 20);
  window.localStorage.setItem(KEYS.ABBR_RECORDS, JSON.stringify(updated));
  return updated;
}

// ==========================================
// 3. 모의 면접 점수 기록 관리
// ==========================================

export function getInterviewRecords(): InterviewRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEYS.INTERVIEW_RECORDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveInterviewRecord(
  record: Omit<InterviewRecord, "id" | "completedAt">
): InterviewRecord[] {
  if (!isBrowser()) return [];
  const current = getInterviewRecords();
  const newRecord: InterviewRecord = {
    ...record,
    id: `interview_${Date.now()}`,
    completedAt: new Date().toISOString(),
  };
  const updated = [newRecord, ...current].slice(0, 20);
  window.localStorage.setItem(KEYS.INTERVIEW_RECORDS, JSON.stringify(updated));
  return updated;
}
