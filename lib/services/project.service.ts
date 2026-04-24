import { Prisma, ProjectStatus, StageStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeDaysRemaining,
  expectedCompletionFromDrawingDate
} from "@/lib/project-timeline";

export const projectInclude = {
  client: { select: { id: true, name: true } },
  stages: { include: { stage: true }, orderBy: { stage: { sortOrder: "asc" as const } } },
  activityLogs: { orderBy: { createdAt: "desc" as const }, take: 50 },
  stageProgressLogs: { orderBy: { createdAt: "desc" as const }, take: 200 }
};

type ProjectWithStages = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;
export type AccessScope = {
  role: "ADMIN" | "CLIENT";
  clientName?: string;
  clientId?: string | null;
};

type ProjectForMetrics = Pick<ProjectWithStages, "drawingReceivedDate" | "expectedCompletionDate" | "stages">;

export function resolveExpectedCompletion(project: {
  drawingReceivedDate: Date | null;
  expectedCompletionDate: Date | null;
}) {
  // Prefer the stored value (correct after variable-timeline saves).
  // Fall back to re-computing from drawingReceivedDate for untouched legacy projects.
  return (
    project.expectedCompletionDate ??
    (project.drawingReceivedDate
      ? expectedCompletionFromDrawingDate(project.drawingReceivedDate)
      : null)
  );
}

export function calculateProjectMetrics(project: ProjectForMetrics, now = new Date()) {
  const totalProgress = project.stages.reduce((sum, s) => sum + (s.progress * s.stage.weight) / 100, 0);
  const currentStage = project.stages.find((s) => s.status === StageStatus.IN_PROGRESS);
  const hasDelayedStage = project.stages.some((s) => s.isDelayed);

  const expected = resolveExpectedCompletion(project);
  const daysRemaining = expected ? computeDaysRemaining(expected, now) : null;
  const timelineOverdue = daysRemaining !== null && daysRemaining < 0;

  return {
    totalProgress: Number(totalProgress.toFixed(2)),
    currentStage: currentStage?.stage.name ?? "Not Started",
    daysRemaining,
    timelineOverdue,
    hasDelayedStage,
    expectedCompletionDate: expected
  };
}

function deriveProjectStatus(
  metrics: ReturnType<typeof calculateProjectMetrics>,
  dispatchedAt?: Date | null
): ProjectStatus {
  // DISPATCHED is a terminal state — preserve it through any recomputation
  if (dispatchedAt) return ProjectStatus.DISPATCHED;
  if (metrics.timelineOverdue || metrics.hasDelayedStage) return ProjectStatus.DELAYED;
  if (metrics.totalProgress >= 99.99) return ProjectStatus.COMPLETED;
  if (metrics.totalProgress > 0) return ProjectStatus.IN_PRODUCTION;
  return ProjectStatus.PLANNING;
}

const activeProjectWhere: Prisma.ProjectWhereInput = {
  deletedAt: null,
  isDeleted: false
};

/** Used for listing active work — excludes DISPATCHED (final state shown on /dispatched page). */
const activeNonDispatchedWhere: Prisma.ProjectWhereInput = {
  ...activeProjectWhere,
  status: { not: ProjectStatus.DISPATCHED }
};

export async function listProjects(scope?: AccessScope) {
  const tenantOr: Prisma.ProjectWhereInput[] = [
    scope?.clientId ? { clientId: scope.clientId } : undefined,
    scope?.clientName ? { clientName: scope.clientName, clientId: null } : undefined
  ].filter(Boolean) as Prisma.ProjectWhereInput[];

  const where: Prisma.ProjectWhereInput =
    scope?.role === "CLIENT"
      ? {
          AND: [activeNonDispatchedWhere, { OR: tenantOr }]
        }
      : activeNonDispatchedWhere;

  const projects = await prisma.project.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      stages: {
        select: {
          progress: true,
          status: true,
          isDelayed: true,
          stage: { select: { name: true, weight: true, sortOrder: true } }
        },
        orderBy: { stage: { sortOrder: "asc" } }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return projects.map((project) => {
    const metrics = calculateProjectMetrics(project as ProjectWithStages);
    return { ...project, metrics };
  });
}

export async function getProjectById(id: string, scope?: AccessScope) {
  const tenantOr: Prisma.ProjectWhereInput[] = [
    scope?.clientId ? { clientId: scope.clientId } : undefined,
    scope?.clientName ? { clientName: scope.clientName, clientId: null } : undefined
  ].filter(Boolean) as Prisma.ProjectWhereInput[];

  const where: Prisma.ProjectWhereInput =
    scope?.role === "CLIENT"
      ? {
          AND: [{ id }, activeProjectWhere, { OR: tenantOr }]
        }
      : { id, ...activeProjectWhere };
  const project = await prisma.project.findFirst({ where, include: projectInclude });
  if (!project) return null;
  return { ...project, metrics: calculateProjectMetrics(project) };
}

/** Admin-only: projects in trash (soft-deleted). */
export async function listDeletedProjects() {
  return prisma.project.findMany({
    where: {
      OR: [{ deletedAt: { not: null } }, { isDeleted: true }]
    },
    include: {
      client: { select: { id: true, name: true } }
    },
    orderBy: [{ deletedAt: "desc" }, { updatedAt: "desc" }]
  });
}

export async function createProject(input: {
  projectNo: string;
  clientId: string;
  equipmentType?: string;
  orderDate?: string;
  deliveryDate?: string;
}) {
  return prisma.$transaction(async (tx) => {
    // ── Validate client exists ──────────────────────────────────────────────
    const client = await tx.client.findUnique({ where: { id: input.clientId } });
    if (!client) throw new Error("Client not found. Please select a valid client from the dropdown.");

    // ── Pre-check duplicate projectNo (gives a clean 409, not a Prisma crash) ─
    const duplicate = await tx.project.findFirst({
      where: { projectNo: input.projectNo, isDeleted: false },
      select: { id: true }
    });
    if (duplicate) throw new Error(`Project number "${input.projectNo}" already exists. Please use a unique project number.`);

    // ── Load production stages ──────────────────────────────────────────────
    const stages = await tx.productionStage.findMany({ select: { id: true }, orderBy: { sortOrder: "asc" } });
    if (!stages.length) throw new Error("No production stages configured. Run the DB seed before creating projects.");

    const project = await tx.project.create({
      data: {
        projectNo: input.projectNo,
        clientId: input.clientId,
        clientName: client.name,
        equipmentType: input.equipmentType?.trim() || "—",
        orderDate: input.orderDate ? new Date(input.orderDate) : new Date(),
        deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : new Date(),
        stages: { create: stages.map((stage) => ({ stageId: stage.id })) }
      },
      include: projectInclude
    });

    await tx.activityLog.create({
      data: {
        projectId: project.id,
        action: "PROJECT_CREATED",
        entity: "Project",
        entityId: project.id,
        details: { projectNo: project.projectNo }
      }
    });

    return { ...project, metrics: calculateProjectMetrics(project) };
  }, { maxWait: 5000, timeout: 20000 });
}

export async function updateProjectTimeline(input: {
  id: string;
  updatedAt: string;
  drawingReceivedDate: string | null;
  /** Override production window (days). Falls back to project's stored value. */
  productionDurationDays?: number;
  /** Skip Sundays in working-day count. Falls back to project's stored value. */
  excludeSundays?: boolean;
}, scope?: AccessScope) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.project.findFirst({
      where:
        scope?.role === "CLIENT"
          ? { id: input.id, clientName: scope.clientName }
          : { id: input.id }
    });
    if (!current) throw new Error("Project not found");
    if (new Date(input.updatedAt).getTime() !== current.updatedAt.getTime()) {
      throw new Error("Stale data. Please refresh and retry.");
    }

    // Use provided values or fall back to the project's current settings
    const durationDays   = input.productionDurationDays ?? current.productionDurationDays;
    const excSundays     = input.excludeSundays         ?? current.excludeSundays;

    const drawingReceivedDate  = input.drawingReceivedDate ? new Date(input.drawingReceivedDate) : null;
    const expectedCompletionDate = drawingReceivedDate
      ? expectedCompletionFromDrawingDate(drawingReceivedDate, durationDays, excSundays)
      : null;

    const updated = await tx.project.update({
      where: { id: input.id },
      data: {
        drawingReceivedDate,
        expectedCompletionDate,
        productionDurationDays: durationDays,
        excludeSundays: excSundays
      },
      include: projectInclude
    });

    await tx.activityLog.create({
      data: {
        projectId: updated.id,
        action: "PROJECT_TIMELINE_UPDATED",
        entity: "Project",
        entityId: updated.id,
        // Store ISO strings, not Date objects, in the Json column.
        details: {
          drawingReceivedDate:   drawingReceivedDate?.toISOString()   ?? null,
          expectedCompletionDate: expectedCompletionDate?.toISOString() ?? null,
          productionDurationDays: durationDays,
          excludeSundays:         excSundays
        }
      }
    });

    await recomputeProjectStatus(updated.id, tx);
    const fresh = await tx.project.findUnique({ where: { id: updated.id }, include: projectInclude });
    if (!fresh) throw new Error("Project not found after update");
    return { ...fresh, metrics: calculateProjectMetrics(fresh) };
  }, { maxWait: 5000, timeout: 20000 });
}

export async function recomputeProjectStatus(
  projectId: string,
  txClient: Prisma.TransactionClient | Prisma.DefaultPrismaClient = prisma
) {
  const project = await txClient.project.findUnique({ where: { id: projectId }, include: projectInclude });
  if (!project) return null;
  const metrics = calculateProjectMetrics(project);
  // Pass dispatchedAt so DISPATCHED is never overwritten by recomputation
  const status = deriveProjectStatus(metrics, project.dispatchedAt);

  await txClient.project.update({ where: { id: projectId }, data: { status } });
  return status;
}

/** Admin-only: list all dispatched (final) projects. */
export async function listDispatchedProjects() {
  return prisma.project.findMany({
    where: { status: ProjectStatus.DISPATCHED, isDeleted: false },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { dispatchedAt: "desc" }
  });
}

/**
 * Mark a project as DISPATCHED.
 * completionDays = floor((dispatchedAt - createdAt) / ms_per_day)
 * Uses createdAt → dispatchedAt as mandated.
 */
export async function dispatchProject(id: string) {
  const dispatchedAt = new Date();
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id },
      select: { id: true, projectNo: true, createdAt: true, status: true, isDeleted: true }
    });
    if (!project) throw new Error("Project not found");
    if (project.isDeleted) throw new Error("Project is deleted");
    if (project.status === ProjectStatus.DISPATCHED) throw new Error("Project is already dispatched");

    const MS_PER_DAY = 86_400_000;
    // completionDays = createdAt → dispatchedAt (in full calendar days)
    const completionDays = Math.floor(
      (dispatchedAt.getTime() - project.createdAt.getTime()) / MS_PER_DAY
    );

    const updated = await tx.project.update({
      where: { id },
      data: {
        status: ProjectStatus.DISPATCHED,
        dispatchedAt,
        completionDays
      },
      select: { id: true, projectNo: true, status: true, dispatchedAt: true, completionDays: true }
    });

    await tx.activityLog.create({
      data: {
        projectId: updated.id,
        action: "PROJECT_DISPATCHED",
        entity: "Project",
        entityId: updated.id,
        // Store ISO string, not Date object, in the Json column.
        details: { projectNo: updated.projectNo, dispatchedAt: dispatchedAt.toISOString(), completionDays }
      }
    });

    return updated;
  }, { maxWait: 5000, timeout: 20000 });
}
