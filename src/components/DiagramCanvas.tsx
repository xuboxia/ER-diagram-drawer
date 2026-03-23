import { useEffect, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { DiagramLayout, LayoutPoint, ParseIssue } from "../types/diagram";
import { AttributeNode } from "./AttributeNode";
import { EntityNode } from "./EntityNode";
import { RelationshipEdge } from "./RelationshipEdge";
import { RelationshipNode } from "./RelationshipNode";

interface DragState {
  pointerId: number;
  labelKey: string;
  startPointer: LayoutPoint;
  startLabel: LayoutPoint;
}

interface DiagramCanvasProps {
  layout: DiagramLayout | null;
  errors: ParseIssue[];
  zoom: number;
  svgRef: RefObject<SVGSVGElement>;
  onSelfRelationshipLabelMove: (labelKey: string, x: number, y: number) => void;
}

export function DiagramCanvas({
  layout,
  errors,
  zoom,
  svgRef,
  onSelfRelationshipLabelMove,
}: DiagramCanvasProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);

  const getSvgPoint = (clientX: number, clientY: number): LayoutPoint | null => {
    const svg = svgRef.current;

    if (!svg) {
      return null;
    }

    const matrix = svg.getScreenCTM();

    if (!matrix) {
      return null;
    }

    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const transformed = point.matrixTransform(matrix.inverse());

    return {
      x: transformed.x,
      y: transformed.y,
    };
  };

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) {
        return;
      }

      const point = getSvgPoint(event.clientX, event.clientY);

      if (!point) {
        return;
      }

      onSelfRelationshipLabelMove(
        dragState.labelKey,
        dragState.startLabel.x + point.x - dragState.startPointer.x,
        dragState.startLabel.y + point.y - dragState.startPointer.y,
      );
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId === dragState.pointerId) {
        setDragState(null);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [dragState, onSelfRelationshipLabelMove]);

  const createLabelPointerDownHandler = (
    labelKey: string,
    startLabel: LayoutPoint,
  ) => (event: ReactPointerEvent<SVGGElement>) => {
    const point = getSvgPoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      labelKey,
      startPointer: point,
      startLabel,
    });
  };

  if (!layout) {
    return (
      <div className="empty-state">
        <h3>No diagram yet</h3>
        <p>Load the example or enter your own model on the left to generate a Chen ER diagram.</p>
      </div>
    );
  }

  return (
    <div className="canvas-shell">
      {errors.length > 0 ? (
        <div className="error-banner">
          <strong>Input needs attention.</strong>
          <span>Showing the last valid diagram while you fix the issues below.</span>
        </div>
      ) : null}

      <div className="canvas-scroll">
        <svg
          ref={svgRef}
          width={layout.width * zoom}
          height={layout.height * zoom}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Generated Chen ER diagram"
          style={{ minWidth: Math.max(layout.width * zoom, 1120), touchAction: "none" }}
        >
          <defs>
            <pattern id="dot-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.5" fill="#d6e4dc" />
            </pattern>
            <filter id="page-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="16" stdDeviation="18" floodColor="#a9bbb2" floodOpacity="0.18" />
            </filter>
          </defs>

          <rect width={layout.width} height={layout.height} fill="#f3f7f4" />
          <rect width={layout.width} height={layout.height} fill="url(#dot-grid)" opacity="0.8" />
          <rect
            x={24}
            y={24}
            width={Math.max(0, layout.width - 48)}
            height={Math.max(0, layout.height - 48)}
            rx={30}
            fill="#fffdf8"
            stroke="#d7e4de"
            strokeWidth={1.5}
            filter="url(#page-shadow)"
          />

          {layout.edges.map((edge) => (
            <RelationshipEdge
              key={edge.id}
              edge={edge}
              isLabelDragging={dragState?.labelKey === edge.labelDragKey}
              onLabelPointerDown={
                edge.isSelfRelationship &&
                edge.labelDragKey &&
                edge.label &&
                edge.labelX !== undefined &&
                edge.labelY !== undefined
                  ? createLabelPointerDownHandler(edge.labelDragKey, {
                      x: edge.labelX,
                      y: edge.labelY,
                    })
                  : undefined
              }
            />
          ))}

          {layout.relationships.map((relationship) => (
            <RelationshipNode key={relationship.id} relationship={relationship} />
          ))}

          {layout.entities.map((entity) => (
            <EntityNode key={entity.id} entity={entity} />
          ))}

          {layout.attributes.map((attribute) => (
            <AttributeNode key={attribute.id} attribute={attribute} />
          ))}
        </svg>
      </div>
    </div>
  );
}
