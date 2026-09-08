import { useTranslations } from "next-intl";
import type { EngineName } from "@/infrastructure/api/types";
import { cn } from "@/shared/lib/utils";
import "./EngineBadge.css";

const ENGINE_LABEL: Record<EngineName, string> = {
  playwright: "Playwright",
  remotion: "Remotion",
  hyperframes: "HyperFrames",
};

export function EngineBadge({
  engine,
  implemented,
}: {
  engine: EngineName;
  implemented?: boolean;
}) {
  const t = useTranslations("templates");

  return (
    <span className={cn("nr-engine-badge", `nr-engine-badge--${engine}`)}>
      <span className="nr-engine-badge__dot" />
      {ENGINE_LABEL[engine]}
      {implemented === false && (
        <span className="nr-engine-badge__phase">· {t("phase2Badge")}</span>
      )}
    </span>
  );
}

export { ENGINE_LABEL };
