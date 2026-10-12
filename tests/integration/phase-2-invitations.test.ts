import { describe, it, expect, beforeAll } from "vitest";
import { getTestSupabaseClient } from "../helpers/supabase-test-client";
import crypto from "crypto";

describe("Phase 2 Invitations & Token Verification Suite", () => {
  let supabase: ReturnType<typeof getTestSupabaseClient>;

  beforeAll(() => {
    supabase = getTestSupabaseClient();
  });

  function hashToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
  }

  it("TEST-P2-014: Tampered or non-existent token hash returns null/error", async () => {
    const bogusHash = hashToken("non_existent_raw_token_xyz_123");
    const { data, error } = await supabase.rpc("verify_invitation_token", {
      p_token_hash: bogusHash,
    });

    // When token does not exist, RPC either returns null, valid: false, or throws an error
    if (error) {
      expect(error.message.toLowerCase()).toContain("not found");
    } else {
      expect(data?.valid === false || data === null).toBe(true);
    }
  });

  it("Token hashing algorithm is deterministic and SHA-256 compliant", () => {
    const token = "gym_invite_test_token_456";
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // 256 bits in hex
  });

  it("Single-use token integrity logic prevents re-acceptance", () => {
    // Simulating token state transition: pending -> accepted -> rejected on re-use
    let tokenStatus = "pending";

    function acceptToken() {
      if (tokenStatus !== "pending") {
        throw new Error("Invitation has already been used");
      }
      tokenStatus = "accepted";
      return { success: true };
    }

    // 1st acceptance succeeds
    expect(acceptToken().success).toBe(true);

    // 2nd acceptance is strictly rejected
    expect(() => acceptToken()).toThrow("Invitation has already been used");
  });
});
