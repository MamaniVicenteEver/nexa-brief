import { NextResponse } from "next/server";
import { buildAdminApprovalEmail } from "@/features/auth/email/templates";
import { generateApproveToken } from "@/features/auth/lib/tokens";
import { getAccessRequestRepository } from "@/features/auth/repositories";
import { accessRequestSchema } from "@/features/auth/schema";
import { sendEmail } from "@/infrastructure/email/resend-client";

/** El form solo pide email (matching el prototipo) — el nombre para los
 * emails se deriva del local-part, ej. "walker.perez@x.com" -> "Walker Perez". */
function deriveNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? email;
  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = accessRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues }, { status: 422 });
  }

  const { token, expiresAt } = generateApproveToken();
  const accessRequest = await getAccessRequestRepository().create({
    name: deriveNameFromEmail(parsed.data.email),
    email: parsed.data.email,
    message: parsed.data.message ?? "",
    approveToken: token,
    approveTokenExpiresAt: expiresAt,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const approveUrl = `${appUrl}/api/access-requests/${accessRequest.id}/approve?token=${token}`;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (adminEmail) {
    try {
      const { subject, html } = buildAdminApprovalEmail({
        name: accessRequest.name,
        email: accessRequest.email,
        message: accessRequest.message,
        approveUrl,
      });
      await sendEmail({ to: adminEmail, subject, html });
    } catch (error) {
      // La solicitud ya quedó persistida — un fallo de envío de email no debe
      // devolver un error confuso al solicitante.
      console.error("Failed to send admin approval email", error);
    }
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
