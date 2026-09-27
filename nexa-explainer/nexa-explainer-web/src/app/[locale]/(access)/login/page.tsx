import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/features/auth";
import { AccesoShell } from "@/shared/components/layout/AccesoShell";

export default async function LoginPage() {
  const t = await getTranslations("access");

  return (
    <AccesoShell
      title={t("loginTitle")}
      subtitle={t("loginSubtitle")}
      toggleQuestion={t("toggleToRequestQuestion")}
      toggleLabel={t("toggleToRequest")}
      toggleHref="/acceso"
    >
      <LoginForm />
    </AccesoShell>
  );
}
