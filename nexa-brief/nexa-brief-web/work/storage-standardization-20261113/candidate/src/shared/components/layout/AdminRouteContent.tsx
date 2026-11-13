"use client";

import { useEffect, useState } from "react";
import { TemplatesGridView } from "@/features/templates/components/TemplatesGridView";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function AdminRouteContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTemplatesIndex = pathname === "/plantillas";
  const [hasVisitedTemplates, setHasVisitedTemplates] = useState(isTemplatesIndex);

  useEffect(() => {
    if (isTemplatesIndex) {
      setHasVisitedTemplates(true);
    }
  }, [isTemplatesIndex]);

  const shouldRenderTemplates = hasVisitedTemplates || isTemplatesIndex;

  return (
    <>
      {shouldRenderTemplates && (
        <main
          className={cn("flex-1", !isTemplatesIndex && "hidden")}
          aria-hidden={!isTemplatesIndex}
        >
          <TemplatesGridView />
        </main>
      )}
      {!isTemplatesIndex && <main className="flex-1">{children}</main>}
    </>
  );
}
