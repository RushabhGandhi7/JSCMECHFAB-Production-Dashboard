import { describe, expect, it } from "vitest";
import { buildEquipmentType, parseEquipmentType } from "@/lib/v5/projectMeta";

describe("v5 project metadata helpers", () => {
  it("builds and parses description + notes", () => {
    const encoded = buildEquipmentType("Rotary Weigh Feeder", "Line-2 retrofit");
    const parsed = parseEquipmentType(encoded);
    expect(parsed.projectDescription).toBe("Rotary Weigh Feeder");
    expect(parsed.projectNotes).toBe("Line-2 retrofit");
  });

  it("parses legacy equipment string as description", () => {
    const parsed = parseEquipmentType("Legacy Equipment Name");
    expect(parsed.projectDescription).toBe("Legacy Equipment Name");
    expect(parsed.projectNotes).toBe("");
  });
});
