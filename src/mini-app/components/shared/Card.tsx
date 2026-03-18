import { ComponentChildren } from "preact";

interface CardProps {
  children: ComponentChildren;
  class?: string;
  onClick?: () => void;
}

export function Card({ children, class: cls, onClick }: CardProps) {
  return (
    <div
      class={`card-surface ${cls ?? ""}`}
      onClick={onClick}
      style={{ background: "var(--surface)", borderRadius: "var(--radius)", padding: "16px" }}
    >
      {children}
    </div>
  );
}
