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
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
      opacity={isDragging ? 0.92 : 1}
    >
      <rect
        x={x}
        y={y}
        width={entity.width}
        height={entity.height}
        rx={18}
        fill="#fefcf5"
        stroke={isDragging ? "#205245" : "#2c4b43"}
        strokeWidth={isDragging ? 3 : 2.5}
      />
      {entity.kind === "weak" ? (
        <rect
          x={x + 8}
          y={y + 8}
          width={entity.width - 16}
          height={entity.height - 16}
          rx={14}
          fill="none"
          stroke={isDragging ? "#205245" : "#2c4b43"}
          strokeWidth={2}
        />
      ) : null}
      <text
        x={entity.x}
        y={entity.y + 6}
        textAnchor="middle"
        fontSize={20}
        fontWeight={700}
        fill="#17312a"
      >
        {entity.name}
      </text>
    </g>
  );
}
