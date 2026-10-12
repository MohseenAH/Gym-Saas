"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Building } from "lucide-react";

interface BranchSelectorProps {
  gymId: string;
  branches: { id: string; name: string }[];
  currentBranchId?: string;
}

export function BranchSelector({
  gymId,
  branches,
  currentBranchId,
}: BranchSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (branches.length <= 1) return null;

  function handleChange(branchId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (branchId === "all") {
      params.delete("branchId");
    } else {
      params.set("branchId", branchId);
    }
    router.push(`/app/${gymId}/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700">
        <Building className="w-3.5 h-3.5 text-slate-400" />
        <select
          value={currentBranchId || "all"}
          onChange={(e) => handleChange(e.target.value)}
          className="bg-transparent focus:outline-hidden text-slate-900 font-bold"
        >
          <option value="all">All Branches (Consolidated)</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
