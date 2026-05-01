import { StageStatus } from "@prisma/client";
import { z } from "zod";

export const createProjectSchema = z.object({
  projectNo:    z.string().trim().min(1).max(50),
  clientId:     z.string().trim().min(1),
  equipmentType: z.string().trim().max(120).optional(),
  orderDate:    z.string().datetime().optional(),
  deliveryDate: z.string().datetime().optional()
});

export const updateStageSchema = z.object({
  id:          z.string().min(1),
  updatedAt:   z.string().datetime(),
  status:      z.nativeEnum(StageStatus).optional(),
  progress:    z.number().min(0).max(100).optional(),
  plannedDate: z.string().datetime().nullable().optional(),
  actualDate:  z.string().datetime().nullable().optional(),
  delayReason: z.string().trim().max(500).nullable().optional(),
  /** Stage-specific structured detail (drawing toggles, procurement, cutting). */
  stageDetails: z.record(z.unknown()).nullable().optional()
});

export const updateProjectTimelineSchema = z.object({
  id:                    z.string().min(1),
  updatedAt:             z.string().datetime(),
  drawingReceivedDate:   z.string().datetime().nullable(),
  /** Override production window length in days (7–365). */
  productionDurationDays: z.number().int().min(7).max(365).optional(),
  /** Skip Sundays when counting production days. */
  excludeSundays:        z.boolean().optional()
});

/** Fixed thickness values — no free text allowed anywhere in the system. */
const THICKNESS_VALUES = [
  "2mm","4mm","6mm","8mm","10mm",
  "12mm","14mm","16mm","18mm","20mm"
] as const;

/** Schema for appending a single procurement log entry. */
export const addProcurementEntrySchema = z.object({
  projectStageId: z.string().min(1),
  materialType:   z.enum(["MS", "SS"]),
  thickness:      z.enum(THICKNESS_VALUES),
  quantity:       z.number().int().min(1).max(100_000),
  sheetSize:      z.string().max(50).optional(),
  actionType:     z.enum(["ORDERED", "RECEIVED"])
});

/** Schema for client/admin remarks (project or stage-level). */
export const createRemarkSchema = z.object({
  projectId:      z.string().min(1),
  projectStageId: z.string().min(1).optional(),
  message:        z.string().trim().min(1).max(2000)
});

/** Schema for saving/updating a stage description. */
export const upsertStageDescriptionSchema = z.object({
  projectStageId: z.string().min(1),
  description:    z.string().trim().max(5000)
});

/** Schema for creating a multi-category procurement item. */
export const createProcurementItemSchema = z.object({
  projectId:    z.string().min(1),
  category:     z.enum(["SHEET_METAL","HARDWARE","ANGLE_PIPE","MACHINING_RAW","ELECTRICAL","MISCELLANEOUS"]),
  materialName: z.string().trim().min(1).max(200),
  materialType: z.string().trim().max(50).default("MS"),
  thickness:    z.string().trim().max(20).optional(),
  quantity:     z.number().positive(),
  unit:         z.string().trim().max(30).default("pcs"),
  vendor:       z.string().trim().max(200).optional()
});

/** Schema for updating a procurement item's status / received qty. */
export const updateProcurementItemSchema = z.object({
  id:          z.string().min(1),
  status:      z.enum(["ORDERED","RECEIVED","PENDING"]).optional(),
  receivedQty: z.number().min(0).optional(),
  vendor:      z.string().trim().max(200).optional()
});
