import crypto from "crypto";

export function generateRunId(): string {
  return crypto.randomBytes(4).toString("hex");
}

export function createTestOwnerFixture(runId: string = generateRunId()) {
  return {
    runId,
    fullName: `Test Owner ${runId}`,
    email: `owner_${runId}@test.gymapra.com`,
    phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: `Password_${runId}!123`,
    gymName: `Apex Gym ${runId}`,
    branchName: `Main Branch`,
  };
}

export function createTestStaffFixture(runId: string, role: "partner" | "manager" | "staff" | "trainer" = "staff") {
  return {
    runId,
    fullName: `Staff ${role} ${runId}`,
    email: `${role}_${runId}@test.gymapra.com`,
    role,
    phone: `+9197${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: `StaffPass_${runId}!123`,
  };
}

export function createTestMemberFixture(runId: string) {
  return {
    runId,
    fullName: `Member ${runId}`,
    phone: `+9199${Math.floor(10000000 + Math.random() * 90000000)}`,
    email: `member_${runId}@test.gymapra.com`,
  };
}
