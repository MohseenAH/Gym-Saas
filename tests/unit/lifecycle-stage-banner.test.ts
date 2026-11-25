import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { LifecycleStageBanner } from "@/components/dashboard/lifecycle-stage-banner";

describe("LifecycleStageBanner Component", () => {
  it("renders 'Finish setting up your gym' when stage is STAGE_1_SETUP", () => {
    const rawHtml = renderToString(
      React.createElement(LifecycleStageBanner, {
        gymId: "gym-123",
        stage: "STAGE_1_SETUP",
        plansCount: 0,
        membersCount: 0,
        unassignedCount: 0,
      })
    );
    const html = rawHtml.replace(/<!-- -->/g, "");

    expect(html).toContain("Finish setting up your gym");
    expect(html).not.toContain("Gym Launch Checklist");
    expect(html).toContain("0 of 2 complete (0%)");
    expect(html).toContain("1. Create Plans");
    expect(html).toContain("2. Add Members");
    // Ensure no emerald/jade colors remain in STAGE_1_SETUP
    expect(html).not.toContain("emerald");
    expect(html).not.toContain("jade");
  });

  it("calculates progress correctly when plansCount > 0 and membersCount === 0", () => {
    const rawHtml = renderToString(
      React.createElement(LifecycleStageBanner, {
        gymId: "gym-123",
        stage: "STAGE_1_SETUP",
        plansCount: 1,
        membersCount: 0,
        unassignedCount: 0,
      })
    );
    const html = rawHtml.replace(/<!-- -->/g, "");

    expect(html).toContain("1 of 2 complete (50%)");
    expect(html).not.toContain("emerald");
  });

  it("calculates progress correctly when both plansCount > 0 and membersCount > 0", () => {
    const rawHtml = renderToString(
      React.createElement(LifecycleStageBanner, {
        gymId: "gym-123",
        stage: "STAGE_1_SETUP",
        plansCount: 2,
        membersCount: 10,
        unassignedCount: 0,
      })
    );
    const html = rawHtml.replace(/<!-- -->/g, "");

    expect(html).toContain("2 of 2 complete (100%)");
    expect(html).not.toContain("emerald");
  });

  it("renders STAGE_2_UNASSIGNED when in stage 2", () => {
    const rawHtml = renderToString(
      React.createElement(LifecycleStageBanner, {
        gymId: "gym-123",
        stage: "STAGE_2_UNASSIGNED",
        plansCount: 2,
        membersCount: 10,
        unassignedCount: 5,
      })
    );
    const html = rawHtml.replace(/<!-- -->/g, "");

    expect(html).toContain("5 Members Awaiting Plans");
  });
});
