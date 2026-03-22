import type { PositionedAttribute } from "../types/diagram";

interface AttributeNodeProps {
  attribute: PositionedAttribute;
}

function getUnderlineWidth(attribute: PositionedAttribute): number {
  return Math.min(attribute.name.length * 6.6, attribute.rx * 1.48);
}

export function AttributeNode({ attribute }: AttributeNodeProps) {
  const fill = attribute.isComposite
    ? "#edf5f0"
    : attribute.isPartialKey
      ? "#fff1db"
      : attribute.isKey
        ? "#fff5d8"
        : "#ffffff";
  const strokeDasharray = attribute.isDerived ? "7 5" : undefined;
  const underlineWidth = getUnderlineWidth(attribute);
  const underlineY = attribute.y + 11;

  return (
    <g>
      {attribute.isMultivalued ? (
        <ellipse
          cx={attribute.x}
          cy={attribute.y}
          rx={attribute.rx + 6}
          ry={attribute.ry + 4}
          fill="none"
          stroke="#3f6359"
          strokeWidth={2}
          strokeDasharray={strokeDasharray}
        />
      ) : null}

      <ellipse
        cx={attribute.x}
        cy={attribute.y}
        rx={attribute.rx}
        ry={attribute.ry}
        fill={fill}
        stroke="#3f6359"
        strokeWidth={2}
        strokeDasharray={strokeDasharray}
      />

      <text
        x={attribute.x}
        y={attribute.y + 4}
        textAnchor="middle"
        fontSize={14}
        fontWeight={attribute.isKey || attribute.isPartialKey ? 700 : 600}
        fill="#17312a"
      >
        {attribute.name}
      </text>

      {attribute.isKey || attribute.isPartialKey ? (
        <line
          x1={attribute.x - underlineWidth / 2}
          y1={underlineY}
          x2={attribute.x + underlineWidth / 2}
          y2={underlineY}
          stroke="#17312a"
          strokeWidth={1.8}
          strokeDasharray={attribute.isPartialKey ? "4 3" : undefined}
          strokeLinecap="round"
        />
      ) : null}
    </g>
  );
}
