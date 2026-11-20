import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/features/auth";
import { shouldShowDevLoginButton } from "@/features/auth/lib/dev-login";
import { AccesoShell } from "@/shared/components/layout/AccesoShell";

export default async function LoginPage() {
  const [t, showDevLogin] = await Promise.all([
    getTranslations("access"),
    shouldShowDevLoginButton(),
  ]);

  return (
    <AccesoShell
      title={t("loginTitle")}
      subtitle={t("loginSubtitle")}
      toggleQuestion={t("toggleToRequestQuestion")}
      toggleLabel={t("toggleToRequest")}
      toggleHref="/acceso"
    >
      <LoginForm showDevLogin={showDevLogin} />
    </AccesoShell>
  );
}
