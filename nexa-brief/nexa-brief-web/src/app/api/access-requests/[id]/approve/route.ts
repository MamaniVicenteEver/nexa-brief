import { buildCredentialsEmail } from "@/features/auth/email/templates";
import { generateRandomPassword, hashPassword } from "@/features/auth/lib/password";
import { isTokenExpired } from "@/features/auth/lib/tokens";
import { getAccessRequestRepository, getUserRepository } from "@/features/auth/repositories";
import { sendEmail } from "@/infrastructure/email/resend-client";

function htmlResponse(message: string, status: number) {
  return new Response(
    `<!doctype html><html><body style="font-family: sans-serif; max-width: 480px; margin: 80px auto; text-align: center;"><p>${message}</p></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token");

  if (!token) {
    return htmlResponse("Link inválido.", 400);
  }

  const accessRequestRepo = getAccessRequestRepository();
  const accessRequest = await accessRequestRepo.findById(id);

  if (!accessRequest) {
    return htmlResponse("Solicitud no encontrada.", 404);
  }
  if (accessRequest.status !== "pending") {
    return htmlResponse("Esta solicitud ya fue procesada.", 409);
  }
  if (accessRequest.approveToken !== token) {
    return htmlResponse("Link inválido.", 400);
  }
  if (isTokenExpired(accessRequest.approveTokenExpiresAt)) {
    return htmlResponse("Este link de aprobación venció.", 410);
  }

  const tempPassword = generateRandomPassword();
  const passwordHash = await hashPassword(tempPassword);
  await getUserRepository().create({
    email: accessRequest.email,
    name: accessRequest.name,
    passwordHash,
  });
  await accessRequestRepo.markApproved(id);

  const appUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const { subject, html } = buildCredentialsEmail({
      name: accessRequest.name,
      email: accessRequest.email,
      tempPassword,
      loginUrl: `${appUrl}/login`,
    });
    await sendEmail({ to: accessRequest.email, subject, html });
  } catch (error) {
    console.error("Failed to send credentials email", error);
    return htmlResponse(
      "Usuario creado, pero falló el envío del email con las credenciales. Revisá los logs.",
      200,
    );
  }

  return htmlResponse(`Acceso aprobado. Se envió un email a ${accessRequest.email}.`, 200);
}
