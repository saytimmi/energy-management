import type { RadarPoint } from "../../api/types";

interface RadarChartProps {
  points: RadarPoint[];
  size?: number;
}

export function RadarChart({ points, size = 280 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - 40; // Leave room for labels
  const levels = 5; // Concentric rings: 2, 4, 6, 8, 10
  const n = points.length;

  if (n === 0) return null;

  // Calculate angle for each axis (start from top, go clockwise)
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2; // Start from top

  function polarToCart(angle: number, radius: number): { x: number; y: number } {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  }

  function getPolygonPoints(values: number[]): string {
    return values
      .map((val, i) => {
        const angle = startAngle + i * angleStep;
        const r = (val / 10) * maxRadius;
        const { x, y } = polarToCart(angle, r);
        return `${x},${y}`;
      })
      .join(" ");
  }

  const scores = points.map(p => p.score);
  const targets = points.map(p => p.targetScore ?? 0);
  const hasTargets = targets.some(t => t > 0);

  // Concentric grid rings
  const gridRings = Array.from({ length: levels }, (_, i) => {
    const val = ((i + 1) * 10) / levels; // 2, 4, 6, 8, 10
    const r = (val / 10) * maxRadius;
    return r;
  });

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Concentric grid rings */}
        {gridRings.map((r, i) => (
          <polygon
            key={`grid-${i}`}
            points={Array.from({ length: n }, (_, j) => {
              const angle = startAngle + j * angleStep;
              const { x, y } = polarToCart(angle, r);
              return `${x},${y}`;
            }).join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            stroke-width="1"
          />
        ))}

        {/* Axis lines */}
        {points.map((_, i) => {
          const angle = startAngle + i * angleStep;
          const { x, y } = polarToCart(angle, maxRadius);
          return (
            <line
              key={`axis-${i}`}
              x1={cx} y1={cy} x2={x} y2={y}
              stroke="rgba(255,255,255,0.06)"
              stroke-width="1"
            />
          );
        })}

        {/* Target polygon (dashed) */}
        {hasTargets && (
          <polygon
            points={getPolygonPoints(targets)}
            fill="none"
            stroke="rgba(200, 255, 115, 0.3)"
            stroke-width="1.5"
            stroke-dasharray="4 3"
          />
        )}

        {/* Current scores polygon (filled) */}
        <polygon
          points={getPolygonPoints(scores)}
          fill="rgba(200, 255, 115, 0.08)"
          stroke="var(--accent)"
          stroke-width="2"
        />

        {/* Score dots */}
        {scores.map((val, i) => {
          const angle = startAngle + i * angleStep;
          const r = (val / 10) * maxRadius;
          const { x, y } = polarToCart(angle, r);
          const isFocus = points[i].isFocus;
          return (
            <circle
              key={`dot-${i}`}
              cx={x} cy={y}
              r={isFocus ? 5 : 3.5}
              fill={val > 0 ? "var(--accent)" : "rgba(255,255,255,0.15)"}
              stroke={isFocus ? "rgba(200,255,115,0.4)" : "none"}
              stroke-width={isFocus ? 2 : 0}
            />
          );
        })}

        {/* Labels */}
        {points.map((p, i) => {
          const angle = startAngle + i * angleStep;
          const labelR = maxRadius + 22;
          const { x, y } = polarToCart(angle, labelR);

          // Text anchor based on position
          let anchor = "middle";
          if (x < cx - 10) anchor = "end";
          else if (x > cx + 10) anchor = "start";

          return (
            <g key={`label-${i}`}>
              <text
                x={x} y={y - 6}
                text-anchor={anchor}
                fill="var(--text2)"
                font-size="10"
                font-weight="500"
              >
                {p.icon}
              </text>
              <text
                x={x} y={y + 6}
                text-anchor={anchor}
                fill={p.score > 0 ? "var(--text)" : "var(--text3)"}
                font-size="10"
                font-weight={p.isFocus ? "700" : "400"}
              >
                {p.score > 0 ? p.score : "—"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
