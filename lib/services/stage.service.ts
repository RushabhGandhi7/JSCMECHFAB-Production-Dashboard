import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recomputeProjectStatus } from "@/lib/services/project.service";
import type { AccessScope } from "@/lib/services/project.service";

export async function updateProjectStage(
  input: {
    id: string;
    updatedAt: string;
    status?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
    progress?: number;
    plannedDate?: string | null;
    actualDate?: string | null;
    delayReason?: string | null;
    /** Stage-specific structured detail JSON (drawing toggles, procurement, cutting). */
    stageDetails?: Record<string, unknown> | null;
    /** Set server-side from the authenticated session — never from client body. */
    updatedBy?: string;
  },
  scope?: AccessScope
) {
  return prisma.$transaction(async (tx) => {
    // ── Read current state (include stage name for log entries) ─────────────
    const current = await tx.projectStage.findUnique({
      where: { id: input.id },
      include: {
        project: { select: { clientId: true, clientName: true } },
        stage: { select: { name: true } }
      }
    });
    if (!current) throw new Error("Stage not found");

    // ── Tenant scope check ──────────────────────────────────────────────────
    if (
      scope?.role === "CLIENT" &&
      !(
        (scope.clientId && current.project.clientId === scope.clientId) ||
        (!current.project.clientId && scope.clientName && current.project.clientName === scope.clientName)
      )
    ) {
      throw new Error("Project not found");
    }

    // ── Optimistic concurrency guard ────────────────────────────────────────
    if (new Date(input.updatedAt).getTime() !== current.updatedAt.getTime()) {
      throw new Error("Stale data. Please refresh and retry.");
    }

    // ── Derive date/delay fields ────────────────────────────────────────────
    const plannedDate =
      input.plannedDate === undefined
        ? current.plannedDate
        : input.plannedDate
        ? new Date(input.plannedDate)
        : null;

    const actualDate =
      input.actualDate === undefined
        ? current.actualDate
        : input.actualDate
        ? new Date(input.actualDate)
        : null;

    const isDelayed = Boolean(plannedDate && actualDate && actualDate > plannedDate);

    // ── Build update payload ────────────────────────────────────────────────
    const updatePayload: Prisma.ProjectStageUpdateInput = {
      plannedDate,
      actualDate,
      isDelayed
    };
    if (input.status     !== undefined) updatePayload.status     = input.status;
    if (input.progress   !== undefined) updatePayload.progress   = input.progress;
    if (input.delayReason !== undefined) updatePayload.delayReason = input.delayReason;
    if (input.stageDetails !== undefined) {
      // null clears the JSON field; any object stores it as-is
      updatePayload.stageDetails =
        input.stageDetails === null
          ? Prisma.JsonNull
          : (input.stageDetails as Prisma.InputJsonValue);
    }

    const updated = await tx.projectStage.update({
      where: { id: input.id },
      data: updatePayload
    });

    // ── Append-only StageProgressLog entries ────────────────────────────────
    // Only log fields that actually changed — keeps logs meaningful.
    const stageName  = current.stage.name;
    const updatedBy  = input.updatedBy || "admin";
    const logBase    = { projectId: updated.projectId, projectStageId: updated.id, stageName, updatedBy };

    if (input.progress !== undefined && input.progress !== Number(current.progress)) {
      await tx.stageProgressLog.create({
        data: { ...logBase, field: "progress", previousValue: `${current.progress}%`, newValue: `${input.progress}%` }
      });
    }

    if (input.status !== undefined && input.status !== current.status) {
      await tx.stageProgressLog.create({
        data: { ...logBase, field: "status", previousValue: current.status, newValue: input.status }
      });
    }

    if (input.delayReason !== undefined && input.delayReason !== current.delayReason) {
      await tx.stageProgressLog.create({
        data: {
          ...logBase,
          field: "delayReason",
          previousValue: current.delayReason ?? "None",
          newValue: input.delayReason ?? "None"
        }
      });
    }

    // ── Preserve existing ActivityLog entry ─────────────────────────────────
    await tx.activityLog.create({
      data: {
        projectId: updated.projectId,
        action: "STAGE_UPDATED",
        entity: "ProjectStage",
        entityId: updated.id,
        details: { status: updated.status, progress: updated.progress, isDelayed: updated.isDelayed }
      }
    });

    // ── Recompute project-level status ──────────────────────────────────────
    await recomputeProjectStatus(updated.projectId, tx);
    return updated;
  }, { maxWait: 5000, timeout: 20000 });
}
