import { getTranslations } from "next-intl/server";
import "./Hero.css";

export async function Hero() {
  const t = await getTranslations("hero");

  return (
    <section className="nr-hero">
      <h1 className="nr-hero__h1">
        {t("titlePrefix")} <span className="nr-hero__mark">{t("titleMark")}</span>{" "}
        {t("titleSuffix")}
      </h1>

      <p className="nr-hero__p">
        {t.rich("description", {
          mark1: (chunks) => <mark>{chunks}</mark>,
          mark2: (chunks) => <mark>{chunks}</mark>,
          mark3: (chunks) => <mark>{chunks}</mark>,
          mark4: (chunks) => <mark>{chunks}</mark>,
          mark5: (chunks) => <mark>{chunks}</mark>,
          mark6: (chunks) => <mark>{chunks}</mark>,
          mark7: (chunks) => <mark>{chunks}</mark>,
        })}
      </p>
    </section>
  );
}
