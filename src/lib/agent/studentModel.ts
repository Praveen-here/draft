/** What the brain remembers about the student on one problem (docs/AGENT_BRAIN.md §4). */
export type StudentModel = {
  problemId: string;
  stage: "understand" | "diagnose" | "explain" | "check" | "practice" | "verify" | "done";
  hintLevel: 1 | 2 | 3;
  triedAngles: string[];
  misconceptions: string[];
  checksPassed: number;
  checksFailed: number;
  lastStudentLine?: string;
};

export function newStudentModel(problemId: string): StudentModel {
  return {
    problemId,
    stage: "understand",
    hintLevel: 1,
    triedAngles: [],
    misconceptions: [],
    checksPassed: 0,
    checksFailed: 0,
  };
}

const key = (problemId: string) => `draft.student.${problemId}`;

export function saveStudentModel(model: StudentModel): void {
  localStorage.setItem(key(model.problemId), JSON.stringify(model));
}

export function loadStudentModel(problemId: string): StudentModel {
  const saved = localStorage.getItem(key(problemId));
  return saved ? (JSON.parse(saved) as StudentModel) : newStudentModel(problemId);
}
