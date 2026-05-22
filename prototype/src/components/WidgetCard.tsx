import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  action?: string;
  children: ReactNode;
  className?: string;
}

export default function WidgetCard({ title, subtitle, action, children, className }: Props) {
  return (
    <section className={`widget ${className ?? ""}`}>
      <header className="widget__head">
        <div>
          <h3 className="widget__title">{title}</h3>
          {subtitle && <div className="widget__subtitle">{subtitle}</div>}
        </div>
        {action && <button className="widget__action">{action}</button>}
      </header>
      <div className="widget__body">{children}</div>
    </section>
  );
}
