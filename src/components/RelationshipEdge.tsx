import type { LayoutEdge, LayoutPoint } from "../types/diagram";

interface RelationshipEdgeProps {
  edge: LayoutEdge;
}

const DOUBLE_LINE_OFFSET = 4;
const ARROW_LENGTH = 18;
const ARROW_WIDTH = 14;

function getEdgePoints(edge: LayoutEdge): LayoutPoint[] {
  return edge.points && edge.points.length >= 2
    ? edge.points
    : [
        { x: edge.x1, y: edge.y1 },
        { x: edge.x2, y: edge.y2 },
      ];
}

function getSegmentNormal(start: LayoutPoint, end: LayoutPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;

  return {
    x: -dy / length,
    y: dx / length,
  };
}

function offsetPolyline(points: LayoutPoint[], offset: number): LayoutPoint[] {
  if (points.length <= 1 || offset === 0) {
    return points;
  }

  return points.map((point, index) => {
    if (index === 0) {
      const normal = getSegmentNormal(points[0], points[1]);
      return {
        x: point.x + normal.x * offset,
        y: point.y + normal.y * offset,
      };
    }

    if (index === points.length - 1) {
      const normal = getSegmentNormal(points[index - 1], points[index]);
      return {
        x: point.x + normal.x * offset,
        y: point.y + normal.y * offset,
      };
    }

    const previousNormal = getSegmentNormal(points[index - 1], points[index]);
    const nextNormal = getSegmentNormal(points[index], points[index + 1]);
    const miter = {
      x: previousNormal.x + nextNormal.x,
      y: previousNormal.y + nextNormal.y,
    };
    const miterLength = Math.hypot(miter.x, miter.y);

    if (miterLength < 0.001) {
      return {
        x: point.x + previousNormal.x * offset,
        y: point.y + previousNormal.y * offset,
      };
    }

    const unitMiter = {
      x: miter.x / miterLength,
      y: miter.y / miterLength,
    };
    const alignment =
      unitMiter.x * previousNormal.x + unitMiter.y * previousNormal.y || 1;
    const scale = offset / Math.max(0.35, alignment);

    return {
      x: point.x + unitMiter.x * scale,
      y: point.y + unitMiter.y * scale,
    };
  });
}

function toPolylinePoints(points: LayoutPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function getArrowPoints(points: LayoutPoint[]): string {
  const end = points[points.length - 1];
  const previous = [...points]
    .reverse()
    .find(
      (point, index) =>
        index > 0 &&
        (Math.abs(point.x - end.x) > 0.1 || Math.abs(point.y - end.y) > 0.1),
    );

  if (!previous) {
    return `${end.x},${end.y}`;
  }

  const dx = end.x - previous.x;
  const dy = end.y - previous.y;
  const length = Math.hypot(dx, dy) || 1;
  const unitX = dx / length;
  const unitY = dy / length;
  const normalX = -unitY;
  const normalY = unitX;

  const baseCenterX = end.x - unitX * ARROW_LENGTH;
  const baseCenterY = end.y - unitY * ARROW_LENGTH;
  const leftX = baseCenterX + normalX * (ARROW_WIDTH / 2);
  const leftY = baseCenterY + normalY * (ARROW_WIDTH / 2);
  const rightX = baseCenterX - normalX * (ARROW_WIDTH / 2);
  const rightY = baseCenterY - normalY * (ARROW_WIDTH / 2);

  return `${end.x},${end.y} ${leftX},${leftY} ${rightX},${rightY}`;
}

function renderPath(edge: LayoutEdge, suffix: string, offset = 0) {
  const points = offsetPolyline(getEdgePoints(edge), offset);

  return (
    <polyline
      key={`${edge.id}-${suffix}`}
      points={toPolylinePoints(points)}
      fill="none"
      stroke="#5a7a70"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

export function RelationshipEdge({ edge }: RelationshipEdgeProps) {
  const isRelationshipEdge = edge.kind === "entity-relationship";
  const isDouble = isRelationshipEdge && edge.endConstraint?.min === 1;
  const hasArrow = isRelationshipEdge && edge.endConstraint?.max === "1";
  const points = getEdgePoints(edge);

  return (
    <g>
      {isDouble ? (
        <>
          {renderPath(edge, "upper", DOUBLE_LINE_OFFSET)}
          {renderPath(edge, "lower", -DOUBLE_LINE_OFFSET)}
        </>
      ) : (
        renderPath(edge, "single")
      )}

      {hasArrow ? (
        <polygon points={getArrowPoints(points)} fill="#5a7a70" stroke="#5a7a70" strokeWidth={1} />
      ) : null}
    </g>
  );
}
