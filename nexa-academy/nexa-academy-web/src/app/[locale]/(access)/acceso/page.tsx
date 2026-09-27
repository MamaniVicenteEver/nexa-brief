import { getTranslations } from "next-intl/server";
import { AccessRequestForm } from "@/features/auth";
import { AccesoShell } from "@/shared/components/layout/AccesoShell";

export default async function AccesoPage() {
  const t = await getTranslations("access");

  return (
    <AccesoShell
      title={t("requestTitle")}
      subtitle={t("requestSubtitle")}
      toggleQuestion={t("toggleToLoginQuestion")}
      toggleLabel={t("toggleToLogin")}
      toggleHref="/login"
    >
      <AccessRequestForm />
    </AccesoShell>
  );
}
