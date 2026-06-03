import { beltRanks } from "./data";
import type { BeltRank, StudentRecord } from "./types";

export type StudentBeltProgress = {
  rank: BeltRank | undefined;
  rankName: string;
  rankSlug: string;
  nextRankName?: string;
  focus: string;
  classesAttended: number;
  classesRequired: number;
  classesRemaining: number;
  classesOverRequirement: number;
  progressPercent: number;
  readyForReview: boolean;
  isBlackBelt: boolean;
};

export function getBeltRankDefinition(rank: string): BeltRank | undefined {
  const normalizedRank = rank.trim().toLowerCase();
  return beltRanks.find((item) => item.name.toLowerCase() === normalizedRank || item.slug.toLowerCase() === normalizedRank);
}

export function buildStudentBeltProgress(student: StudentRecord): StudentBeltProgress {
  const rank = getBeltRankDefinition(student.beltRank);
  const rankIndex = rank ? beltRanks.findIndex((item) => item.slug === rank.slug) : -1;
  const nextRank = rankIndex >= 0 ? beltRanks[rankIndex + 1] : undefined;
  const classesRequired = rank?.classesRequired ?? 0;
  const classesAttended = Math.max(0, Math.floor(student.classesAttended));
  const progressPercent = classesRequired > 0 ? Math.min(100, Math.round((classesAttended / classesRequired) * 100)) : 0;
  const isBlackBelt = rank?.slug === "black";

  return {
    rank,
    rankName: rank?.name ?? student.beltRank,
    rankSlug: rank?.slug ?? student.beltRank.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    nextRankName: nextRank?.name,
    focus: rank?.focus ?? "Ask an instructor for a current rank review and personalized testing steps.",
    classesAttended,
    classesRequired,
    classesRemaining: Math.max(0, classesRequired - classesAttended),
    classesOverRequirement: classesAttended - classesRequired,
    progressPercent,
    readyForReview: Boolean(rank && !isBlackBelt && classesAttended >= classesRequired),
    isBlackBelt
  };
}
