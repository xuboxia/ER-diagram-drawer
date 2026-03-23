import type { PointerEventHandler } from "react";
import type { PositionedRelationship } from "../types/diagram";

interface RelationshipNodeProps {
  relationship: PositionedRelationship;
  isDragging?: boolean;
  onPointerDown?: PointerEventHandler<SVGGElement>;
}

function getDiamondPoints(x: number, y: number, width: number, height: number): string {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return [
    `${x},${y - halfHeight}`,
    `${x + halfWidth},${y}`,
    `${x},${y + halfHeight}`,
    `${x - halfWidth},${y}`,
  ].join(" ");
}

export function RelationshipNode({
  relationship,
  isDragging = false,
  onPointerDown,
}: RelationshipNodeProps) {
  return (
    <g
      onPointerDown={onPointerDown}
      style={{ cursor: onPointerDown ? (isDragging ? "grabbing" : "grab") : undefined }}
      opacity={isDragging ? 0.94 : 1}
    >
      <polygon
        points={getDiamondPoints(
          relationship.x,
          relationship.y,
          relationship.width,
          relationship.height,
        )}
        fill="#d7ebe1"
        stroke={isDragging ? "#205245" : "#2c4b43"}
        strokeWidth={isDragging ? 3 : 2.5}
      />
      {relationship.kind === "identifying" ? (
        <polygon
          points={getDiamondPoints(
            relationship.x,
            relationship.y,
            relationship.width - 16,
            relationship.height - 12,
          )}
          fill="none"
          stroke={isDragging ? "#205245" : "#2c4b43"}
          strokeWidth={2}
        />
      ) : null}
      <text
        x={relationship.x}
        y={relationship.y + 5}
        textAnchor="middle"
        fontSize={16}
        fontWeight={700}
        fill="#17312a"
      >
        {relationship.name}
      </text>
    </g>
  );
}
