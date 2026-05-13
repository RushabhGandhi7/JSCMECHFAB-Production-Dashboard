import { NextApiRequest, NextApiResponse } from "next";
import { fail, withApiHandler } from "@/lib/api";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

const CAT_LABEL: Record<string, string> = {
  SHEET_METAL: "Sheet Metal", HARDWARE: "Hardware", ANGLE_PIPE: "Angle / Pipe",
  MACHINING_RAW: "Machining Raw", ELECTRICAL: "Electrical", MISCELLANEOUS: "Miscellaneous",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(req, res, async () => {
    const user = await getAuthedUserFromApiRequest(req);
    if (!user) return fail(res, "Unauthorized", 401);
    if (user.role !== "ADMIN") return fail(res, "Admin only", 403);
    if (req.method !== "GET") return fail(res, "Method not allowed", 405);

    const { projectId } = req.query;

    const where: Record<string, unknown> = {};
    if (projectId && typeof projectId === "string") where.projectId = projectId;

    const items = await prisma.procurementItem.findMany({
      where: { ...where, NOT: { isDeleted: true } },
      include: {
        project: { select: { projectNo: true, clientName: true, client: { select: { name: true } } } },
        logs:    { orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ category: "asc" }, { createdAt: "asc" }],
    });

    const rows = items.map(item => {
      const logSummary = item.logs
        .map(l => `[${new Date(l.createdAt).toLocaleDateString()}] ${l.action}${l.newValue ? ": " + l.newValue : ""}`)
        .join(" | ");

      return {
        "Project No":       item.project.projectNo,
        "Client":           item.project.client?.name ?? item.project.clientName,
        "Category":         CAT_LABEL[item.category] ?? item.category,
        "Material Name":    item.materialName,
        "Material Type":    item.materialType,
        "Thickness (mm)":   item.thickness ?? "",
        "Length (mm)":      item.lengthMm ?? "",
        "Width (mm)":       item.widthMm ?? "",
        "Quantity":         item.quantity,
        "Received Qty":     item.receivedQty,
        "Unit":             item.unit,
        "Weight (kg)":      item.weightKg ?? "",
        "Rate/kg (₹)":      item.ratePerKg ?? "",
        "Total Value (₹)":  item.totalValue ?? "",
        "Status":           item.status,
        "Vendor":           item.vendor ?? "",
        "Notes":            item.notes ?? "",
        "Created At":       item.createdAt.toISOString().replace("T", " ").slice(0, 19),
        "Updated At":       item.updatedAt.toISOString().replace("T", " ").slice(0, 19),
        "Activity Log":     logSummary,
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] ?? {}).map(k => ({ wch: Math.max(k.length, 14) }));
    XLSX.utils.book_append_sheet(wb, ws, "Procurement");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const projSuffix = projectId ? `_${projectId.slice(0, 8)}` : "";
    const filename = `JSC_Procurement${projSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buf);
  });
}
