import { describe, expect, it } from "vitest";
import { beltRanks } from "./data";
import {
  beltCaseBackgrounds,
  beltCaseEffects,
  beltCaseFrames,
  beltCaseRailBeltAsset,
  beltCaseStickers,
  beltCaseStudentStorageKey,
  beltCaseTrophyBeltAsset,
  defaultBeltCaseSettings,
  getBeltJourneyStats,
  getEarnedBeltRanks,
  normalizeBeltCaseSettings,
  resolveBeltRank
} from "./beltCase";

describe("student belt case helpers", () => {
  it("resolves rank aliases and earned belt progression from the shared belt ladder", () => {
    const darkBrown = resolveBeltRank("Dark Brown Belt");

    expect(darkBrown.slug).toBe("dark-brown");
    expect(resolveBeltRank("unknown").slug).toBe("white");
    expect(getEarnedBeltRanks(darkBrown).map((rank) => rank.slug)).toEqual(beltRanks.slice(0, 9).map((rank) => rank.slug));
  });

  it("normalizes saved case settings against earned belts and known option ids", () => {
    const currentRank = resolveBeltRank("Yellow");
    const fallback = defaultBeltCaseSettings(currentRank, "Kai Cho");
    const normalized = normalizeBeltCaseSettings(
      JSON.stringify({
        backgroundId: "championship-lights",
        caseId: "carved-wood",
        lightingId: "champion",
        effectId: "spark-trail",
        stickerIds: ["focus-seal", "missing", "dragon-medal", "family-crest", "champion-star"],
        displayModeId: "spotlight",
        selectedBeltSlug: "black",
        plaqueText: "  Kai    earned    yellow    ",
        updatedAt: "2026-05-28T00:00:00.000Z"
      }),
      fallback,
      getEarnedBeltRanks(currentRank)
    );

    expect(normalized).toEqual({
      ...fallback,
      backgroundId: "championship-lights",
      caseId: "carved-wood",
      lightingId: "champion",
      effectId: "spark-trail",
      stickerIds: ["focus-seal", "dragon-medal", "family-crest", "champion-star"],
      displayModeId: "spotlight",
      selectedBeltSlug: "yellow",
      plaqueText: "Kai earned yellow",
      updatedAt: "2026-05-28T00:00:00.000Z"
    });
  });

  it("keeps expanded creator image option ids compatible with saved settings", () => {
    const currentRank = resolveBeltRank("Yellow");
    const fallback = defaultBeltCaseSettings(currentRank, "Kai Cho");
    const normalized = normalizeBeltCaseSettings(
      JSON.stringify({
        backgroundId: "dragon-stage",
        caseId: "champion-gold",
        lightingId: "neon",
        effectId: "dragon-glow",
        stickerIds: ["victory-heart", "honor-flame", "dojo-badge", "power-star", "family-crest"],
        displayModeId: "journey",
        selectedBeltSlug: "white",
        plaqueText: "Kai creator loadout",
        updatedAt: "2026-05-29T00:00:00.000Z"
      }),
      fallback,
      getEarnedBeltRanks(currentRank)
    );

    expect(beltCaseBackgrounds).toHaveLength(8);
    expect(beltCaseFrames).toHaveLength(6);
    expect(beltCaseEffects).toHaveLength(7);
    expect(beltCaseStickers).toHaveLength(8);
    expect(normalized).toMatchObject({
      backgroundId: "dragon-stage",
      caseId: "champion-gold",
      lightingId: "neon",
      effectId: "dragon-glow",
      stickerIds: ["victory-heart", "honor-flame", "dojo-badge", "power-star"],
      selectedBeltSlug: "white",
      plaqueText: "Kai creator loadout"
    });
  });

  it("keeps belt case storage keys and asset paths stable", () => {
    expect(beltCaseStudentStorageKey("Kai Cho.Child")).toBe("chos.beltCase.student.kai-cho.child.v1");
    expect(beltCaseRailBeltAsset("dark-brown")).toContain("assets/belt-journey-game/belts/hanging-dark-brown.png");
    expect(beltCaseTrophyBeltAsset("dark-brown")).toContain("assets/belt-journey-game/belts/current-dark-brown.png");
  });

  it("derives student belt journey stats without persisted achievement state", () => {
    const white = resolveBeltRank("White");
    const whiteStats = getBeltJourneyStats(white, 4);

    expect(whiteStats).toMatchObject({
      achievementsEarned: 2,
      classesAttended: 4,
      earnedBeltCount: 1,
      encouragement: "You're doing awesome!",
      skillsLearned: 10
    });
    expect(whiteStats.nextBeltName).toBe("Yellow Belt");
    expect(whiteStats.progressLabel).toBe("4 classes to Yellow Belt");
    expect(whiteStats.progressPercent).toBe(50);

    const blackStats = getBeltJourneyStats(resolveBeltRank("Black"), 140);
    expect(blackStats.nextBeltName).toBe("Black Belt training");
    expect(blackStats.progressLabel).toBe("Black Belt journey");
    expect(blackStats.progressPercent).toBe(100);
  });
});
