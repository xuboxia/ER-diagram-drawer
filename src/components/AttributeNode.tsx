import type { PointerEventHandler } from "react";
import type { PositionedAttribute } from "../types/diagram";

interface AttributeNodeProps {
  attribute: PositionedAttribute;
  isDragging?: boolean;
  onPointerDown?: PointerEventHandler<SVGGElement>;
}

function getUnderlineWidth(attribute: PositionedAttribute): number {
  return Math.min(attribute.name.length * 6.6, attribute.rx * 1.48);
}

export function AttributeNode({
  attribute,
  isDragging = false,
  onPointerDown,
}: AttributeNodeProps) {
  const strokeDasharray = attribute.isDerived ? "7 5" : undefined;
  const underlineWidth = getUnderlineWidth(attribute);
  const underlineY = attribute.y + 11;

  return (
    <g
      onPointerDown={onPointerDown}
      style={{ cursor: onPointerDown ? (isDragging ? "grabbing" : "grab") : undefined }}
      opacity={isDragging ? 0.94 : 1}
    >
      {attribute.isMultivalued ? (
        <ellipse
          cx={attribute.x}
          cy={attribute.y}
          rx={attribute.rx + 6}
          ry={attribute.ry + 4}
          fill="none"
          stroke={isDragging ? "#000000" : "#111111"}
          strokeWidth={1.5}
          strokeDasharray={strokeDasharray}
        />
      ) : null}

      <ellipse
        cx={attribute.x}
        cy={attribute.y}
        rx={attribute.rx}
        ry={attribute.ry}
        fill="#ffffff"
        stroke={isDragging ? "#000000" : "#111111"}
        strokeWidth={isDragging ? 2.2 : 1.5}
        strokeDasharray={strokeDasharray}
      />

      <text
        x={attribute.x}
        y={attribute.y + 4}
        textAnchor="middle"
        fontFamily="Georgia, Times New Roman, serif"
        fontSize={13}
        fontWeight={attribute.isKey || attribute.isPartialKey ? 700 : 600}
        fill="#111111"
      >
        {attribute.name}
      </text>

      {attribute.isKey || attribute.isPartialKey ? (
        <line
          x1={attribute.x - underlineWidth / 2}
          y1={underlineY}
          x2={attribute.x + underlineWidth / 2}
          y2={underlineY}
          stroke="#111111"
          strokeWidth={1.4}
          strokeDasharray={attribute.isPartialKey ? "4 3" : undefined}
          strokeLinecap="round"
        />
      ) : null}
    </g>
  );
}
