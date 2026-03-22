import ELK from "elkjs/lib/elk.bundled.js";
import type {
  AttributeModel,
  DiagramLayout,
  EntityModel,
  LayoutEdge,
  LayoutPoint,
  PositionedAttribute,
  PositionedEntity,
  PositionedRelationship,
  PositionedRelationshipParticipant,
  RelationshipModel,
} from "../types/diagram";

const elk = new ELK();

const ENTITY_WIDTH = 170;
const ENTITY_HEIGHT = 68;
const ATTRIBUTE_RX = 58;
const ATTRIBUTE_RY = 24;
const RELATIONSHIP_WIDTH = 118;
const RELATIONSHIP_HEIGHT = 74;

const ATTRIBUTE_WIDTH = ATTRIBUTE_RX * 2 + 20;
const ATTRIBUTE_HEIGHT = ATTRIBUTE_RY * 2 + 16;
const LAYOUT_MARGIN = 120;

const RELATIONSHIP_DOUBLE_LINE_OFFSET = 4;
const RELATIONSHIP_ARROW_LENGTH = 18;
const RELATIONSHIP_ARROW_WIDTH = 14;

type ShapeKind = "entity" | "relationship" | "attribute";

interface FlatAttributeNode {
  id: string;
  name: string;
  ownerId: string;
  ownerKind: "entity" | "relationship";
  parentAttributeId?: string;
  isKey: boolean;
  isPartialKey: boolean;
  isComposite: boolean;
  isMultivalued: boolean;
  isDerived: boolean;
  level: number;
}

interface LayoutRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface CoreShape {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ElkSection {
  startPoint?: LayoutPoint;
  endPoint?: LayoutPoint;
  bendPoints?: LayoutPoint[];
}

interface ElkEdge {
  id: string;
  sections?: ElkSection[];
}

interface ElkNode {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: ElkNode[];
  edges?: ElkEdge[];
}

interface ElkChildNode {
  id: string;
  width: number;
  height: number;
  labels?: Array<{ text: string; width: number; height: number }>;
  layoutOptions?: Record<string, string>;
}

interface ElkGraph {
  id: string;
  layoutOptions: Record<string, string>;
  children: ElkChildNode[];
  edges: Array<{
    id: string;
    sources: string[];
    targets: string[];
  }>;
}

function flattenAttributes(
  attributes: AttributeModel[],
  ownerId: string,
  ownerKind: "entity" | "relationship",
  level = 0,
  parentAttributeId?: string,
): FlatAttributeNode[] {
  return attributes.flatMap((attribute) => [
    {
      id: attribute.id,
      name: attribute.name,
      ownerId,
      ownerKind,
      parentAttributeId,
      isKey: attribute.isKey,
      isPartialKey: attribute.isPartialKey,
      isComposite: attribute.isComposite,
      isMultivalued: attribute.isMultivalued,
      isDerived: attribute.isDerived,
      level,
    },
    ...flattenAttributes(attribute.children, ownerId, ownerKind, level + 1, attribute.id),
  ]);
}

function getRectBoundaryPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  targetX: number,
  targetY: number,
): LayoutPoint {
  const dx = targetX - x;
  const dy = targetY - y;

  if (dx === 0 && dy === 0) {
    return { x, y };
  }

  const scale = 1 / Math.max(Math.abs(dx) / (width / 2), Math.abs(dy) / (height / 2));
  return {
    x: x + dx * scale,
    y: y + dy * scale,
  };
}

function getEllipseBoundaryPoint(
  x: number,
  y: number,
  rx: number,
  ry: number,
  targetX: number,
  targetY: number,
): LayoutPoint {
  const dx = targetX - x;
  const dy = targetY - y;

  if (dx === 0 && dy === 0) {
    return { x, y };
  }

  const scale = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
  return {
    x: x + dx * scale,
    y: y + dy * scale,
  };
}

function getDiamondBoundaryPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  targetX: number,
  targetY: number,
): LayoutPoint {
  const dx = targetX - x;
  const dy = targetY - y;

  if (dx === 0 && dy === 0) {
    return { x, y };
  }

  const scale = 1 / (Math.abs(dx) / (width / 2) + Math.abs(dy) / (height / 2));
  return {
    x: x + dx * scale,
    y: y + dy * scale,
  };
}

function getShapeBoundaryPoint(shape: CoreShape, toward: LayoutPoint): LayoutPoint {
  if (shape.kind === "relationship") {
    return getDiamondBoundaryPoint(shape.x, shape.y, shape.width, shape.height, toward.x, toward.y);
  }

  if (shape.kind === "attribute") {
    return getEllipseBoundaryPoint(shape.x, shape.y, shape.width / 2, shape.height / 2, toward.x, toward.y);
  }

  return getRectBoundaryPoint(shape.x, shape.y, shape.width, shape.height, toward.x, toward.y);
}

function getShapeBounds(shape: CoreShape): LayoutRect {
  return {
    minX: shape.x - shape.width / 2,
    minY: shape.y - shape.height / 2,
    maxX: shape.x + shape.width / 2,
    maxY: shape.y + shape.height / 2,
  };
}

function simplifyPolyline(points: LayoutPoint[]): LayoutPoint[] {
  const deduped = points.filter((point, index) => {
    if (index === 0) {
      return true;
    }

    const previous = points[index - 1];
    return Math.abs(previous.x - point.x) > 0.1 || Math.abs(previous.y - point.y) > 0.1;
  });

  if (deduped.length <= 2) {
    return deduped;
  }

  const simplified: LayoutPoint[] = [deduped[0]];

  for (let index = 1; index < deduped.length - 1; index += 1) {
    const previous = simplified[simplified.length - 1];
    const current = deduped[index];
    const next = deduped[index + 1];
    const isCollinear =
      (Math.abs(previous.x - current.x) < 0.1 && Math.abs(current.x - next.x) < 0.1) ||
      (Math.abs(previous.y - current.y) < 0.1 && Math.abs(current.y - next.y) < 0.1);

    if (!isCollinear) {
      simplified.push(current);
    }
  }

  simplified.push(deduped[deduped.length - 1]);
  return simplified;
}

function getPolylineMidpoint(points: LayoutPoint[]): LayoutPoint {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  if (points.length === 1) {
    return points[0];
  }

  let totalLength = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    totalLength += Math.hypot(
      points[index + 1].x - points[index].x,
      points[index + 1].y - points[index].y,
    );
  }

  if (totalLength === 0) {
    return points[0];
  }

  const midpointLength = totalLength / 2;
  let traversed = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);

    if (traversed + segmentLength < midpointLength) {
      traversed += segmentLength;
      continue;
    }

    const ratio = (midpointLength - traversed) / (segmentLength || 1);
    return {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    };
  }

  return points[points.length - 1];
}

function buildSectionPoints(section: ElkSection | undefined): LayoutPoint[] | null {
  if (!section?.startPoint || !section.endPoint) {
    return null;
  }

  return simplifyPolyline([
    section.startPoint,
    ...(section.bendPoints ?? []),
    section.endPoint,
  ]);
}

function buildFallbackPoints(sourceShape: CoreShape, targetShape: CoreShape): LayoutPoint[] {
  const start = getShapeBoundaryPoint(sourceShape, { x: targetShape.x, y: targetShape.y });
  const end = getShapeBoundaryPoint(targetShape, { x: sourceShape.x, y: sourceShape.y });
  return [start, end];
}

function createSelfRelationshipPoints(
  entityShape: CoreShape,
  relationshipShape: CoreShape,
  participantIndex: number,
): LayoutPoint[] {
  const horizontalDirection = relationshipShape.x >= entityShape.x ? 1 : -1;
  const verticalDirection = participantIndex === 0 ? -1 : 1;
  const entityGuide = {
    x: entityShape.x + horizontalDirection * (entityShape.width / 2 + 68),
    y: entityShape.y + verticalDirection * (entityShape.height * 0.42),
  };
  const relationshipGuide = {
    x: relationshipShape.x - horizontalDirection * (relationshipShape.width / 2 + 28),
    y: relationshipShape.y + verticalDirection * (relationshipShape.height * 0.32),
  };
  const start = getRectBoundaryPoint(
    entityShape.x,
    entityShape.y,
    entityShape.width,
    entityShape.height,
    entityGuide.x,
    entityGuide.y,
  );
  const end = getDiamondBoundaryPoint(
    relationshipShape.x,
    relationshipShape.y,
    relationshipShape.width,
    relationshipShape.height,
    relationshipGuide.x,
    relationshipGuide.y,
  );
  const outsideX =
    entityShape.x +
    horizontalDirection *
      Math.max(
        entityShape.width / 2 + 74,
        Math.abs(relationshipShape.x - entityShape.x) / 2 + 18,
      );

  return simplifyPolyline([
    start,
    { x: outsideX, y: start.y },
    { x: outsideX, y: end.y },
    end,
  ]);
}

function getEdgeBounds(edge: LayoutEdge): LayoutRect {
  const points =
    edge.points && edge.points.length >= 2
      ? edge.points
      : [
          { x: edge.x1, y: edge.y1 },
          { x: edge.x2, y: edge.y2 },
        ];

  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);

  let minX = Math.min(...xValues);
  let maxX = Math.max(...xValues);
  let minY = Math.min(...yValues);
  let maxY = Math.max(...yValues);

  if (edge.kind === "entity-relationship" && edge.endConstraint?.min === 1) {
    minX -= RELATIONSHIP_DOUBLE_LINE_OFFSET;
    maxX += RELATIONSHIP_DOUBLE_LINE_OFFSET;
    minY -= RELATIONSHIP_DOUBLE_LINE_OFFSET;
    maxY += RELATIONSHIP_DOUBLE_LINE_OFFSET;
  }

  if (edge.kind === "entity-relationship" && edge.endConstraint?.max === "1") {
    minX -= RELATIONSHIP_ARROW_LENGTH + RELATIONSHIP_ARROW_WIDTH;
    maxX += RELATIONSHIP_ARROW_LENGTH + RELATIONSHIP_ARROW_WIDTH;
    minY -= RELATIONSHIP_ARROW_LENGTH + RELATIONSHIP_ARROW_WIDTH;
    maxY += RELATIONSHIP_ARROW_LENGTH + RELATIONSHIP_ARROW_WIDTH;
  }

  return { minX, minY, maxX, maxY };
}

function normalizeLayout(
  entities: PositionedEntity[],
  attributes: PositionedAttribute[],
  relationships: PositionedRelationship[],
  edges: LayoutEdge[],
): DiagramLayout {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const includeBounds = (
    nextMinX: number,
    nextMinY: number,
    nextMaxX: number,
    nextMaxY: number,
  ) => {
    minX = Math.min(minX, nextMinX);
    minY = Math.min(minY, nextMinY);
    maxX = Math.max(maxX, nextMaxX);
    maxY = Math.max(maxY, nextMaxY);
  };

  entities.forEach((entity) => {
    includeBounds(
      entity.x - entity.width / 2,
      entity.y - entity.height / 2,
      entity.x + entity.width / 2,
      entity.y + entity.height / 2,
    );
  });

  relationships.forEach((relationship) => {
    includeBounds(
      relationship.x - relationship.width / 2,
      relationship.y - relationship.height / 2,
      relationship.x + relationship.width / 2,
      relationship.y + relationship.height / 2,
    );
  });

  attributes.forEach((attribute) => {
    const extraRing = attribute.isMultivalued ? 6 : 0;
    includeBounds(
      attribute.x - attribute.rx - extraRing,
      attribute.y - attribute.ry - extraRing,
      attribute.x + attribute.rx + extraRing,
      attribute.y + attribute.ry + extraRing,
    );
  });

  edges.forEach((edge) => {
    const bounds = getEdgeBounds(edge);
    includeBounds(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return {
      width: LAYOUT_MARGIN * 2,
      height: LAYOUT_MARGIN * 2,
      entities,
      attributes,
      relationships,
      edges,
    };
  }

  const shiftX = LAYOUT_MARGIN - minX;
  const shiftY = LAYOUT_MARGIN - minY;

  return {
    width: maxX - minX + LAYOUT_MARGIN * 2,
    height: maxY - minY + LAYOUT_MARGIN * 2,
    entities: entities.map((entity) => ({
      ...entity,
      x: entity.x + shiftX,
      y: entity.y + shiftY,
    })),
    attributes: attributes.map((attribute) => ({
      ...attribute,
      x: attribute.x + shiftX,
      y: attribute.y + shiftY,
    })),
    relationships: relationships.map((relationship) => ({
      ...relationship,
      x: relationship.x + shiftX,
      y: relationship.y + shiftY,
    })),
    edges: edges.map((edge) => ({
      ...edge,
      x1: edge.x1 + shiftX,
      y1: edge.y1 + shiftY,
      x2: edge.x2 + shiftX,
      y2: edge.y2 + shiftY,
      labelX: edge.labelX !== undefined ? edge.labelX + shiftX : undefined,
      labelY: edge.labelY !== undefined ? edge.labelY + shiftY : undefined,
      points: edge.points?.map((point) => ({
        x: point.x + shiftX,
        y: point.y + shiftY,
      })),
    })),
  };
}

export async function createDiagramLayout(model: {
  entities: EntityModel[];
  relationships: RelationshipModel[];
}): Promise<DiagramLayout> {
  const relationshipAttributes = model.relationships.flatMap((relationship) =>
    flattenAttributes(relationship.attributes, relationship.id, "relationship"),
  );
  const entityAttributes = model.entities.flatMap((entity) =>
    flattenAttributes(entity.attributes, entity.id, "entity"),
  );
  const flatAttributes = [...entityAttributes, ...relationshipAttributes];

  const graph: ElkGraph = {
    id: "chen-root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "70",
      "elk.spacing.edgeNode": "48",
      "elk.layered.spacing.nodeNodeBetweenLayers": "120",
      "elk.layered.spacing.edgeNodeBetweenLayers": "70",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "28",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.layered.mergeEdges": "false",
      "elk.edgeRouting": "POLYLINE",
      "elk.separateConnectedComponents": "true",
    },
    children: [
      ...model.entities.map((entity) => ({
        id: entity.id,
        width: ENTITY_WIDTH,
        height: ENTITY_HEIGHT,
      })),
      ...model.relationships.map((relationship) => ({
        id: relationship.id,
        width: RELATIONSHIP_WIDTH,
        height: RELATIONSHIP_HEIGHT,
      })),
      ...flatAttributes.map((attribute) => ({
        id: attribute.id,
        width: ATTRIBUTE_WIDTH,
        height: ATTRIBUTE_HEIGHT,
        layoutOptions: {
          "elk.layered.layering.layerConstraint": attribute.level === 0 ? "NONE" : "LAST",
        },
      })),
    ],
    edges: [
      ...model.relationships.flatMap((relationship) =>
        relationship.participants.map((participant, participantIndex) => {
          const entity = model.entities.find(
            (candidate) => candidate.name.toLowerCase() === participant.entity.toLowerCase(),
          );

          if (!entity) {
            return null;
          }

          return {
            id: `${relationship.id}-participant-${participantIndex}`,
            sources: [entity.id],
            targets: [relationship.id],
          };
        }),
      ),
      ...flatAttributes.map((attribute) => ({
        id: attribute.parentAttributeId
          ? `${attribute.parentAttributeId}-${attribute.id}`
          : `${attribute.ownerId}-${attribute.id}`,
        sources: [attribute.parentAttributeId ?? attribute.ownerId],
        targets: [attribute.id],
      })),
    ].filter((edge): edge is { id: string; sources: string[]; targets: string[] } => edge !== null),
  };

  const laidOutGraph = (await (elk.layout as (nextGraph: ElkGraph) => Promise<ElkNode>)(graph)) as ElkNode;
  const nodeById = new Map<string, ElkNode>();
  const edgePointsById = new Map<string, LayoutPoint[]>();

  (laidOutGraph.children ?? []).forEach((node) => {
    nodeById.set(node.id, node);
  });

  (laidOutGraph.edges ?? []).forEach((edge) => {
    const sectionPoints = buildSectionPoints(edge.sections?.[0]);

    if (sectionPoints) {
      edgePointsById.set(edge.id, sectionPoints);
    }
  });

  const entities: PositionedEntity[] = model.entities.map((entity) => {
    const node = nodeById.get(entity.id);

    if (!node || node.x === undefined || node.y === undefined) {
      throw new Error(`ELK did not return a position for entity ${entity.id}.`);
    }

    return {
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      x: node.x + ENTITY_WIDTH / 2,
      y: node.y + ENTITY_HEIGHT / 2,
      width: ENTITY_WIDTH,
      height: ENTITY_HEIGHT,
    };
  });

  const relationships: PositionedRelationship[] = model.relationships.map((relationship) => {
    const node = nodeById.get(relationship.id);

    if (!node || node.x === undefined || node.y === undefined) {
      throw new Error(`ELK did not return a position for relationship ${relationship.id}.`);
    }

    return {
      id: relationship.id,
      name: relationship.name,
      kind: relationship.kind,
      isSelfRelationship: relationship.isSelfRelationship,
      x: node.x + RELATIONSHIP_WIDTH / 2,
      y: node.y + RELATIONSHIP_HEIGHT / 2,
      width: RELATIONSHIP_WIDTH,
      height: RELATIONSHIP_HEIGHT,
      participants: relationship.participants.map((participant) => ({
        entityId:
          model.entities.find(
            (candidate) => candidate.name.toLowerCase() === participant.entity.toLowerCase(),
          )?.id ?? participant.entity,
        entityName: participant.entity,
        endConstraint: participant.endConstraint,
        roleLabel: participant.roleLabel,
      })),
      legacyCardinality: relationship.legacyCardinality,
    };
  });

  const attributes: PositionedAttribute[] = flatAttributes.map((attribute) => {
    const node = nodeById.get(attribute.id);

    if (!node || node.x === undefined || node.y === undefined) {
      throw new Error(`ELK did not return a position for attribute ${attribute.id}.`);
    }

    return {
      id: attribute.id,
      name: attribute.name,
      ownerId: attribute.ownerId,
      ownerKind: attribute.ownerKind,
      parentAttributeId: attribute.parentAttributeId,
      isKey: attribute.isKey,
      isPartialKey: attribute.isPartialKey,
      isComposite: attribute.isComposite,
      isMultivalued: attribute.isMultivalued,
      isDerived: attribute.isDerived,
      x: node.x + ATTRIBUTE_WIDTH / 2,
      y: node.y + ATTRIBUTE_HEIGHT / 2,
      rx: ATTRIBUTE_RX,
      ry: ATTRIBUTE_RY,
      level: attribute.level,
    };
  });

  const shapeEntries: Array<[string, CoreShape]> = [
    ...entities.map(
      (entity): [string, CoreShape] => [
        entity.id,
        {
          id: entity.id,
          kind: "entity",
          x: entity.x,
          y: entity.y,
          width: entity.width,
          height: entity.height,
        },
      ],
    ),
    ...relationships.map(
      (relationship): [string, CoreShape] => [
        relationship.id,
        {
          id: relationship.id,
          kind: "relationship",
          x: relationship.x,
          y: relationship.y,
          width: relationship.width,
          height: relationship.height,
        },
      ],
    ),
    ...attributes.map(
      (attribute): [string, CoreShape] => [
        attribute.id,
        {
          id: attribute.id,
          kind: "attribute",
          x: attribute.x,
          y: attribute.y,
          width: attribute.rx * 2,
          height: attribute.ry * 2,
        },
      ],
    ),
  ];
  const shapesById = new Map<string, CoreShape>(shapeEntries);

  const relationshipEdges: LayoutEdge[] = relationships.flatMap((relationship) =>
    relationship.participants.map((participant, participantIndex) => {
      const relationshipShape = shapesById.get(relationship.id);
      const entityShape = shapesById.get(participant.entityId);

      if (!relationshipShape || !entityShape) {
        throw new Error(`Missing positioned shape for relationship edge ${relationship.id}.`);
      }

      const points = relationship.isSelfRelationship
        ? createSelfRelationshipPoints(entityShape, relationshipShape, participantIndex)
        : edgePointsById.get(`${relationship.id}-participant-${participantIndex}`) ??
          buildFallbackPoints(entityShape, relationshipShape);
      const labelPoint = getPolylineMidpoint(points);

      return {
        id: `${relationship.id}-participant-${participantIndex}`,
        kind: "entity-relationship" as const,
        x1: points[0].x,
        y1: points[0].y,
        x2: points[points.length - 1].x,
        y2: points[points.length - 1].y,
        points,
        endConstraint: participant.endConstraint,
        label: participant.roleLabel,
        labelX: participant.roleLabel ? labelPoint.x : undefined,
        labelY: participant.roleLabel ? labelPoint.y - 12 : undefined,
      };
    }),
  );

  const attributeEdges: LayoutEdge[] = attributes.map((attribute) => {
    const sourceId = attribute.parentAttributeId ?? attribute.ownerId;
    const sourceShape = shapesById.get(sourceId);
    const targetShape = shapesById.get(attribute.id);
    const edgeId = attribute.parentAttributeId
      ? `${attribute.parentAttributeId}-${attribute.id}`
      : `${attribute.ownerId}-${attribute.id}`;

    if (!sourceShape || !targetShape) {
      throw new Error(`Missing positioned shape for attribute edge ${edgeId}.`);
    }

    const points =
      edgePointsById.get(edgeId) ??
      buildFallbackPoints(sourceShape, targetShape);

    return {
      id: edgeId,
      kind: attribute.parentAttributeId ? "attribute-attribute" : attribute.ownerKind === "relationship"
        ? "relationship-attribute"
        : "entity-attribute",
      x1: points[0].x,
      y1: points[0].y,
      x2: points[points.length - 1].x,
      y2: points[points.length - 1].y,
      points,
    };
  });

  return normalizeLayout(
    entities,
    attributes,
    relationships,
    [...relationshipEdges, ...attributeEdges],
  );
}
