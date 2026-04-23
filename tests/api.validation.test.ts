import { describe, expect, it } from "vitest";
import { parseWithZod } from "@/lib/api";
import { createProjectSchema, updateProjectTimelineSchema, updateStageSchema } from "@/lib/validation/project";

describe("API validation", () => {
  it("validates project creation payload", () => {
    const result = parseWithZod(createProjectSchema, {
      projectNo: "9075-A",
      clientId: "client-1",
      equipmentType: "Weigh Feeder",
      orderDate: new Date().toISOString(),
      deliveryDate: new Date(Date.now() + 86400000).toISOString()
    });
    expect(result.error).toBeUndefined();
    expect(result.data?.projectNo).toBe("9075-A");
  });

  it("validates stage update payload", () => {
    const result = parseWithZod(updateStageSchema, {
      id: "stage-1",
      updatedAt: new Date().toISOString(),
      progress: 45
    });
    expect(result.error).toBeUndefined();
    expect(result.data?.progress).toBe(45);
  });

  it("validates project timeline update payload", () => {
    const result = parseWithZod(updateProjectTimelineSchema, {
      id: "proj-1",
      updatedAt: new Date().toISOString(),
      drawingReceivedDate: new Date().toISOString()
    });
    expect(result.error).toBeUndefined();
  });
});
