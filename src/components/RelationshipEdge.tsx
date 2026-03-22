import type { LayoutEdge, LayoutPoint } from "../types/diagram";

interface RelationshipEdgeProps {
  edge: LayoutEdge;
}

const DOUBLE_LINE_OFFSET = 4;
const ARROW_LENGTH = 18;
const ARROW_WIDTH = 14;
const ARROW_DIAMOND_GAP = 10;
const DOUBLE_ARROW_MERGE_DISTANCE = 28;

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

function getPolylineLength(points: LayoutPoint[]): number {
  let total = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    total += Math.hypot(end.x - start.x, end.y - start.y);
  }

  return total;
}

function getCumulativeLengths(points: LayoutPoint[]): number[] {
  const lengths = [0];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    lengths.push(lengths[index] + Math.hypot(end.x - start.x, end.y - start.y));
  }

  return lengths;
}

function getPointAtDistance(
  points: LayoutPoint[],
  cumulativeLengths: number[],
  distance: number,
): LayoutPoint {
  if (distance <= 0) {
    return points[0];
  }

  const totalLength = cumulativeLengths[cumulativeLengths.length - 1] ?? 0;

  if (distance >= totalLength) {
    return points[points.length - 1];
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const segmentStartDistance = cumulativeLengths[index];
    const segmentEndDistance = cumulativeLengths[index + 1];

    if (distance > segmentEndDistance) {
      continue;
    }

    const start = points[index];
    const end = points[index + 1];
    const segmentLength = segmentEndDistance - segmentStartDistance || 1;
    const ratio = (distance - segmentStartDistance) / segmentLength;

    return {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    };
  }

  return points[points.length - 1];
}

function simplifyPoints(points: LayoutPoint[]): LayoutPoint[] {
  return points.filter((point, index) => {
    if (index === 0) {
      return true;
    }

    const previous = points[index - 1];
    return Math.abs(previous.x - point.x) > 0.1 || Math.abs(previous.y - point.y) > 0.1;
  });
}

function slicePolyline(points: LayoutPoint[], startDistance: number, endDistance: number): LayoutPoint[] {
  if (points.length <= 1) {
    return points;
  }

  const cumulativeLengths = getCumulativeLengths(points);
  const totalLength = cumulativeLengths[cumulativeLengths.length - 1] ?? 0;
  const clampedStart = Math.max(0, Math.min(startDistance, totalLength));
  const clampedEnd = Math.max(clampedStart, Math.min(endDistance, totalLength));

  const result: LayoutPoint[] = [
    getPointAtDistance(points, cumulativeLengths, clampedStart),
  ];

  points.forEach((point, index) => {
    const distance = cumulativeLengths[index];

    if (distance > clampedStart && distance < clampedEnd) {
      result.push(point);
    }
  });

  result.push(getPointAtDistance(points, cumulativeLengths, clampedEnd));
  return simplifyPoints(result);
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

function renderPath(points: LayoutPoint[], edgeId: string, suffix: string, offset = 0) {
  const shiftedPoints = offsetPolyline(points, offset);

  return (
    <polyline
      key={`${edgeId}-${suffix}`}
      points={toPolylinePoints(shiftedPoints)}
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
  const totalLength = getPolylineLength(points);
  const arrowTipDistance = Math.max(0, totalLength - ARROW_DIAMOND_GAP);
  const arrowPath = hasArrow ? slicePolyline(points, 0, arrowTipDistance) : points;
  const mergeStartDistance = Math.max(
    0,
    arrowTipDistance - DOUBLE_ARROW_MERGE_DISTANCE,
  );
  const doubleLinePath = isDouble && hasArrow ? slicePolyline(points, 0, mergeStartDistance) : points;
  const mergedArrowGuide =
    isDouble && hasArrow
      ? slicePolyline(points, mergeStartDistance, arrowTipDistance)
      : arrowPath;

  return (
    <g>
      {isDouble && hasArrow ? (
        <>
          {doubleLinePath.length >= 2 ? renderPath(doubleLinePath, edge.id, "upper", DOUBLE_LINE_OFFSET) : null}
          {doubleLinePath.length >= 2 ? renderPath(doubleLinePath, edge.id, "lower", -DOUBLE_LINE_OFFSET) : null}
          {mergedArrowGuide.length >= 2 ? renderPath(mergedArrowGuide, edge.id, "merge") : null}
        </>
      ) : isDouble ? (
        <>
          {renderPath(points, edge.id, "upper", DOUBLE_LINE_OFFSET)}
          {renderPath(points, edge.id, "lower", -DOUBLE_LINE_OFFSET)}
        </>
      ) : (
        renderPath(arrowPath, edge.id, "single")
      )}

      {hasArrow && mergedArrowGuide.length >= 2 ? (
        <polygon
          points={getArrowPoints(mergedArrowGuide)}
          fill="#5a7a70"
          stroke="#5a7a70"
          strokeWidth={1}
        />
      ) : null}
    </g>
  );
}
