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
          role="img"
          aria-label="Generated Chen ER diagram"
          style={{ minWidth: layout.width * zoom }}
        >
          <defs>
            <pattern id="dot-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.5" fill="#d6e4dc" />
            </pattern>
          </defs>

          <rect width={layout.width} height={layout.height} fill="#f3f7f4" />
          <rect width={layout.width} height={layout.height} fill="url(#dot-grid)" opacity="0.8" />

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
