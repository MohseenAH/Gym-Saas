import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Guard Test: Enforces Next.js 16 / React 19 "use server" Specification
 * https://nextjs.org/docs/messages/invalid-use-server-value
 *
 * In Next.js, files marked with "use server" can ONLY export async functions
 * (and compile-time erased TypeScript `type` / `interface` declarations).
 * Exporting const, let, var, class, enum, or synchronous functions causes
 * "Error: A 'use server' file can only export async functions, found object" on Vercel
 * and Minified React error #441 on the client.
 */
describe('"use server" Exports Specification Guard', () => {
  const v2Root = path.resolve(__dirname, "../../");
  const actionsDir = path.resolve(v2Root, "lib/actions");

  function findUseServerFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === "dist" ||
        entry.name === "tests" ||
        entry.name === ".git"
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        results.push(...findUseServerFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        const content = fs.readFileSync(fullPath, "utf-8");
        // Match top-level "use server" or 'use server' directive
        if (/^\s*["']use server["'];?/m.test(content)) {
          results.push(fullPath);
        }
      }
    }

    return results;
  }

  it('verifies every file in v2/lib/actions/ has a top-level "use server" directive', () => {
    expect(fs.existsSync(actionsDir)).toBe(true);
    const actionFiles = fs
      .readdirSync(actionsDir)
      .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));

    expect(actionFiles.length).toBeGreaterThan(0);

    for (const file of actionFiles) {
      const fullPath = path.join(actionsDir, file);
      const content = fs.readFileSync(fullPath, "utf-8");
      const trimmed = content.trim();

      const hasTopLevelUseServer =
        trimmed.startsWith('"use server"') ||
        trimmed.startsWith("'use server'") ||
        /^\s*["']use server["'];?/m.test(content);

      expect(
        hasTopLevelUseServer,
        `File ${file} in v2/lib/actions/ must declare "use server" directive at the top`
      ).toBe(true);
    }
  });

  it('asserts that every export in a "use server" file is strictly an async function or type', () => {
    const useServerFiles = findUseServerFiles(v2Root);
    expect(useServerFiles.length).toBeGreaterThan(0);

    const violations: Array<{ file: string; line: number; text: string }> = [];

    // Allowed patterns:
    // export async function ...
    // export default async function ...
    // export type ...
    // export type { ... }
    // export interface ...
    const allowedExportPattern =
      /^\s*export\s+(async\s+function|default\s+async\s+function|type\s+|interface\s+|type\s*\{)/;

    for (const filePath of useServerFiles) {
      const relativePath = path.relative(v2Root, filePath);
      const lines = fs.readFileSync(filePath, "utf-8").split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Check if line begins with export (and not a comment)
        if (trimmed.startsWith("export ") || trimmed.startsWith("export\t")) {
          // Verify it matches allowed async function or type/interface definition
          if (!allowedExportPattern.test(trimmed)) {
            violations.push({
              file: relativePath,
              line: i + 1,
              text: trimmed,
            });
          }
        }
      }
    }

    expect(
      violations,
      `Found illegal non-function exports in "use server" files:\n${violations
        .map((v) => `  ${v.file}:${v.line} -> ${v.text}`)
        .join("\n")}`
    ).toEqual([]);
  });
});
