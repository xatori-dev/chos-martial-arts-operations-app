import { beltRanks } from "./data";
import type { BeltRank } from "./types";
import { publicAsset } from "./appAssets";

const beltCaseAssetRoot = "assets/belt-journey-game";

export const beltCaseBackgrounds = [
  { id: "dojo-night", label: "Night Dojo", file: "scenes/dojo-night.png", tone: "Crimson case" },
  { id: "championship-lights", label: "Championship Lights", file: "scenes/championship-lights.png", tone: "Red stage" },
  { id: "moonlit-courtyard", label: "Moonlit Courtyard", file: "scenes/moonlit-courtyard.png", tone: "Cool focus" },
  { id: "legacy-wall", label: "Legacy Wall", file: "scenes/legacy-wall.png", tone: "Gold legacy" },
  { id: "dragon-stage", label: "Dragon Stage", file: "scenes/dragon-stage.png", tone: "Hero glow" },
  { id: "red-arcade", label: "Red Arcade", file: "scenes/red-arcade.png", tone: "Game grid" },
  { id: "gold-hall", label: "Gold Hall", file: "scenes/gold-hall.png", tone: "Champion hall" },
  { id: "shadow-dojo", label: "Shadow Dojo", file: "scenes/shadow-dojo.png", tone: "Night focus" }
] as const;

export const beltCaseFrames = [
  { id: "gold-glass", label: "Gold Glass", file: "frames/gold-glass.png" },
  { id: "carved-wood", label: "Carved Wood", file: "frames/carved-wood.png" },
  { id: "onyx-metal", label: "Onyx Metal", file: "frames/onyx-metal.png" },
  { id: "neon-red", label: "Neon Red", file: "frames/neon-red.png" },
  { id: "champion-gold", label: "Champion Gold", file: "frames/champion-gold.png" },
  { id: "midnight-glass", label: "Midnight Glass", file: "frames/midnight-glass.png" }
] as const;

export const beltCaseLightingOptions = [
  { id: "warm", label: "Warm", className: "is-lighting-warm" },
  { id: "focus", label: "Focus", className: "is-lighting-focus" },
  { id: "champion", label: "Champion", className: "is-lighting-champion" },
  { id: "neon", label: "Neon", className: "is-lighting-neon" },
  { id: "spotlight", label: "Stage Spot", className: "is-lighting-spotlight" },
  { id: "aurora", label: "Aurora", className: "is-lighting-aurora" }
] as const;

export const beltCaseEffects = [
  { id: "none", label: "Clean Glass" },
  { id: "aura-gold", label: "Gold Aura", file: "effects/aura-gold.png" },
  { id: "ember-red", label: "Red Ember", file: "effects/ember-red.png" },
  { id: "spark-trail", label: "Spark Trail", file: "effects/spark-trail.png" },
  { id: "dragon-glow", label: "Dragon Glow", file: "effects/dragon-glow.png" },
  { id: "star-burst", label: "Star Burst", file: "effects/star-burst.png" },
  { id: "red-rings", label: "Red Rings", file: "effects/red-rings.png" }
] as const;

export const beltCaseStickers = [
  { id: "focus-seal", label: "Focus Seal", file: "stickers/focus-seal.png", placement: "top-left" },
  { id: "champion-star", label: "Champion Star", file: "stickers/champion-star.png", placement: "top-right" },
  { id: "dragon-medal", label: "Dragon Medal", file: "stickers/dragon-medal.png", placement: "bottom-left" },
  { id: "family-crest", label: "Family Crest", file: "stickers/family-crest.png", placement: "bottom-right" },
  { id: "power-star", label: "Power Star", file: "stickers/power-star.png", placement: "upper-left" },
  { id: "dojo-badge", label: "Dojo Badge", file: "stickers/dojo-badge.png", placement: "upper-right" },
  { id: "honor-flame", label: "Honor Flame", file: "stickers/honor-flame.png", placement: "lower-left" },
  { id: "victory-heart", label: "Victory Heart", file: "stickers/victory-heart.png", placement: "lower-right" }
] as const;

export const beltCaseDisplayModes = [
  { id: "journey", label: "Journey Rail" },
  { id: "earned", label: "Earned Only" },
  { id: "spotlight", label: "Spotlight" }
] as const;

const beltCaseRailBeltFiles: Record<string, string> = {
  white: "belts/hanging-white.png",
  yellow: "belts/hanging-yellow.png",
  orange: "belts/hanging-orange.png",
  green: "belts/hanging-green.png",
  blue: "belts/hanging-blue.png",
  purple: "belts/hanging-purple.png",
  brown: "belts/hanging-brown.png",
  red: "belts/hanging-red.png",
  "dark-brown": "belts/hanging-dark-brown.png",
  black: "belts/hanging-black.png"
};

const beltCaseCurrentBeltFiles: Record<string, string> = {
  white: "belts/current-white.png",
  yellow: "belts/current-yellow.png",
  orange: "belts/current-orange.png",
  green: "belts/current-green.png",
  blue: "belts/current-blue.png",
  purple: "belts/current-purple.png",
  brown: "belts/current-brown.png",
  red: "belts/current-red.png",
  "dark-brown": "belts/current-dark-brown.png",
  black: "belts/current-black.png"
};

export type BeltCaseBackgroundId = (typeof beltCaseBackgrounds)[number]["id"];
export type BeltCaseFrameId = (typeof beltCaseFrames)[number]["id"];
export type BeltCaseLightingId = (typeof beltCaseLightingOptions)[number]["id"];
export type BeltCaseEffectId = (typeof beltCaseEffects)[number]["id"];
export type BeltCaseStickerId = (typeof beltCaseStickers)[number]["id"];
export type BeltCaseSticker = (typeof beltCaseStickers)[number];
export type BeltCaseDisplayModeId = (typeof beltCaseDisplayModes)[number]["id"];

export type BeltCaseSettings = {
  backgroundId: BeltCaseBackgroundId;
  caseId: BeltCaseFrameId;
  lightingId: BeltCaseLightingId;
  effectId: BeltCaseEffectId;
  stickerIds: BeltCaseStickerId[];
  displayModeId: BeltCaseDisplayModeId;
  selectedBeltSlug: string;
  plaqueText: string;
  updatedAt: string;
};

export type BeltJourneyStats = {
  achievementsEarned: number;
  classesAttended: number;
  earnedBeltCount: number;
  encouragement: string;
  nextBeltName: string;
  progressLabel: string;
  progressPercent: number;
  skillsLearned: number;
};

export function normalizeBeltRankToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+belt$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function resolveBeltRank(value?: string): BeltRank {
  const normalizedToken = normalizeBeltRankToken(value ?? "");
  return beltRanks.find((beltRank) => beltRank.slug === normalizedToken || normalizeBeltRankToken(beltRank.name) === normalizedToken) ?? beltRanks[0];
}

export function getEarnedBeltRanks(currentBeltRank: BeltRank) {
  const currentIndex = beltRanks.findIndex((beltRank) => beltRank.slug === currentBeltRank.slug);
  return beltRanks.slice(0, currentIndex >= 0 ? currentIndex + 1 : 1);
}

function normalizeClassCount(classesAttended: number) {
  return Math.max(0, Math.floor(Number.isFinite(classesAttended) ? classesAttended : 0));
}

export function getBeltJourneyStats(currentBeltRank: BeltRank, classesAttended: number): BeltJourneyStats {
  const normalizedClasses = normalizeClassCount(classesAttended);
  const earnedBeltRanks = getEarnedBeltRanks(currentBeltRank);
  const currentIndex = beltRanks.findIndex((beltRank) => beltRank.slug === currentBeltRank.slug);
  const nextBeltRank = beltRanks[currentIndex + 1];
  const isBlackBelt = !nextBeltRank;
  const classesRequired = Math.max(currentBeltRank.classesRequired, 1);
  const remainingClasses = Math.max(classesRequired - normalizedClasses, 0);
  const progressPercent = isBlackBelt ? 100 : Math.min(100, Math.round((normalizedClasses / classesRequired) * 100));

  return {
    achievementsEarned: earnedBeltRanks.length + (normalizedClasses > 0 ? 1 : 0),
    classesAttended: normalizedClasses,
    earnedBeltCount: earnedBeltRanks.length,
    encouragement: "You're doing awesome!",
    nextBeltName: isBlackBelt ? "Black Belt training" : `${nextBeltRank.name} Belt`,
    progressLabel: isBlackBelt ? "Black Belt journey" : remainingClasses > 0 ? `${remainingClasses} classes to ${nextBeltRank.name} Belt` : `Ready for ${nextBeltRank.name} Belt`,
    progressPercent,
    skillsLearned: earnedBeltRanks.length * 6 + normalizedClasses
  };
}

export function beltCaseStudentStorageKey(sessionEmail?: string) {
  const keyEmail = (sessionEmail ?? "student@chos.prototype")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "");
  return `chos.beltCase.student.${keyEmail || "student"}.v1`;
}

export function beltCaseAsset(file: string) {
  return publicAsset(`${beltCaseAssetRoot}/${file}`);
}

export function beltCaseRailBeltAsset(beltSlug: string) {
  return beltCaseAsset(beltCaseRailBeltFiles[beltSlug] ?? "belts/hanging-white.png");
}

export function beltCaseTrophyBeltAsset(beltSlug: string) {
  return beltCaseAsset(beltCaseCurrentBeltFiles[beltSlug] ?? "belts/current-white.png");
}

function isBeltCaseBackgroundId(value: unknown): value is BeltCaseBackgroundId {
  return typeof value === "string" && beltCaseBackgrounds.some((background) => background.id === value);
}

function isBeltCaseFrameId(value: unknown): value is BeltCaseFrameId {
  return typeof value === "string" && beltCaseFrames.some((frame) => frame.id === value);
}

function isBeltCaseLightingId(value: unknown): value is BeltCaseLightingId {
  return typeof value === "string" && beltCaseLightingOptions.some((lighting) => lighting.id === value);
}

function isBeltCaseEffectId(value: unknown): value is BeltCaseEffectId {
  return typeof value === "string" && beltCaseEffects.some((effect) => effect.id === value);
}

function isBeltCaseStickerId(value: unknown): value is BeltCaseStickerId {
  return typeof value === "string" && beltCaseStickers.some((sticker) => sticker.id === value);
}

function isBeltCaseDisplayModeId(value: unknown): value is BeltCaseDisplayModeId {
  return typeof value === "string" && beltCaseDisplayModes.some((mode) => mode.id === value);
}

export function defaultBeltCasePlaqueText(studentName: string, beltRank: BeltRank) {
  const name = studentName.trim().split(/\s+/)[0] || "Student";
  return `${name}'s ${beltRank.name} Belt`;
}

export function sanitizeBeltCasePlaqueText(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (text || fallback).slice(0, 38);
}

export function defaultBeltCaseSettings(currentBeltRank: BeltRank, studentName: string): BeltCaseSettings {
  return {
    backgroundId: "dojo-night",
    caseId: "gold-glass",
    lightingId: "warm",
    effectId: "aura-gold",
    stickerIds: ["focus-seal"],
    displayModeId: "journey",
    selectedBeltSlug: currentBeltRank.slug,
    plaqueText: defaultBeltCasePlaqueText(studentName, currentBeltRank),
    updatedAt: new Date().toISOString()
  };
}

export function normalizeBeltCaseSettings(saved: string | null, fallback: BeltCaseSettings, earnedBeltRanks: BeltRank[]) {
  if (!saved) return undefined;
  const parsed = JSON.parse(saved) as Partial<BeltCaseSettings>;
  const earnedSlugs = new Set(earnedBeltRanks.map((beltRank) => beltRank.slug));
  const stickerIds = Array.isArray(parsed.stickerIds) ? parsed.stickerIds.filter(isBeltCaseStickerId).slice(0, 4) : fallback.stickerIds;
  return {
    ...fallback,
    backgroundId: isBeltCaseBackgroundId(parsed.backgroundId) ? parsed.backgroundId : fallback.backgroundId,
    caseId: isBeltCaseFrameId(parsed.caseId) ? parsed.caseId : fallback.caseId,
    lightingId: isBeltCaseLightingId(parsed.lightingId) ? parsed.lightingId : fallback.lightingId,
    effectId: isBeltCaseEffectId(parsed.effectId) ? parsed.effectId : fallback.effectId,
    stickerIds,
    displayModeId: isBeltCaseDisplayModeId(parsed.displayModeId) ? parsed.displayModeId : fallback.displayModeId,
    selectedBeltSlug: typeof parsed.selectedBeltSlug === "string" && earnedSlugs.has(parsed.selectedBeltSlug) ? parsed.selectedBeltSlug : fallback.selectedBeltSlug,
    plaqueText: sanitizeBeltCasePlaqueText(parsed.plaqueText, fallback.plaqueText),
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : fallback.updatedAt
  };
}

export function readBeltCaseSettings(sessionEmail: string | undefined, currentBeltRank: BeltRank, studentName: string) {
  const earnedBeltRanks = getEarnedBeltRanks(currentBeltRank);
  const fallback = defaultBeltCaseSettings(currentBeltRank, studentName);
  if (typeof window === "undefined") return fallback;
  try {
    return normalizeBeltCaseSettings(window.localStorage.getItem(beltCaseStudentStorageKey(sessionEmail)), fallback, earnedBeltRanks) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeBeltCaseSettings(sessionEmail: string | undefined, settings: BeltCaseSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(beltCaseStudentStorageKey(sessionEmail), JSON.stringify(settings));
  } catch {
    // The studio remains usable even if localStorage is unavailable.
  }
}

export function resolveBeltCaseSelection(settings: BeltCaseSettings, beltRank: BeltRank) {
  const earnedBeltRanks = getEarnedBeltRanks(beltRank);
  const selectedBackground = beltCaseBackgrounds.find((background) => background.id === settings.backgroundId) ?? beltCaseBackgrounds[0];
  const selectedFrame = beltCaseFrames.find((frame) => frame.id === settings.caseId) ?? beltCaseFrames[0];
  const selectedLighting = beltCaseLightingOptions.find((lighting) => lighting.id === settings.lightingId) ?? beltCaseLightingOptions[0];
  const selectedEffect = beltCaseEffects.find((effect) => effect.id === settings.effectId) ?? beltCaseEffects[0];
  const selectedBeltRank = earnedBeltRanks.find((earnedBeltRank) => earnedBeltRank.slug === settings.selectedBeltSlug) ?? earnedBeltRanks[earnedBeltRanks.length - 1] ?? beltRank;
  const selectedStickers = beltCaseStickers.filter((sticker) => settings.stickerIds.includes(sticker.id));
  return { earnedBeltRanks, selectedBackground, selectedFrame, selectedLighting, selectedEffect, selectedBeltRank, selectedStickers };
}
