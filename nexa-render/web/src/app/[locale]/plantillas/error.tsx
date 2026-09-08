"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/Button";
import "./error.css";

export default function PlantillasError({ reset }: { reset: () => void }) {
  const t = useTranslations("templates");

  return (
    <main className="nr-page nr-templates-error">
      <div className="nr-templates-error__content">
        <span className="label">nexa-render</span>
        <h1>{t("errorTitle")}</h1>
        <p>{t("errorDescription")}</p>
        <Button variant="accent-solid" onClick={reset}>
          {t("retry")}
        </Button>
      </div>
    </main>
  );
}
