import type { PointerEventHandler } from "react";
import type { LayoutEdge, LayoutPoint } from "../types/diagram";

interface RelationshipEdgeProps {
  edge: LayoutEdge;
  isLabelDragging?: boolean;
  onLabelPointerDown?: PointerEventHandler<SVGGElement>;
}

const PARTIAL_PARTICIPATION_STROKE_WIDTH = 1.8;
const TOTAL_PARTICIPATION_STROKE_WIDTH = 4.2;
const DEFAULT_EDGE_STROKE_WIDTH = 1.5;
const EDGE_STROKE = "#111111";
const ROLE_LABEL_STROKE = "#777777";
const ROLE_LABEL_ACTIVE_STROKE = "#111111";
const ROLE_LABEL_FILL = "#ffffff";
const ARROW_HEAD_LENGTH = 13;
const ARROW_HEAD_WIDTH = 8;
const ARROW_TO_DIAMOND_GAP = 13;
const ARROW_SHAFT_LENGTH = 10;

function getEdgePoints(edge: LayoutEdge): LayoutPoint[] {
  return edge.points && edge.points.length >= 2
    ? edge.points
    : [
        { x: edge.x1, y: edge.y1 },
        { x: edge.x2, y: edge.y2 },
      ];
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

function getRelationshipStrokeWidth(edge: LayoutEdge): number {
  if (edge.kind !== "entity-relationship") {
    return DEFAULT_EDGE_STROKE_WIDTH;
  }

  return edge.endConstraint?.min === 1
    ? TOTAL_PARTICIPATION_STROKE_WIDTH
    : PARTIAL_PARTICIPATION_STROKE_WIDTH;
}

function renderPath(points: LayoutPoint[], edge: LayoutEdge, strokeWidth: number) {
  return (
    <path
      key={`${edge.id}-path`}
      d={toSmoothPath(points)}
      fill="none"
      stroke={EDGE_STROKE}
      strokeWidth={strokeWidth}
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
  const hasArrow = isRelationshipEdge && edge.endConstraint?.max === "1";
  const points = getEdgePoints(edge);
  const totalLength = getPolylineLength(points);
  const arrowTipDistance = Math.max(0, totalLength - ARROW_TO_DIAMOND_GAP);
  const arrowShaftStartDistance = Math.max(
    0,
    arrowTipDistance - ARROW_HEAD_LENGTH - ARROW_SHAFT_LENGTH,
  );
  const edgePath = hasArrow ? slicePolyline(points, 0, arrowTipDistance) : points;
  const arrowGuide = hasArrow ? slicePolyline(points, arrowShaftStartDistance, arrowTipDistance) : points;
  const strokeWidth = getRelationshipStrokeWidth(edge);

  return (
    <g>
      {edgePath.length >= 2 ? renderPath(edgePath, edge, strokeWidth) : null}

      {hasArrow && arrowGuide.length >= 2 ? (
        <polygon
          points={getArrowPoints(arrowGuide)}
          fill={EDGE_STROKE}
          stroke={EDGE_STROKE}
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
            rx={3}
            fill={ROLE_LABEL_FILL}
            stroke={isLabelDragging ? ROLE_LABEL_ACTIVE_STROKE : ROLE_LABEL_STROKE}
            strokeWidth={isLabelDragging ? 1.6 : 1}
          />
          <text
            x={edge.labelX}
            y={edge.labelY + 4}
            textAnchor="middle"
            fontFamily="Georgia, Times New Roman, serif"
            fontSize={11}
            fontWeight={600}
            fill={EDGE_STROKE}
          >
            {edge.label}
          </text>
        </g>
      ) : null}
    </g>
  );
}
