/** El rol editorial vive en el plan; el archivo de imagen no lleva este tag. */
export function slideRoleTag(plan: unknown, slideId: string): string | null {
  if (!plan || typeof plan !== "object" || !("slides" in plan) || !Array.isArray(plan.slides))
    return null;
  const slide = plan.slides.find(
    (item) => item && typeof item === "object" && item.slide_id === slideId,
  );
  if (!slide || typeof slide.layout !== "string" || !slide.layout.startsWith("amarillista:"))
    return null;
  if (slide.layout.endsWith("_close")) return "Final";
  const kicker = Array.isArray(slide.texts)
    ? slide.texts.find((item: { role?: string }) => item?.role === "kicker")?.value
    : null;
  if (typeof kicker !== "string" || !kicker.trim()) return null;
  const value = kicker.trim().toLocaleLowerCase("es");
  return value.charAt(0).toLocaleUpperCase("es") + value.slice(1);
}
