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

const MIN_ENTITY_ZONE_WIDTH = 460;
const ENTITY_LAYOUT_PADDING_Y = 28;
const RELATIONSHIP_LAYOUT_PADDING = 24;
const LAYOUT_MARGIN = 140;

const ATTRIBUTE_NODE_WIDTH = ATTRIBUTE_RX * 2;
const ATTRIBUTE_TOP_OFFSET = 132;
const ATTRIBUTE_BOTTOM_OFFSET = 136;
const ATTRIBUTE_TOP_ROW_GAP = 72;
const ATTRIBUTE_SIDE_OFFSET = 154;
const ATTRIBUTE_SIDE_ROW_GAP = 74;
const ATTRIBUTE_SIDE_BASE_Y = 32;
const ATTRIBUTE_SIBLING_GAP = 28;
const ATTRIBUTE_OUTWARD_STEP = 36;
const ATTRIBUTE_COLLISION_PADDING = 14;
const ATTRIBUTE_EDGE_PADDING = 10;
const ATTRIBUTE_MAX_PUSH_STEPS = 7;

const RELATIONSHIP_ATTRIBUTE_OFFSET = 118;
const RELATIONSHIP_ATTRIBUTE_ROW_GAP = 64;
const RELATIONSHIP_ATTRIBUTE_SIDE_OFFSET = 130;

const COMPOSITE_ROOT_GAP = 56;
const COMPOSITE_CHILD_GAP = 34;
const COMPOSITE_LEVEL_GAP = 92;
const COMPOSITE_PUSH_STEP = 36;

const RELATIONSHIP_DOUBLE_LINE_OFFSET = 4;
const RELATIONSHIP_ARROW_LENGTH = 18;
const RELATIONSHIP_ARROW_WIDTH = 14;
const EDGE_OBSTACLE_PADDING = 12;
const ORTHOGONAL_ROUTE_MARGIN = 36;

type AttributeSide = "top" | "left" | "right" | "bottom";
type ShapeKind = "entity" | "relationship";
type AttributeOwnerKind = "entity" | "relationship";

interface EntityMetrics {
  keyAttributes: AttributeModel[];
  regularAttributes: AttributeModel[];
  compositeAttributes: AttributeModel[];
  zoneWidth: number;
  topExtent: number;
  bottomExtent: number;
  layoutWidth: number;
  layoutHeight: number;
}

interface EntityPlacement extends PositionedEntity {
  model: EntityModel;
  zoneWidth: number;
  topExtent: number;
  bottomExtent: number;
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

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
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

function getBandWidth(count: number, maxPerRow: number, gap: number): number {
  if (count <= 0) {
    return 0;
  }

  const itemsInWidestRow = Math.min(count, maxPerRow);
  return itemsInWidestRow * ATTRIBUTE_NODE_WIDTH + Math.max(0, itemsInWidestRow - 1) * gap;
}

function splitIntoRows<T>(items: T[], maxPerRow: number): T[][] {
  if (items.length === 0) {
    return [];
  }

  const rows = Math.ceil(items.length / maxPerRow);
  const result: T[][] = [];
  let index = 0;

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const remainingItems = items.length - index;
    const remainingRows = rows - rowIndex;
    const rowSize = Math.ceil(remainingItems / remainingRows);
    result.push(items.slice(index, index + rowSize));
    index += rowSize;
  }

  return result;
}

function classifyRootAttributes(attributes: AttributeModel[]) {
  return attributes.reduce<{
    keyAttributes: AttributeModel[];
    regularAttributes: AttributeModel[];
    compositeAttributes: AttributeModel[];
  }>(
    (groups, attribute) => {
      if (attribute.isComposite) {
        groups.compositeAttributes.push(attribute);
      } else if (attribute.isKey || attribute.isPartialKey) {
        groups.keyAttributes.push(attribute);
      } else {
        groups.regularAttributes.push(attribute);
      }

      return groups;
    },
    {
      keyAttributes: [],
      regularAttributes: [],
      compositeAttributes: [],
    },
  );
}

function getCompositeSubtreeSpan(attribute: AttributeModel): number {
  if (attribute.children.length === 0) {
    return ATTRIBUTE_NODE_WIDTH;
  }

  const childSpans = attribute.children.map(getCompositeSubtreeSpan);
  const childrenWidth =
    sum(childSpans) + Math.max(0, attribute.children.length - 1) * COMPOSITE_CHILD_GAP;

  return Math.max(ATTRIBUTE_NODE_WIDTH, childrenWidth);
}

function getCompositeDepth(attribute: AttributeModel): number {
  if (attribute.children.length === 0) {
    return 0;
  }

  return 1 + Math.max(...attribute.children.map(getCompositeDepth));
}

function getCompositeForestWidth(attributes: AttributeModel[]): number {
  if (attributes.length === 0) {
    return 0;
  }

  const spans = attributes.map(getCompositeSubtreeSpan);
  return sum(spans) + Math.max(0, attributes.length - 1) * COMPOSITE_ROOT_GAP;
}

function getEntityMetrics(entity: EntityModel): EntityMetrics {
  const { keyAttributes, regularAttributes, compositeAttributes } = classifyRootAttributes(
    entity.attributes,
  );

  const keyRows = splitIntoRows(keyAttributes, 3);
  const keyBandWidth = getBandWidth(keyAttributes.length, 3, ATTRIBUTE_SIBLING_GAP);
  const regularRows = Math.ceil(regularAttributes.length / 2);
  const compositeWidth = getCompositeForestWidth(compositeAttributes);
  const compositeDepth = compositeAttributes.length
    ? Math.max(...compositeAttributes.map(getCompositeDepth))
    : 0;

  const topExtent =
    keyRows.length > 0
      ? ATTRIBUTE_TOP_OFFSET +
        (keyRows.length - 1) * ATTRIBUTE_TOP_ROW_GAP +
        ATTRIBUTE_RY
      : 0;

  const regularBottomExtent =
    regularRows > 0
      ? ATTRIBUTE_BOTTOM_OFFSET +
        (regularRows - 1) * ATTRIBUTE_SIDE_ROW_GAP +
        ATTRIBUTE_RY
      : 0;

  const compositeBottomExtent =
    compositeAttributes.length > 0
      ? ATTRIBUTE_BOTTOM_OFFSET + compositeDepth * COMPOSITE_LEVEL_GAP + ATTRIBUTE_RY
      : 0;

  const sideWidth = ATTRIBUTE_SIDE_OFFSET + ATTRIBUTE_RX;
  const zoneWidth = Math.max(
    MIN_ENTITY_ZONE_WIDTH,
    keyBandWidth + 80,
    compositeWidth + 80,
    ENTITY_WIDTH + sideWidth * 2 + 40,
  );
  const bottomExtent = Math.max(regularBottomExtent, compositeBottomExtent, ATTRIBUTE_RY + 40);

  return {
    keyAttributes,
    regularAttributes,
    compositeAttributes,
    zoneWidth,
    topExtent,
    bottomExtent,
    layoutWidth: zoneWidth,
    layoutHeight: topExtent + ENTITY_HEIGHT + bottomExtent + ENTITY_LAYOUT_PADDING_Y * 2,
  };
}

function getShapeBounds(shape: CoreShape): LayoutRect {
  return {
    minX: shape.x - shape.width / 2,
    minY: shape.y - shape.height / 2,
    maxX: shape.x + shape.width / 2,
    maxY: shape.y + shape.height / 2,
  };
}

function expandRect(rect: LayoutRect, padding: number): LayoutRect {
  return {
    minX: rect.minX - padding,
    minY: rect.minY - padding,
    maxX: rect.maxX + padding,
    maxY: rect.maxY + padding,
  };
}

function getAttributeBounds(attribute: Pick<PositionedAttribute, "x" | "y" | "rx" | "ry">): LayoutRect {
  return {
    minX: attribute.x - attribute.rx,
    minY: attribute.y - attribute.ry,
    maxX: attribute.x + attribute.rx,
    maxY: attribute.y + attribute.ry,
  };
}

function rectsOverlap(left: LayoutRect, right: LayoutRect): boolean {
  return !(
    left.maxX < right.minX ||
    left.minX > right.maxX ||
    left.maxY < right.minY ||
    left.minY > right.maxY
  );
}

function pointInRect(point: LayoutPoint, rect: LayoutRect): boolean {
  return (
    point.x >= rect.minX &&
    point.x <= rect.maxX &&
    point.y >= rect.minY &&
    point.y <= rect.maxY
  );
}

function orientation(a: LayoutPoint, b: LayoutPoint, c: LayoutPoint): number {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function onSegment(a: LayoutPoint, b: LayoutPoint, c: LayoutPoint): boolean {
  return (
    Math.min(a.x, c.x) <= b.x &&
    b.x <= Math.max(a.x, c.x) &&
    Math.min(a.y, c.y) <= b.y &&
    b.y <= Math.max(a.y, c.y)
  );
}

function segmentsIntersect(a1: LayoutPoint, a2: LayoutPoint, b1: LayoutPoint, b2: LayoutPoint): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 === 0 && onSegment(a1, b1, a2)) {
    return true;
  }

  if (o2 === 0 && onSegment(a1, b2, a2)) {
    return true;
  }

  if (o3 === 0 && onSegment(b1, a1, b2)) {
    return true;
  }

  if (o4 === 0 && onSegment(b1, a2, b2)) {
    return true;
  }

  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function segmentIntersectsRect(start: LayoutPoint, end: LayoutPoint, rect: LayoutRect): boolean {
  if (pointInRect(start, rect) || pointInRect(end, rect)) {
    return true;
  }

  const topLeft = { x: rect.minX, y: rect.minY };
  const topRight = { x: rect.maxX, y: rect.minY };
  const bottomLeft = { x: rect.minX, y: rect.maxY };
  const bottomRight = { x: rect.maxX, y: rect.maxY };

  return (
    segmentsIntersect(start, end, topLeft, topRight) ||
    segmentsIntersect(start, end, topRight, bottomRight) ||
    segmentsIntersect(start, end, bottomRight, bottomLeft) ||
    segmentsIntersect(start, end, bottomLeft, topLeft)
  );
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

function polylineIntersectsRect(points: LayoutPoint[], rect: LayoutRect): boolean {
  for (let index = 0; index < points.length - 1; index += 1) {
    if (segmentIntersectsRect(points[index], points[index + 1], rect)) {
      return true;
    }
  }

  return false;
}

function getObstacleBounds(shape: CoreShape): LayoutRect {
  return expandRect(getShapeBounds(shape), EDGE_OBSTACLE_PADDING);
}

function getShapeBoundaryPoint(shape: CoreShape, toward: LayoutPoint): LayoutPoint {
  if (shape.kind === "relationship") {
    return getDiamondBoundaryPoint(shape.x, shape.y, shape.width, shape.height, toward.x, toward.y);
  }

  return getRectBoundaryPoint(shape.x, shape.y, shape.width, shape.height, toward.x, toward.y);
}

function buildPrimaryGraph(
  entities: EntityModel[],
  relationships: RelationshipModel[],
  metricsById: Map<string, EntityMetrics>,
) {
  const entitiesByName = new Map<string, EntityModel>();
  entities.forEach((entity) => {
    entitiesByName.set(entity.name.toLowerCase(), entity);
  });

  const children = [
    ...entities.map((entity) => {
      const metrics = metricsById.get(entity.id);

      if (!metrics) {
        throw new Error(`Missing metrics for entity ${entity.id}.`);
      }

      return {
        id: entity.id,
        width: metrics.layoutWidth,
        height: metrics.layoutHeight,
      };
    }),
    ...relationships.map((relationship) => ({
      id: relationship.id,
      width: RELATIONSHIP_WIDTH + RELATIONSHIP_LAYOUT_PADDING,
      height: RELATIONSHIP_HEIGHT + RELATIONSHIP_LAYOUT_PADDING,
    })),
  ];

  const edges = relationships.flatMap((relationship) => {
    return relationship.participants.flatMap((participant, participantIndex) => {
      const entity = entitiesByName.get(participant.entity.toLowerCase());

      if (!entity) {
        return [];
      }

      return [
        {
          id: `${relationship.id}-participant-${participantIndex}`,
          sources: [entity.id],
          targets: [relationship.id],
        },
      ];
    });
  });

  return {
    id: "chen-root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "80",
      "elk.layered.spacing.nodeNodeBetweenLayers": "140",
      "elk.layered.spacing.edgeNodeBetweenLayers": "70",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.separateConnectedComponents": "true",
    },
    children,
    edges,
  };
}

async function runPrimaryLayout(
  entities: EntityModel[],
  relationships: RelationshipModel[],
  metricsById: Map<string, EntityMetrics>,
): Promise<{
  entities: EntityPlacement[];
  relationships: PositionedRelationship[];
  shapesById: Map<string, CoreShape>;
  edgeSectionsById: Map<string, LayoutPoint[]>;
}> {
  const graph = buildPrimaryGraph(entities, relationships, metricsById);
  const laidOutGraph = (await (elk.layout as (nextGraph: unknown) => Promise<unknown>)(
    graph,
  )) as ElkNode;
  const nodeById = new Map<string, ElkNode>();
  const edgeSectionsById = new Map<string, LayoutPoint[]>();

  (laidOutGraph.children ?? []).forEach((node) => {
    nodeById.set(node.id, node);
  });

  (laidOutGraph.edges ?? []).forEach((edge) => {
    const section = edge.sections?.[0];

    if (!section?.startPoint || !section.endPoint) {
      return;
    }

    edgeSectionsById.set(
      edge.id,
      simplifyPolyline([section.startPoint, ...(section.bendPoints ?? []), section.endPoint]),
    );
  });

  const entityPlacements: EntityPlacement[] = entities.map((entity) => {
    const node = nodeById.get(entity.id);
    const metrics = metricsById.get(entity.id);

    if (!node || !metrics || node.x === undefined || node.y === undefined) {
      throw new Error(`ELK did not return a position for entity ${entity.id}.`);
    }

    return {
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      model: entity,
      x: node.x + metrics.layoutWidth / 2,
      y: node.y + ENTITY_LAYOUT_PADDING_Y + metrics.topExtent + ENTITY_HEIGHT / 2,
      width: ENTITY_WIDTH,
      height: ENTITY_HEIGHT,
      zoneWidth: metrics.zoneWidth,
      topExtent: metrics.topExtent,
      bottomExtent: metrics.bottomExtent,
    };
  });

  const entityIdsByName = new Map(entityPlacements.map((entity) => [entity.name.toLowerCase(), entity.id]));
  const shapesById = new Map<string, CoreShape>();

  entityPlacements.forEach((entity) => {
    shapesById.set(entity.id, {
      id: entity.id,
      kind: "entity",
      x: entity.x,
      y: entity.y,
      width: entity.width,
      height: entity.height,
    });
  });

  const relationshipPlacements: PositionedRelationship[] = relationships.map((relationship) => {
    const node = nodeById.get(relationship.id);

    if (!node || node.x === undefined || node.y === undefined) {
      throw new Error(`ELK did not return a position for relationship ${relationship.id}.`);
    }

    const participants: PositionedRelationshipParticipant[] = relationship.participants.map(
      (participant) => ({
        entityId: entityIdsByName.get(participant.entity.toLowerCase()) ?? participant.entity,
        entityName: participant.entity,
        endConstraint: participant.endConstraint,
      }),
    );

    const positionedRelationship: PositionedRelationship = {
      id: relationship.id,
      name: relationship.name,
      kind: relationship.kind,
      x: node.x + (node.width ?? RELATIONSHIP_WIDTH) / 2,
      y: node.y + (node.height ?? RELATIONSHIP_HEIGHT) / 2,
      width: RELATIONSHIP_WIDTH,
      height: RELATIONSHIP_HEIGHT,
      participants,
      legacyCardinality: relationship.legacyCardinality,
    };

    shapesById.set(positionedRelationship.id, {
      id: positionedRelationship.id,
      kind: "relationship",
      x: positionedRelationship.x,
      y: positionedRelationship.y,
      width: positionedRelationship.width,
      height: positionedRelationship.height,
    });

    return positionedRelationship;
  });

  return {
    entities: entityPlacements,
    relationships: relationshipPlacements,
    shapesById,
    edgeSectionsById,
  };
}

function candidateOrthogonalRoutes(
  start: LayoutPoint,
  end: LayoutPoint,
  obstacles: LayoutRect[],
): LayoutPoint[][] {
  const routes: LayoutPoint[][] = [];
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  routes.push([start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]);
  routes.push([start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]);

  obstacles.forEach((obstacle) => {
    routes.push([
      start,
      { x: obstacle.minX - ORTHOGONAL_ROUTE_MARGIN, y: start.y },
      { x: obstacle.minX - ORTHOGONAL_ROUTE_MARGIN, y: end.y },
      end,
    ]);
    routes.push([
      start,
      { x: obstacle.maxX + ORTHOGONAL_ROUTE_MARGIN, y: start.y },
      { x: obstacle.maxX + ORTHOGONAL_ROUTE_MARGIN, y: end.y },
      end,
    ]);
    routes.push([
      start,
      { x: start.x, y: obstacle.minY - ORTHOGONAL_ROUTE_MARGIN },
      { x: end.x, y: obstacle.minY - ORTHOGONAL_ROUTE_MARGIN },
      end,
    ]);
    routes.push([
      start,
      { x: start.x, y: obstacle.maxY + ORTHOGONAL_ROUTE_MARGIN },
      { x: end.x, y: obstacle.maxY + ORTHOGONAL_ROUTE_MARGIN },
      end,
    ]);
  });

  return routes.map(simplifyPolyline);
}

function routeAroundObstacles(
  points: LayoutPoint[],
  sourceShapeId: string,
  targetShapeId: string,
  shapesById: Map<string, CoreShape>,
): LayoutPoint[] {
  const obstacles = [...shapesById.values()]
    .filter((shape) => shape.id !== sourceShapeId && shape.id !== targetShapeId)
    .map(getObstacleBounds);

  if (!obstacles.some((obstacle) => polylineIntersectsRect(points, obstacle))) {
    return points;
  }

  const start = points[0];
  const end = points[points.length - 1];
  const candidates = candidateOrthogonalRoutes(start, end, obstacles);

  const safeCandidate = candidates.find((candidate) => {
    return !obstacles.some((obstacle) => polylineIntersectsRect(candidate, obstacle));
  });

  return safeCandidate ?? points;
}

function buildEdgePathFromSection(
  sourceShape: CoreShape,
  targetShape: CoreShape,
  sectionPoints: LayoutPoint[] | undefined,
): LayoutPoint[] {
  const fallback = [
    { x: sourceShape.x, y: sourceShape.y },
    { x: targetShape.x, y: targetShape.y },
  ];
  const rawPoints = sectionPoints && sectionPoints.length >= 2 ? sectionPoints : fallback;
  const firstGuide = rawPoints[1] ?? rawPoints[rawPoints.length - 1];
  const lastGuide = rawPoints[rawPoints.length - 2] ?? rawPoints[0];
  const interior = rawPoints.slice(1, -1);

  const startPoint = getShapeBoundaryPoint(sourceShape, firstGuide);
  const endPoint = getShapeBoundaryPoint(targetShape, lastGuide);

  return simplifyPolyline([startPoint, ...interior, endPoint]);
}

function createPrimaryEdges(
  relationships: RelationshipModel[],
  positionedRelationships: PositionedRelationship[],
  shapesById: Map<string, CoreShape>,
  edgeSectionsById: Map<string, LayoutPoint[]>,
): LayoutEdge[] {
  const positionedRelationshipsById = new Map(
    positionedRelationships.map((relationship) => [relationship.id, relationship]),
  );
  const edges: LayoutEdge[] = [];

  relationships.forEach((relationship) => {
    const relationshipShape = shapesById.get(relationship.id);
    const positionedRelationship = positionedRelationshipsById.get(relationship.id);

    if (!relationshipShape || !positionedRelationship) {
      return;
    }

    positionedRelationship.participants.forEach((participant, participantIndex) => {
      const participantShape = shapesById.get(participant.entityId);

      if (!participantShape) {
        return;
      }

      const basePath = buildEdgePathFromSection(
        participantShape,
        relationshipShape,
        edgeSectionsById.get(`${relationship.id}-participant-${participantIndex}`),
      );
      const routedPath = routeAroundObstacles(
        basePath,
        participantShape.id,
        relationshipShape.id,
        shapesById,
      );

      edges.push({
        id: `${relationship.id}-participant-${participantIndex}`,
        kind: "entity-relationship",
        x1: routedPath[0].x,
        y1: routedPath[0].y,
        x2: routedPath[routedPath.length - 1].x,
        y2: routedPath[routedPath.length - 1].y,
        points: routedPath,
        endConstraint: participant.endConstraint,
      });
    });
  });

  return edges;
}

function getBalancedOffset(index: number, gap: number): number {
  if (index === 0) {
    return 0;
  }

  const step = Math.ceil(index / 2);
  return (index % 2 === 1 ? -1 : 1) * step * gap;
}

function getEntityRelationshipBias(
  entities: EntityPlacement[],
  relationships: PositionedRelationship[],
): Map<string, Array<{ x: number; y: number }>> {
  const positionsByEntity = new Map<string, Array<{ x: number; y: number }>>();

  relationships.forEach((relationship) => {
    relationship.participants.forEach((participant) => {
      const list = positionsByEntity.get(participant.entityId) ?? [];
      list.push({ x: relationship.x, y: relationship.y });
      positionsByEntity.set(participant.entityId, list);
    });
  });

  entities.forEach((entity) => {
    if (!positionsByEntity.has(entity.id)) {
      positionsByEntity.set(entity.id, []);
    }
  });

  return positionsByEntity;
}

function getEntityRegularSidePriority(
  entity: EntityPlacement,
  relationshipPositions: Array<{ x: number; y: number }>,
): AttributeSide[] {
  if (relationshipPositions.length === 0) {
    return ["left", "right", "bottom", "top"];
  }

  const averageDx =
    relationshipPositions.reduce((total, relationship) => total + (relationship.x - entity.x), 0) /
    relationshipPositions.length;
  const averageDy =
    relationshipPositions.reduce((total, relationship) => total + (relationship.y - entity.y), 0) /
    relationshipPositions.length;

  if (Math.abs(averageDx) >= Math.abs(averageDy)) {
    return averageDx >= 0
      ? ["left", "bottom", "right", "top"]
      : ["right", "bottom", "left", "top"];
  }

  return averageDy >= 0
    ? ["top", "left", "right", "bottom"]
    : ["bottom", "left", "right", "top"];
}

function getRelationshipAttributeSidePriority(relationship: PositionedRelationship): AttributeSide[] {
  const counts = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };

  relationship.participants.forEach((participant) => {
    // The participant edge directions create a basic occupancy score around the diamond.
    if (participant.entityId === participant.entityName) {
      return;
    }
  });

  // With ternary relationships, distributing attributes vertically first is usually clearer.
  const orderedSides: AttributeSide[] = ["top", "bottom", "right", "left"];

  return orderedSides.sort((left, right) => counts[left] - counts[right]);
}

function getEntityAttributeCandidate(
  entity: CoreShape,
  side: AttributeSide,
  slotIndex: number,
  outwardStep: number,
): LayoutPoint {
  const horizontalGap = ATTRIBUTE_NODE_WIDTH + ATTRIBUTE_SIBLING_GAP;

  if (side === "top") {
    return {
      x: entity.x + getBalancedOffset(slotIndex, horizontalGap),
      y: entity.y - ATTRIBUTE_TOP_OFFSET - outwardStep * ATTRIBUTE_OUTWARD_STEP,
    };
  }

  if (side === "bottom") {
    return {
      x: entity.x + getBalancedOffset(slotIndex, horizontalGap),
      y: entity.y + ATTRIBUTE_BOTTOM_OFFSET + outwardStep * ATTRIBUTE_OUTWARD_STEP,
    };
  }

  return {
    x:
      entity.x +
      (side === "left" ? -ATTRIBUTE_SIDE_OFFSET : ATTRIBUTE_SIDE_OFFSET) +
      (side === "left" ? -1 : 1) * outwardStep * ATTRIBUTE_OUTWARD_STEP,
    y: entity.y + ATTRIBUTE_SIDE_BASE_Y + getBalancedOffset(slotIndex, ATTRIBUTE_SIDE_ROW_GAP),
  };
}

function getRelationshipAttributeCandidate(
  relationship: CoreShape,
  side: AttributeSide,
  slotIndex: number,
  outwardStep: number,
): LayoutPoint {
  const horizontalGap = ATTRIBUTE_NODE_WIDTH + ATTRIBUTE_SIBLING_GAP;

  if (side === "top") {
    return {
      x: relationship.x + getBalancedOffset(slotIndex, horizontalGap),
      y: relationship.y - RELATIONSHIP_ATTRIBUTE_OFFSET - outwardStep * ATTRIBUTE_OUTWARD_STEP,
    };
  }

  if (side === "bottom") {
    return {
      x: relationship.x + getBalancedOffset(slotIndex, horizontalGap),
      y: relationship.y + RELATIONSHIP_ATTRIBUTE_OFFSET + outwardStep * ATTRIBUTE_OUTWARD_STEP,
    };
  }

  return {
    x:
      relationship.x +
      (side === "left" ? -RELATIONSHIP_ATTRIBUTE_SIDE_OFFSET : RELATIONSHIP_ATTRIBUTE_SIDE_OFFSET) +
      (side === "left" ? -1 : 1) * outwardStep * ATTRIBUTE_OUTWARD_STEP,
    y: relationship.y + getBalancedOffset(slotIndex, RELATIONSHIP_ATTRIBUTE_ROW_GAP),
  };
}

function attributeCollides(
  attribute: Pick<PositionedAttribute, "x" | "y" | "rx" | "ry">,
  nodeObstacles: LayoutRect[],
  placedAttributes: PositionedAttribute[],
  edgePaths: LayoutPoint[][],
): boolean {
  const bounds = expandRect(getAttributeBounds(attribute), ATTRIBUTE_COLLISION_PADDING);

  if (nodeObstacles.some((obstacle) => rectsOverlap(bounds, obstacle))) {
    return true;
  }

  if (
    placedAttributes.some((placedAttribute) =>
      rectsOverlap(
        bounds,
        expandRect(getAttributeBounds(placedAttribute), ATTRIBUTE_COLLISION_PADDING / 2),
      ),
    )
  ) {
    return true;
  }

  return edgePaths.some((points) =>
    polylineIntersectsRect(points, expandRect(bounds, ATTRIBUTE_EDGE_PADDING)),
  );
}

function createAttributeNode(
  attribute: AttributeModel,
  ownerId: string,
  ownerKind: AttributeOwnerKind,
  x: number,
  y: number,
  level: number,
): PositionedAttribute {
  return {
    id: attribute.id,
    name: attribute.name,
    ownerId,
    ownerKind,
    isKey: attribute.isKey,
    isPartialKey: attribute.isPartialKey,
    isComposite: attribute.isComposite,
    isMultivalued: attribute.isMultivalued,
    isDerived: attribute.isDerived,
    x,
    y,
    rx: ATTRIBUTE_RX,
    ry: ATTRIBUTE_RY,
    level,
  };
}

function connectOwnerToAttribute(
  ownerShape: CoreShape,
  attribute: PositionedAttribute,
): LayoutEdge {
  const start = getShapeBoundaryPoint(ownerShape, { x: attribute.x, y: attribute.y });
  const end = getEllipseBoundaryPoint(attribute.x, attribute.y, attribute.rx, attribute.ry, start.x, start.y);

  return {
    id: `${ownerShape.id}-${attribute.id}`,
    kind: ownerShape.kind === "relationship" ? "relationship-attribute" : "entity-attribute",
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    points: [start, end],
  };
}

function connectAttributeToAttribute(
  parent: PositionedAttribute,
  child: PositionedAttribute,
): LayoutEdge {
  const start = getEllipseBoundaryPoint(parent.x, parent.y, parent.rx, parent.ry, child.x, child.y);
  const end = getEllipseBoundaryPoint(child.x, child.y, child.rx, child.ry, parent.x, parent.y);

  return {
    id: `${parent.id}-${child.id}`,
    kind: "attribute-attribute",
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    points: [start, end],
  };
}

function flattenCompositeSubtree(
  root: PositionedAttribute,
  attribute: AttributeModel,
): PositionedAttribute[] {
  const nodes: PositionedAttribute[] = [root];

  const visitChildren = (
    parentNode: PositionedAttribute,
    model: AttributeModel,
    level: number,
  ) => {
    if (model.children.length === 0) {
      return;
    }

    const childSpans = model.children.map(getCompositeSubtreeSpan);
    const childrenWidth =
      sum(childSpans) + Math.max(0, model.children.length - 1) * COMPOSITE_CHILD_GAP;
    let cursorX = parentNode.x - childrenWidth / 2;

    model.children.forEach((child, index) => {
      const childSpan = childSpans[index];
      const childNode = createAttributeNode(
        child,
        root.ownerId,
        root.ownerKind,
        cursorX + childSpan / 2,
        parentNode.y + COMPOSITE_LEVEL_GAP,
        level,
      );
      childNode.parentAttributeId = parentNode.id;
      nodes.push(childNode);
      visitChildren(childNode, child, level + 1);
      cursorX += childSpan + COMPOSITE_CHILD_GAP;
    });
  };

  visitChildren(root, attribute, 1);
  return nodes;
}

function shiftSubtree(nodes: PositionedAttribute[], dx: number, dy: number): PositionedAttribute[] {
  return nodes.map((node) => ({
    ...node,
    x: node.x + dx,
    y: node.y + dy,
  }));
}

function subtreeCollides(
  nodes: PositionedAttribute[],
  nodeObstacles: LayoutRect[],
  placedAttributes: PositionedAttribute[],
  edgePaths: LayoutPoint[][],
): boolean {
  return nodes.some((node) => attributeCollides(node, nodeObstacles, placedAttributes, edgePaths));
}

function placeRootAttribute(
  ownerShape: CoreShape,
  ownerKind: AttributeOwnerKind,
  attribute: AttributeModel,
  preferredSides: AttributeSide[],
  sideCounts: Map<AttributeSide, number>,
  placedAttributes: PositionedAttribute[],
  edgePaths: LayoutPoint[][],
  nodeObstacles: LayoutRect[],
): PositionedAttribute {
  const candidateFactory =
    ownerKind === "entity"
      ? (side: AttributeSide, slot: number, push: number) =>
          getEntityAttributeCandidate(ownerShape, side, slot, push)
      : (side: AttributeSide, slot: number, push: number) =>
          getRelationshipAttributeCandidate(ownerShape, side, slot, push);

  const tried: Array<{ side: AttributeSide; slot: number }> = [];

  for (const side of preferredSides) {
    const slotIndex = sideCounts.get(side) ?? 0;
    tried.push({ side, slot: slotIndex });

    for (let pushStep = 0; pushStep <= ATTRIBUTE_MAX_PUSH_STEPS; pushStep += 1) {
      const point = candidateFactory(side, slotIndex, pushStep);
      const node = createAttributeNode(attribute, ownerShape.id, ownerKind, point.x, point.y, 0);

      if (!attributeCollides(node, nodeObstacles, placedAttributes, edgePaths)) {
        sideCounts.set(side, slotIndex + 1);
        return node;
      }
    }
  }

  const fallback = tried[0] ?? { side: "right" as const, slot: 0 };
  const point = candidateFactory(fallback.side, fallback.slot, ATTRIBUTE_MAX_PUSH_STEPS + 1);
  sideCounts.set(fallback.side, fallback.slot + 1);
  return createAttributeNode(attribute, ownerShape.id, ownerKind, point.x, point.y, 0);
}

function createOwnerAttributeLayout(
  ownerShape: CoreShape,
  ownerKind: AttributeOwnerKind,
  attributesToLayout: AttributeModel[],
  preferredRegularSides: AttributeSide[],
  placedAttributes: PositionedAttribute[],
  edgePaths: LayoutPoint[][],
  nodeObstacles: LayoutRect[],
): { attributes: PositionedAttribute[]; edges: LayoutEdge[] } {
  const positionedAttributes: PositionedAttribute[] = [];
  const layoutEdges: LayoutEdge[] = [];
  const { keyAttributes, regularAttributes, compositeAttributes } =
    classifyRootAttributes(attributesToLayout);
  const sideCounts = new Map<AttributeSide, number>();

  keyAttributes.forEach((attribute) => {
    const node = placeRootAttribute(
      ownerShape,
      ownerKind,
      attribute,
      ["top", "left", "right"],
      sideCounts,
      [...placedAttributes, ...positionedAttributes],
      edgePaths,
      nodeObstacles,
    );
    positionedAttributes.push(node);
    layoutEdges.push(connectOwnerToAttribute(ownerShape, node));
  });

  regularAttributes.forEach((attribute) => {
    const node = placeRootAttribute(
      ownerShape,
      ownerKind,
      attribute,
      preferredRegularSides,
      sideCounts,
      [...placedAttributes, ...positionedAttributes],
      edgePaths,
      nodeObstacles,
    );
    positionedAttributes.push(node);
    layoutEdges.push(connectOwnerToAttribute(ownerShape, node));
  });

  compositeAttributes.forEach((attribute) => {
    const rootNode = placeRootAttribute(
      ownerShape,
      ownerKind,
      attribute,
      ["bottom", "right", "left"],
      sideCounts,
      [...placedAttributes, ...positionedAttributes],
      edgePaths,
      nodeObstacles,
    );
    let subtree = flattenCompositeSubtree(rootNode, attribute);

    for (let pushStep = 0; pushStep <= ATTRIBUTE_MAX_PUSH_STEPS; pushStep += 1) {
      if (
        !subtreeCollides(
          subtree,
          nodeObstacles,
          [...placedAttributes, ...positionedAttributes],
          edgePaths,
        )
      ) {
        break;
      }

      subtree = shiftSubtree(subtree, 0, COMPOSITE_PUSH_STEP);
    }

    positionedAttributes.push(...subtree);
    layoutEdges.push(connectOwnerToAttribute(ownerShape, subtree[0]));

    subtree.slice(1).forEach((node) => {
      const parentNode = subtree.find((candidate) => candidate.id === node.parentAttributeId);

      if (parentNode) {
        layoutEdges.push(connectAttributeToAttribute(parentNode, node));
      }
    });
  });

  return { attributes: positionedAttributes, edges: layoutEdges };
}

function createAttributeLayout(
  entities: EntityPlacement[],
  relationships: PositionedRelationship[],
  relationshipModels: RelationshipModel[],
  primaryEdges: LayoutEdge[],
  shapesById: Map<string, CoreShape>,
): { attributes: PositionedAttribute[]; edges: LayoutEdge[] } {
  const attributes: PositionedAttribute[] = [];
  const edges: LayoutEdge[] = [];
  const entityBiasById = getEntityRelationshipBias(entities, relationships);
  const nodeObstacles = [...shapesById.values()].map(getShapeBounds);
  const coreEdgePaths = primaryEdges
    .map((edge) => edge.points)
    .filter((points): points is LayoutPoint[] => points !== undefined);
  const relationshipModelById = new Map(
    relationshipModels.map((relationship) => [relationship.id, relationship]),
  );

  entities.forEach((entity) => {
    const ownerShape = shapesById.get(entity.id);

    if (!ownerShape) {
      return;
    }

    const ownerLayout = createOwnerAttributeLayout(
      ownerShape,
      "entity",
      entity.model.attributes,
      getEntityRegularSidePriority(entity, entityBiasById.get(entity.id) ?? []),
      attributes,
      coreEdgePaths,
      nodeObstacles,
    );
    attributes.push(...ownerLayout.attributes);
    edges.push(...ownerLayout.edges);
  });

  relationships.forEach((relationship) => {
    const ownerShape = shapesById.get(relationship.id);
    const relationshipModel = relationshipModelById.get(relationship.id);

    if (!ownerShape || !relationshipModel || relationshipModel.attributes.length === 0) {
      return;
    }

    const ownerLayout = createOwnerAttributeLayout(
      ownerShape,
      "relationship",
      relationshipModel.attributes,
      getRelationshipAttributeSidePriority(relationship),
      attributes,
      coreEdgePaths,
      nodeObstacles,
    );
    attributes.push(...ownerLayout.attributes);
    edges.push(...ownerLayout.edges);
  });

  return { attributes, edges };
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

  attributes.forEach((attribute) => {
    const ringOffset = attribute.isMultivalued ? 6 : 0;
    includeBounds(
      attribute.x - attribute.rx - ringOffset,
      attribute.y - attribute.ry - ringOffset,
      attribute.x + attribute.rx + ringOffset,
      attribute.y + attribute.ry + ringOffset,
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
  const metricsById = new Map<string, EntityMetrics>();

  model.entities.forEach((entity) => {
    metricsById.set(entity.id, getEntityMetrics(entity));
  });

  const primaryLayout = await runPrimaryLayout(model.entities, model.relationships, metricsById);
  const primaryEdges = createPrimaryEdges(
    model.relationships,
    primaryLayout.relationships,
    primaryLayout.shapesById,
    primaryLayout.edgeSectionsById,
  );
  const attributeLayout = createAttributeLayout(
    primaryLayout.entities,
    primaryLayout.relationships,
    model.relationships,
    primaryEdges,
    primaryLayout.shapesById,
  );

  return normalizeLayout(
    primaryLayout.entities.map(
      ({
        model: _model,
        zoneWidth: _zoneWidth,
        topExtent: _topExtent,
        bottomExtent: _bottomExtent,
        ...entity
      }) => entity,
    ),
    attributeLayout.attributes,
    primaryLayout.relationships,
    [...primaryEdges, ...attributeLayout.edges],
  );
}
