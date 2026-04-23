import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";
import { createProject } from "../lib/services/project.service";

const prisma = new PrismaClient();

async function main() {
  const stages = [
    ["Drawing & Design", 15, 1],
    ["Procurement", 15, 2],
    ["Cutting", 10, 3],
    ["Machining", 10, 4],
    ["Fabrication", 15, 5],
    ["Assembly", 15, 6],
    ["Testing", 10, 7],
    ["Dispatch", 10, 8]
  ] as const;

  const allowed = new Set<string>(stages.map((s) => s[0]));
  const existingStages = await prisma.productionStage.findMany({ select: { id: true, name: true } });
  const removeIds = existingStages.filter((s) => !allowed.has(s.name)).map((s) => s.id);
  if (removeIds.length) {
    await prisma.projectStage.deleteMany({ where: { stageId: { in: removeIds } } });
    await prisma.productionStage.deleteMany({ where: { id: { in: removeIds } } });
  }

  for (const [name, weight, sortOrder] of stages) {
    await prisma.productionStage.upsert({
      where: { name },
      update: { weight, sortOrder },
      create: { name, weight, sortOrder }
    });
  }

  // Client master + safe backfill (idempotent)
  const legacyClientNames = new Set<string>();
  const legacyUsers = await prisma.user.findMany({ select: { id: true, clientId: true, clientName: true } });
  for (const u of legacyUsers) {
    if (!u.clientId && u.clientName?.trim()) legacyClientNames.add(u.clientName.trim());
  }
  const legacyProjects = await prisma.project.findMany({ select: { id: true, clientId: true, clientName: true } });
  for (const p of legacyProjects) {
    if (!p.clientId && p.clientName?.trim()) legacyClientNames.add(p.clientName.trim());
  }
  for (const name of Array.from(legacyClientNames)) {
    await prisma.client.upsert({ where: { name }, update: {}, create: { name } });
  }

  const clientsByName = new Map<string, { id: string; name: string }>(
    (await prisma.client.findMany({ select: { id: true, name: true } })).map((c) => [c.name, c])
  );

  for (const u of legacyUsers) {
    if (u.clientId) continue;
    const c = clientsByName.get(u.clientName.trim());
    if (!c) continue;
    await prisma.user.update({ where: { id: u.id }, data: { clientId: c.id } });
  }
  for (const p of legacyProjects) {
    if (p.clientId) continue;
    const c = clientsByName.get(p.clientName.trim());
    if (!c) continue;
    await prisma.project.update({ where: { id: p.id }, data: { clientId: c.id } });
  }

  await prisma.user.upsert({
    where: { email: "admin@wfpcs.local" },
    update: {},
    create: {
      email: "admin@wfpcs.local",
      passwordHash: await bcrypt.hash("admin123", 10),
      role: UserRole.ADMIN,
      clientName: "system-admin"
    }
  });

  const enweighClient = await prisma.client.upsert({ where: { name: "enweigh" }, update: {}, create: { name: "enweigh" } });
  const syncroClient = await prisma.client.upsert({ where: { name: "syncro" }, update: {}, create: { name: "syncro" } });

  await prisma.user.upsert({
    where: { email: "jscmfproduction@enweigh" },
    update: {},
    create: {
      email: "jscmfproduction@enweigh",
      passwordHash: await bcrypt.hash("client1234", 10),
      role: UserRole.CLIENT,
      clientName: "enweigh",
      clientId: enweighClient.id
    }
  });

  await prisma.user.upsert({
    where: { email: "jscmfproduction@syncro" },
    update: {},
    create: {
      email: "jscmfproduction@syncro",
      passwordHash: await bcrypt.hash("client1234", 10),
      role: UserRole.CLIENT,
      clientName: "syncro",
      clientId: syncroClient.id
    }
  });

  const existing = await prisma.project.findUnique({ where: { projectNo: "9075" } });
  if (!existing) {
    const sampleClient = await prisma.client.upsert({ where: { name: "Sample Client" }, update: {}, create: { name: "Sample Client" } });
    await createProject({
      projectNo: "9075",
      clientId: sampleClient.id,
      equipmentType: "Weigh Feeder",
      orderDate: new Date().toISOString(),
      deliveryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString()
    });
  }
}

main().finally(async () => prisma.$disconnect());
