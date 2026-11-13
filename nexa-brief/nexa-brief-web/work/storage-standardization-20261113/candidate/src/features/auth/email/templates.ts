interface AdminApprovalEmailInput {
  name: string;
  email: string;
  message: string;
  approveUrl: string;
}

export function buildAdminApprovalEmail(input: AdminApprovalEmailInput): {
  subject: string;
  html: string;
} {
  return {
    subject: `Nueva solicitud de acceso — ${input.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Nueva solicitud de acceso</h2>
        <p><strong>Nombre:</strong> ${input.name}</p>
        <p><strong>Email:</strong> ${input.email}</p>
        ${input.message ? `<p><strong>Mensaje:</strong> ${input.message}</p>` : ""}
        <p>
          <a href="${input.approveUrl}" style="display:inline-block;padding:10px 20px;background:#0d0d10;color:#fff;text-decoration:none;border-radius:8px;">
            Aprobar acceso
          </a>
        </p>
      </div>
    `,
  };
}

interface CredentialsEmailInput {
  name: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
}

export function buildCredentialsEmail(input: CredentialsEmailInput): {
  subject: string;
  html: string;
} {
  return {
    subject: "Tu acceso a Nexa Brief fue aprobado",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>¡Hola ${input.name}!</h2>
        <p>Tu solicitud de acceso fue aprobada. Estas son tus credenciales:</p>
        <p><strong>Email:</strong> ${input.email}</p>
        <p><strong>Contraseña temporal:</strong> ${input.tempPassword}</p>
        <p>
          <a href="${input.loginUrl}" style="display:inline-block;padding:10px 20px;background:#0d0d10;color:#fff;text-decoration:none;border-radius:8px;">
            Iniciar sesión
          </a>
        </p>
      </div>
    `,
  };
}
