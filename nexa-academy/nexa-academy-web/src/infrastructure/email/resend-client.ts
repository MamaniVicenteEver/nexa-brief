import { Resend } from "resend";

let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY no está configurado");
  }
  resend ??= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM no está configurado");
  }
  const { error } = await getResendClient().emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
