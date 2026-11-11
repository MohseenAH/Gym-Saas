"use client";

import { useState, useRef } from "react";
import {
  Upload,
  X,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Users,
  Building2,
  AlertTriangle,
  ArrowRight,
  Filter,
} from "lucide-react";
import {
  previewBulkImportMembersAction,
  bulkImportMembersAction,
  BulkImportPreviewResult,
  PreviewImportRow,
} from "@/lib/actions/members";
import { parseCsv } from "@/lib/utils";

interface BulkImportModalProps {
  gymId: string;
  branchId: string;
  branches?: Array<{ id: string; name: string }>;
}

export function BulkImportModal({
  gymId,
  branchId: initialBranchId,
  branches = [],
}: BulkImportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(
    initialBranchId || branches[0]?.id || ""
  );

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [previewResult, setPreviewResult] = useState<BulkImportPreviewResult | null>(
    null
  );
  const [filterTab, setFilterTab] = useState<"all" | "valid" | "exists" | "invalid">("all");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const csvTemplateData =
    "Full Name,Phone,Email,Notes\n" +
    "Rahul Sharma,9876543210,rahul@example.com,Morning Batch\n" +
    "Priya Patel,+91 98765 43211,priya@example.com,Personal Training\n" +
    "Amit Verma,09876543212,,Evening Regular";
  const csvDataUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csvTemplateData)}`;

  function handleReset() {
    setFile(null);
    setPreviewResult(null);
    setError(null);
    setSuccessMessage(null);
    setFilterTab("all");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleClose() {
    setIsOpen(false);
    handleReset();
  }

  async function handleFileProcess(selectedFile: File) {
    setError(null);
    setSuccessMessage(null);

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a standard CSV (.csv) file.");
      return;
    }

    setFile(selectedFile);
    setIsPreviewing(true);

    try {
      const text = await selectedFile.text();
      const rawRows = parseCsv(text);

      if (rawRows.length === 0) {
        setError("The uploaded CSV has no data rows. Please use our template format.");
        setIsPreviewing(false);
        return;
      }

      if (rawRows.length > 500) {
        setError(`File contains ${rawRows.length} rows. Maximum batch limit is 500 rows.`);
        setIsPreviewing(false);
        return;
      }

      const res = await previewBulkImportMembersAction(
        gymId,
        selectedBranchId,
        rawRows
      );

      if (!res.success) {
        setError(res.error || "Failed to analyze CSV rows");
      } else {
        setPreviewResult(res);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to read CSV file");
    } finally {
      setIsPreviewing(false);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  }

  async function handleExecuteImport() {
    if (!previewResult) return;

    const validRows = previewResult.rows
      .filter((r) => r.status === "VALID")
      .map((r) => ({
        fullName: r.parsed.fullName,
        phone: r.parsed.phone,
        email: r.parsed.email,
        notes: r.parsed.notes,
      }));

    if (validRows.length === 0) {
      setError("No valid members available to import.");
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const res = await bulkImportMembersAction(gymId, selectedBranchId, validRows);
      if (!res.success) {
        setError(res.error || "Bulk import failed");
      } else {
        setSuccessMessage(
          `Successfully imported ${res.importedCount} member(s)!` +
            (res.skippedCount > 0 ? ` (${res.skippedCount} duplicates skipped)` : "")
        );
        setPreviewResult(null);
        setFile(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to execute import");
    } finally {
      setIsImporting(false);
    }
  }

  const displayedRows = (previewResult?.rows || []).filter((r) => {
    if (filterTab === "valid") return r.status === "VALID";
    if (filterTab === "exists") return r.status === "ALREADY_EXISTS";
    if (filterTab === "invalid") return r.status === "INVALID";
    return true;
  });

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center gap-2 h-10 sm:h-11 px-4 py-2 bg-card hover:bg-muted/80 text-foreground border border-border rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer w-full sm:w-auto"
      >
        <Upload className="w-4 h-4 text-primary" />
        <span>Import Members</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-card text-card-foreground rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-2xl shadow-2xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">
                    Bulk Import Members
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Upload a CSV file to add multiple members at once
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Branch Selector if multiple branches exist */}
              {branches.length > 1 && (
                <div className="p-3 bg-muted/40 rounded-2xl border border-border/60 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 font-bold text-foreground">
                    <Building2 className="w-4 h-4 text-primary" />
                    <span>Assign Target Branch:</span>
                  </div>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    disabled={isPreviewing || isImporting}
                    className="h-9 px-3 bg-card border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status / Error Banner */}
              {error && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-2xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-2xl text-xs font-bold flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                  <button
                    onClick={handleClose}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Upload Dropzone (if no preview loaded) */}
              {!previewResult && !successMessage && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-8 border-2 border-dashed rounded-3xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/20 bg-muted/10"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                      {isPreviewing ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-foreground">
                        {isPreviewing ? "Analyzing CSV format..." : "Drop CSV file here or click to browse"}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Supports standard Indian phone numbers (+91, 0, spaced, or 10-digit)
                      </p>
                    </div>
                  </div>

                  {/* Template download prompt */}
                  <div className="p-3.5 bg-muted/40 rounded-2xl border border-border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
                      <span>Need the official template?</span>
                    </div>
                    <a
                      href={csvDataUri}
                      download="gymapra_member_import_template.csv"
                      className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .CSV</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Preview Analysis Results Table */}
              {previewResult && (
                <div className="space-y-3">
                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2.5 bg-muted/40 rounded-xl border border-border">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Total Rows</div>
                      <div className="text-base font-black text-foreground mt-0.5">
                        {previewResult.summary.totalRows}
                      </div>
                    </div>
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                      <div className="text-[10px] uppercase font-bold text-emerald-600">Valid to Import</div>
                      <div className="text-base font-black text-emerald-600 mt-0.5">
                        {previewResult.summary.validCount}
                      </div>
                    </div>
                    <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                      <div className="text-[10px] uppercase font-bold text-amber-600">Already in Gym</div>
                      <div className="text-base font-black text-amber-600 mt-0.5">
                        {previewResult.summary.alreadyExistsCount}
                      </div>
                    </div>
                    <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20">
                      <div className="text-[10px] uppercase font-bold text-rose-600">Invalid / Error</div>
                      <div className="text-base font-black text-rose-600 mt-0.5">
                        {previewResult.summary.invalidCount}
                      </div>
                    </div>
                  </div>

                  {/* Filter Sub-Tabs */}
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                    <div className="flex items-center gap-1 text-xs">
                      <button
                        onClick={() => setFilterTab("all")}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                          filterTab === "all"
                            ? "bg-foreground text-background shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        All ({previewResult.rows.length})
                      </button>
                      <button
                        onClick={() => setFilterTab("valid")}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                          filterTab === "valid"
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Valid ({previewResult.summary.validCount})
                      </button>
                      <button
                        onClick={() => setFilterTab("exists")}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                          filterTab === "exists"
                            ? "bg-amber-600 text-white shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Exists ({previewResult.summary.alreadyExistsCount})
                      </button>
                      <button
                        onClick={() => setFilterTab("invalid")}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                          filterTab === "invalid"
                            ? "bg-rose-600 text-white shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Invalid ({previewResult.summary.invalidCount})
                      </button>
                    </div>

                    <button
                      onClick={handleReset}
                      className="text-xs font-bold text-muted-foreground hover:text-foreground underline cursor-pointer"
                    >
                      Upload Different File
                    </button>
                  </div>

                  {/* Preview Rows List */}
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {displayedRows.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        No rows in this filter.
                      </div>
                    ) : (
                      displayedRows.map((r) => (
                        <div
                          key={r.rowIndex}
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-colors ${
                            r.status === "VALID"
                              ? "bg-emerald-500/5 border-emerald-500/20"
                              : r.status === "ALREADY_EXISTS"
                              ? "bg-amber-500/5 border-amber-500/20"
                              : "bg-rose-500/5 border-rose-500/20"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-muted-foreground">
                                #{r.rowIndex}
                              </span>
                              <span className="font-bold text-foreground truncate">
                                {r.parsed.fullName || "—"}
                              </span>
                              <span className="font-mono text-xs text-foreground">
                                {r.parsed.phone || "No phone"}
                              </span>
                            </div>
                            {r.reasons.length > 0 && (
                              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                {r.reasons.join(" • ")}
                              </div>
                            )}
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                              r.status === "VALID"
                                ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                                : r.status === "ALREADY_EXISTS"
                                ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                                : "bg-rose-500/15 text-rose-600 border border-rose-500/30"
                            }`}
                          >
                            {r.status === "VALID"
                              ? "Ready"
                              : r.status === "ALREADY_EXISTS"
                              ? "Duplicate"
                              : "Error"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="pt-4 border-t border-border flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={handleClose}
                className="h-10 px-4 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {previewResult && (
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={!previewResult.canProceed || isImporting}
                  className="h-10 px-5 bg-primary hover:opacity-95 text-primary-foreground rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <span>Import {previewResult.summary.validCount} Valid Member(s)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
