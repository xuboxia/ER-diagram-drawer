import type { RefObject } from "react";
import type { DiagramLayout, ParseIssue } from "../types/diagram";
import { AttributeNode } from "./AttributeNode";
import { EntityNode } from "./EntityNode";
import { RelationshipEdge } from "./RelationshipEdge";
import { RelationshipNode } from "./RelationshipNode";

interface DiagramCanvasProps {
  layout: DiagramLayout | null;
  errors: ParseIssue[];
  zoom: number;
  svgRef: RefObject<SVGSVGElement>;
}

export function DiagramCanvas({ layout, errors, zoom, svgRef }: DiagramCanvasProps) {
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
          style={{ minWidth: Math.max(layout.width * zoom, 1120) }}
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
            <RelationshipEdge key={edge.id} edge={edge} />
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
