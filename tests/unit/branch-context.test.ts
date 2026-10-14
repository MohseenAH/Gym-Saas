import { describe, it, expect } from "vitest";
import { resolveBranchContext } from "@/lib/auth/branch-context";

describe("Branch Context Resolution & Role Boundaries", () => {
  const branchA = "11111111-1111-1111-1111-111111111111";
  const branchB = "22222222-2222-2222-2222-222222222222";
  const branchC = "33333333-3333-3333-3333-333333333333";
  const unauthorizedBranch = "99999999-9999-9999-9999-999999999999";

  it("TEST-BR-001: Single-branch gyms always resolve to that single branch without all-branch toggle", () => {
    const result = resolveBranchContext({
      role: "owner",
      authorizedBranchIds: [branchA],
      requestedBranchId: "all",
    });

    expect(result.selectedBranchId).toBe(branchA);
    expect(result.isAllBranches).toBe(false);
    expect(result.effectiveBranchIds).toEqual([branchA]);
    expect(result.canSelectAll).toBe(false);
  });

  it("TEST-BR-002: Owner in multi-branch gym defaults to All Branches (org-wide view)", () => {
    const result = resolveBranchContext({
      role: "owner",
      authorizedBranchIds: [branchA, branchB, branchC],
      requestedBranchId: null,
    });

    expect(result.selectedBranchId).toBeNull();
    expect(result.isAllBranches).toBe(true);
    expect(result.effectiveBranchIds).toEqual([branchA, branchB, branchC]);
    expect(result.canSelectAll).toBe(true);
  });

  it("TEST-BR-003: Owner can select a specific valid branch", () => {
    const result = resolveBranchContext({
      role: "owner",
      authorizedBranchIds: [branchA, branchB, branchC],
      requestedBranchId: branchB,
    });

    expect(result.selectedBranchId).toBe(branchB);
    expect(result.isAllBranches).toBe(false);
    expect(result.effectiveBranchIds).toEqual([branchB]);
    expect(result.canSelectAll).toBe(true);
  });

  it("TEST-BR-004: Cookie persistence is used as fallback when search param is absent", () => {
    const result = resolveBranchContext({
      role: "partner",
      authorizedBranchIds: [branchA, branchB],
      requestedBranchId: undefined,
      cookieBranchId: branchB,
    });

    expect(result.selectedBranchId).toBe(branchB);
    expect(result.isAllBranches).toBe(false);
    expect(result.effectiveBranchIds).toEqual([branchB]);
  });

  it("TEST-BR-005: Staff member is restricted to their assigned branch and cannot view All Branches", () => {
    const result = resolveBranchContext({
      role: "staff",
      authorizedBranchIds: [branchA],
      requestedBranchId: "all",
    });

    expect(result.selectedBranchId).toBe(branchA);
    expect(result.isAllBranches).toBe(false);
    expect(result.canSelectAll).toBe(false);
  });

  it("TEST-BR-006: Unauthorized branch ID request is rejected and safely clamped", () => {
    // Owner with invalid branch falls back to All Branches
    const ownerResult = resolveBranchContext({
      role: "owner",
      authorizedBranchIds: [branchA, branchB],
      requestedBranchId: unauthorizedBranch,
    });
    expect(ownerResult.selectedBranchId).toBeNull();
    expect(ownerResult.isAllBranches).toBe(true);

    // Staff with invalid branch falls back to their authorized branch
    const staffResult = resolveBranchContext({
      role: "staff",
      authorizedBranchIds: [branchA],
      requestedBranchId: unauthorizedBranch,
    });
    expect(staffResult.selectedBranchId).toBe(branchA);
    expect(staffResult.isAllBranches).toBe(false);
  });
});
