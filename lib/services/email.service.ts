import nodemailer from "nodemailer";

interface RemarkEmailParams {
  projectNo: string;
  clientName: string;
  message: string;
  createdBy: string;
  role: "ADMIN" | "CLIENT";
  stageName?: string | null;
  timestamp: string;
}

/**
 * Sends a "New Client Remark" email to the admin inbox.
 * Fails gracefully — remark is already saved in DB before this is called.
 * Returns true on success, false on failure.
 */
export async function sendRemarkEmail(params: RemarkEmailParams): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ADMIN_EMAIL } = process.env;

  // If SMTP is not configured, skip silently (remark is still saved in DB).
  if (!SMTP_USER || !SMTP_PASS || !ADMIN_EMAIL) {
    console.warn("[email] SMTP not configured — skipping email for remark");
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST || "smtp.gmail.com",
      port: Number(SMTP_PORT) || 587,
      secure: false,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const sectionLine = params.stageName
      ? `<tr><td style="padding:6px 12px;color:#6b7280;font-size:13px">Section / Stage</td><td style="padding:6px 12px;font-weight:600;color:#111">${params.stageName}</td></tr>`
      : "";

    const subject = params.stageName
      ? `New Remark – ${params.projectNo} [${params.stageName}]`
      : `New Client Remark – ${params.projectNo}`;

    await transporter.sendMail({
      from: `"JSC MechFab ERP" <${SMTP_USER}>`,
      to: ADMIN_EMAIL,
      subject,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
          <div style="background:#1e293b;padding:20px 24px">
            <h1 style="margin:0;font-size:18px;color:#fff;font-weight:700">JSC MechFab Production ERP</h1>
            <p style="margin:4px 0 0;color:#94a3b8;font-size:13px">New remark received</p>
          </div>
          <div style="padding:24px">
            <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
              <tr style="background:#f8fafc">
                <td style="padding:6px 12px;color:#6b7280;font-size:13px">Project No</td>
                <td style="padding:6px 12px;font-weight:700;color:#111;font-family:monospace">${params.projectNo}</td>
              </tr>
              <tr>
                <td style="padding:6px 12px;color:#6b7280;font-size:13px">Client</td>
                <td style="padding:6px 12px;font-weight:600;color:#111">${params.clientName}</td>
              </tr>
              ${sectionLine}
              <tr style="background:#f8fafc">
                <td style="padding:6px 12px;color:#6b7280;font-size:13px">Posted By</td>
                <td style="padding:6px 12px;font-weight:600;color:#111">${params.createdBy} (${params.role})</td>
              </tr>
              <tr>
                <td style="padding:6px 12px;color:#6b7280;font-size:13px">Time</td>
                <td style="padding:6px 12px;color:#111;font-size:13px">${new Date(params.timestamp).toLocaleString()}</td>
              </tr>
            </table>

            <div style="margin-top:20px;background:#f1f5f9;border-left:4px solid #0ea5e9;border-radius:4px;padding:16px">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b">Message</p>
              <p style="margin:0;font-size:15px;color:#1e293b;white-space:pre-wrap">${params.message}</p>
            </div>

            <p style="margin-top:20px;font-size:12px;color:#94a3b8;text-align:center">
              This email was sent automatically by the JSC MechFab Production ERP system.
            </p>
          </div>
        </div>
      `,
    });

    return true;
  } catch (err) {
    console.error("[email] Failed to send remark email:", err);
    return false;
  }
}
