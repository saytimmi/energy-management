interface SkeletonProps {
  width?: string;
  height?: string;
  radius?: string;
  style?: Record<string, string | number>;
  class?: string;
}

export function Skeleton({ width = "100%", height = "12px", radius, style, class: cls }: SkeletonProps) {
  return (
    <div
      class={`skeleton ${cls ?? ""}`}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

/** Skeleton shaped like a hub widget card */
export function SkeletonCard({ children, style }: { children?: any; style?: Record<string, string | number> }) {
  return (
    <div class="skeleton-card" style={style}>
      {children ?? (
        <>
          <Skeleton width="50%" height="14px" style={{ marginBottom: "12px" }} />
          <Skeleton width="80%" height="12px" style={{ marginBottom: "8px" }} />
          <Skeleton width="60%" height="12px" />
        </>
      )}
    </div>
  );
}

/** Skeleton shaped like the 4 energy rings */
export function SkeletonRings() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "8px" }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} class="skeleton-card" style={{ padding: "22px 14px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", borderRadius: "24px" }}>
          <Skeleton width="96px" height="96px" radius="50%" />
          <Skeleton width="60px" height="11px" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton shaped like observation cards */
export function SkeletonObservations({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} class="skeleton-card" style={{ padding: "12px", marginBottom: "8px", borderRadius: "var(--radius-xs)" }}>
          <Skeleton width="100px" height="10px" style={{ marginBottom: "6px" }} />
          <Skeleton width="90%" height="12px" style={{ marginBottom: "4px" }} />
          <Skeleton width="70%" height="11px" />
        </div>
      ))}
    </>
  );
}
