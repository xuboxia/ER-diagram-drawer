import type { PointerEventHandler } from "react";
import type { PositionedEntity } from "../types/diagram";

interface EntityNodeProps {
  entity: PositionedEntity;
  isDragging?: boolean;
  onPointerDown?: PointerEventHandler<SVGGElement>;
}

export function EntityNode({ entity, isDragging = false, onPointerDown }: EntityNodeProps) {
  const x = entity.x - entity.width / 2;
  const y = entity.y - entity.height / 2;

  return (
    <g
      onPointerDown={onPointerDown}
      style={{ cursor: onPointerDown ? (isDragging ? "grabbing" : "grab") : undefined }}
      opacity={isDragging ? 0.92 : 1}
    >
      <rect
        x={x}
        y={y}
        width={entity.width}
        height={entity.height}
        rx={3}
        fill="#ffffff"
        stroke={isDragging ? "#000000" : "#111111"}
        strokeWidth={isDragging ? 2.6 : 1.8}
      />
      {entity.kind === "weak" ? (
        <rect
          x={x + 8}
          y={y + 8}
          width={entity.width - 16}
          height={entity.height - 16}
          rx={2}
          fill="none"
          stroke={isDragging ? "#000000" : "#111111"}
          strokeWidth={1.4}
        />
      ) : null}
      <text
        x={entity.x}
        y={entity.y + 6}
        textAnchor="middle"
        fontFamily="Georgia, Times New Roman, serif"
        fontSize={19}
        fontWeight={700}
        fill="#111111"
      >
        {entity.name}
      </text>
    </g>
  );
}
