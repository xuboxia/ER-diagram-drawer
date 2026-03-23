import type { PointerEventHandler } from "react";
import type { LayoutEdge, LayoutPoint } from "../types/diagram";

interface RelationshipEdgeProps {
  edge: LayoutEdge;
  isLabelDragging?: boolean;
  onLabelPointerDown?: PointerEventHandler<SVGGElement>;
}

const DOUBLE_LINE_GAP = 8;
const DOUBLE_LINE_OFFSET = DOUBLE_LINE_GAP / 2;
const ARROW_HEAD_LENGTH = 14;
const ARROW_HEAD_WIDTH = 9;
const ARROW_TO_DIAMOND_GAP = 14;
const MERGE_DISTANCE = 30;
const CENTER_SHAFT_LENGTH = 10;

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

function getNormalAtDistance(
  points: LayoutPoint[],
  cumulativeLengths: number[],
  distance: number,
) {
  if (points.length < 2) {
    return { x: 0, y: 0 };
  }

  if (distance <= 0) {
    return getSegmentNormal(points[0], points[1]);
  }

  const totalLength = cumulativeLengths[cumulativeLengths.length - 1] ?? 0;

  if (distance >= totalLength) {
    return getSegmentNormal(points[points.length - 2], points[points.length - 1]);
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    if (distance <= cumulativeLengths[index + 1]) {
      return getSegmentNormal(points[index], points[index + 1]);
    }
  }

  return getSegmentNormal(points[points.length - 2], points[points.length - 1]);
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

function buildTaperedOffsetPath(
  points: LayoutPoint[],
  offset: number,
  taperStartDistance: number,
  taperEndDistance: number,
): LayoutPoint[] {
  if (points.length <= 1) {
    return points;
  }

  if (taperEndDistance <= taperStartDistance) {
    return offsetPolyline(slicePolyline(points, 0, taperEndDistance), offset);
  }

  const cumulativeLengths = getCumulativeLengths(points);
  const prefix = offsetPolyline(slicePolyline(points, 0, taperStartDistance), offset);
  const sampleDistances = [taperStartDistance];

  cumulativeLengths.forEach((distance) => {
    if (distance > taperStartDistance && distance < taperEndDistance) {
      sampleDistances.push(distance);
    }
  });

  sampleDistances.push(
    taperStartDistance + (taperEndDistance - taperStartDistance) / 2,
    taperEndDistance,
  );

  const taperedSegment = sampleDistances
    .sort((left, right) => left - right)
    .map((distance) => {
      const point = getPointAtDistance(points, cumulativeLengths, distance);
      const normal = getNormalAtDistance(points, cumulativeLengths, distance);
      const progress = (distance - taperStartDistance) / (taperEndDistance - taperStartDistance);
      const taperedOffset = offset * Math.max(0, 1 - progress);

      return {
        x: point.x + normal.x * taperedOffset,
        y: point.y + normal.y * taperedOffset,
      };
    });

  return simplifyPoints([...prefix, ...taperedSegment]);
}

function toPolylinePoints(points: LayoutPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function toSmoothPath(points: LayoutPoint[]): string {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  if (points.length === 3) {
    return (
      `M ${points[0].x} ${points[0].y} ` +
      `Q ${points[1].x} ${points[1].y}, ${points[2].x} ${points[2].y}`
    );
  }

  if (points.length === 4) {
    return (
      `M ${points[0].x} ${points[0].y} ` +
      `C ${points[1].x} ${points[1].y}, ${points[2].x} ${points[2].y}, ${points[3].x} ${points[3].y}`
    );
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[index + 2] ?? next;
    const controlPointOne = {
      x: current.x + (next.x - previous.x) / 12,
      y: current.y + (next.y - previous.y) / 12,
    };
    const controlPointTwo = {
      x: next.x - (afterNext.x - current.x) / 12,
      y: next.y - (afterNext.y - current.y) / 12,
    };

    path += ` C ${controlPointOne.x} ${controlPointOne.y}, ${controlPointTwo.x} ${controlPointTwo.y}, ${next.x} ${next.y}`;
  }

  return path;
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

  const baseCenterX = end.x - unitX * ARROW_HEAD_LENGTH;
  const baseCenterY = end.y - unitY * ARROW_HEAD_LENGTH;
  const leftX = baseCenterX + normalX * (ARROW_HEAD_WIDTH / 2);
  const leftY = baseCenterY + normalY * (ARROW_HEAD_WIDTH / 2);
  const rightX = baseCenterX - normalX * (ARROW_HEAD_WIDTH / 2);
  const rightY = baseCenterY - normalY * (ARROW_HEAD_WIDTH / 2);

  return `${end.x},${end.y} ${leftX},${leftY} ${rightX},${rightY}`;
}

function renderPath(points: LayoutPoint[], edgeId: string, suffix: string) {
  return (
    <path
      key={`${edgeId}-${suffix}`}
      d={toSmoothPath(points)}
      fill="none"
      stroke="#5a7a70"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

export function RelationshipEdge({
  edge,
  isLabelDragging = false,
  onLabelPointerDown,
}: RelationshipEdgeProps) {
  const isRelationshipEdge = edge.kind === "entity-relationship";
  const isDouble = isRelationshipEdge && edge.endConstraint?.min === 1;
  const hasArrow = isRelationshipEdge && edge.endConstraint?.max === "1";
  const points = getEdgePoints(edge);
  const totalLength = getPolylineLength(points);
  const arrowTipDistance = Math.max(0, totalLength - ARROW_TO_DIAMOND_GAP);
  const arrowShaftStartDistance = Math.max(
    0,
    arrowTipDistance - ARROW_HEAD_LENGTH - CENTER_SHAFT_LENGTH,
  );
  const mergeStartDistance = Math.max(0, arrowShaftStartDistance - MERGE_DISTANCE);
  const arrowGuide = hasArrow ? slicePolyline(points, arrowShaftStartDistance, arrowTipDistance) : points;
  const singleArrowPath = hasArrow ? slicePolyline(points, 0, arrowTipDistance) : points;
  const upperMergedPath = buildTaperedOffsetPath(
    points,
    DOUBLE_LINE_OFFSET,
    mergeStartDistance,
    arrowShaftStartDistance,
  );
  const lowerMergedPath = buildTaperedOffsetPath(
    points,
    -DOUBLE_LINE_OFFSET,
    mergeStartDistance,
    arrowShaftStartDistance,
  );

  return (
    <g>
      {isDouble && hasArrow ? (
        <>
          {upperMergedPath.length >= 2 ? renderPath(upperMergedPath, edge.id, "upper-merge") : null}
          {lowerMergedPath.length >= 2 ? renderPath(lowerMergedPath, edge.id, "lower-merge") : null}
          {arrowGuide.length >= 2 ? renderPath(arrowGuide, edge.id, "center-shaft") : null}
        </>
      ) : isDouble ? (
        <>
          {renderPath(offsetPolyline(points, DOUBLE_LINE_OFFSET), edge.id, "upper")}
          {renderPath(offsetPolyline(points, -DOUBLE_LINE_OFFSET), edge.id, "lower")}
        </>
      ) : (
        renderPath(singleArrowPath, edge.id, "single")
      )}

      {hasArrow && arrowGuide.length >= 2 ? (
        <polygon
          points={getArrowPoints(arrowGuide)}
          fill="#5a7a70"
          stroke="#5a7a70"
          strokeWidth={1}
          strokeLinejoin="round"
        />
      ) : null}

      {edge.label && edge.labelX !== undefined && edge.labelY !== undefined ? (
        <g
          onPointerDown={onLabelPointerDown}
          style={{
            cursor: onLabelPointerDown ? (isLabelDragging ? "grabbing" : "grab") : undefined,
          }}
          opacity={isLabelDragging ? 0.96 : 1}
        >
          <rect
            x={edge.labelX - Math.max(22, edge.label.length * 4.2)}
            y={edge.labelY - 11}
            width={Math.max(44, edge.label.length * 8.4)}
            height={22}
            rx={11}
            fill="#ffffff"
            stroke={isLabelDragging ? "#7fa79a" : "#bfd1c8"}
            strokeWidth={isLabelDragging ? 1.8 : 1.25}
          />
          <text
            x={edge.labelX}
            y={edge.labelY + 4}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="#285147"
          >
            {edge.label}
          </text>
        </g>
      ) : null}
    </g>
  );
}
