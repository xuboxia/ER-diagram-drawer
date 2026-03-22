import type { PositionedEntity } from "../types/diagram";

interface EntityNodeProps {
  entity: PositionedEntity;
}

export function EntityNode({ entity }: EntityNodeProps) {
  const x = entity.x - entity.width / 2;
  const y = entity.y - entity.height / 2;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={entity.width}
        height={entity.height}
        rx={18}
        fill="#fefcf5"
        stroke="#2c4b43"
        strokeWidth={2.5}
      />
      {entity.kind === "weak" ? (
        <rect
          x={x + 8}
          y={y + 8}
          width={entity.width - 16}
          height={entity.height - 16}
          rx={14}
          fill="none"
          stroke="#2c4b43"
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
