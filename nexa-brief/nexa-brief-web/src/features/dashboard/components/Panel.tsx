import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import styles from "./dashboard.module.css";

export function Panel({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(styles.panel, className)}>
      <header className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>{title}</h2>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {action && (
          <Link href={action.href} className={styles.textLink}>
            {action.label}
            <ArrowUpRight size={13} aria-hidden />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}
export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
