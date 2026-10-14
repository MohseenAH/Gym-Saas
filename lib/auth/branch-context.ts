import { StaffRole } from "./roles";

export interface BranchContextResolution {
  selectedBranchId: string | null; // null represents "All Branches"
  isAllBranches: boolean;
  effectiveBranchIds: string[]; // List of branch IDs to filter queries by
  canSelectAll: boolean;
}

export function resolveBranchContext({
  role,
  authorizedBranchIds,
  requestedBranchId,
  cookieBranchId,
}: {
  role: StaffRole;
  authorizedBranchIds: string[];
  requestedBranchId?: string | null;
  cookieBranchId?: string | null;
}): BranchContextResolution {
  const canSelectAll = role === "owner" || role === "partner" || role === "manager";
  const candidateBranchId =
    requestedBranchId !== undefined && requestedBranchId !== null
      ? requestedBranchId
      : cookieBranchId || null;

  // Single-branch restriction or staff with single branch assigned
  if (authorizedBranchIds.length === 1) {
    const singleId = authorizedBranchIds[0];
    return {
      selectedBranchId: singleId,
      isAllBranches: false,
      effectiveBranchIds: [singleId],
      canSelectAll: false,
    };
  }

  // If candidate is "all" or null/empty
  if (!candidateBranchId || candidateBranchId === "all") {
    if (canSelectAll) {
      return {
        selectedBranchId: null,
        isAllBranches: true,
        effectiveBranchIds: authorizedBranchIds,
        canSelectAll: true,
      };
    }
    // Non-management role cannot view all branches; default to first authorized branch
    const defaultId = authorizedBranchIds[0] || null;
    return {
      selectedBranchId: defaultId,
      isAllBranches: false,
      effectiveBranchIds: defaultId ? [defaultId] : [],
      canSelectAll: false,
    };
  }

  // Validate candidate against authorized branches
  if (authorizedBranchIds.includes(candidateBranchId)) {
    return {
      selectedBranchId: candidateBranchId,
      isAllBranches: false,
      effectiveBranchIds: [candidateBranchId],
      canSelectAll,
    };
  }

  // If candidate branch ID is unauthorized or invalid, fall back safely
  if (canSelectAll) {
    return {
      selectedBranchId: null,
      isAllBranches: true,
      effectiveBranchIds: authorizedBranchIds,
      canSelectAll: true,
    };
  }

  const fallbackId = authorizedBranchIds[0] || null;
  return {
    selectedBranchId: fallbackId,
    isAllBranches: false,
    effectiveBranchIds: fallbackId ? [fallbackId] : [],
    canSelectAll: false,
  };
}
