import { describe, expect, it } from "vitest";
import { publicAsset } from "./appAssets";

describe("public asset URLs", () => {
  it("keeps GitHub Pages subpath asset loading stable", () => {
    expect(publicAsset("assets/CheetahProfilePic/Cheetah.png", "/chos-martial-arts-prototype/")).toBe("/chos-martial-arts-prototype/assets/CheetahProfilePic/Cheetah.png");
    expect(publicAsset("/NewFinalBackground.png", "/chos-martial-arts-prototype")).toBe("/chos-martial-arts-prototype/NewFinalBackground.png");
  });

  it("falls back to root-relative public assets for local development", () => {
    expect(publicAsset("682e95109aa21_chos-logo.png", "")).toBe("/682e95109aa21_chos-logo.png");
  });
});
