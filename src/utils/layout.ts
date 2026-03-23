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

const ENTITY_WIDTH = 170;
const ENTITY_HEIGHT = 68;
const ATTRIBUTE_RX = 58;
const ATTRIBUTE_RY = 24;
const RELATIONSHIP_WIDTH = 118;
const RELATIONSHIP_HEIGHT = 74;

const LAYOUT_MARGIN = 150;
const TARGET_PAGE_ASPECT_RATIO = 1.414;

const ENTITY_MIN_DISTANCE = 430;
const ENTITY_SPACING = ENTITY_MIN_DISTANCE;
const ENTITY_GRID_SPACING_X = ENTITY_SPACING;
const ENTITY_GRID_SPACING_Y = 360;
const ENTITY_REPULSION = 150000;
const ENTITY_ATTRACTION = 0.0027;
const ENTITY_CENTER_GRAVITY = 0.0012;
const ENTITY_SLOT_ATTRACTION = 0.02;
const ENTITY_FORCE_ITERATIONS = 180;
const ENTITY_COLLISION_PADDING = 96;
const MIN_NODE_GAP = 26;
const MIN_NODE_DISTANCE = MIN_NODE_GAP;
const MIN_NODE_CLEARANCE = 18;
const ZONE_ATTRACTION = 0.014;
const ZONE_SPACING_X = 560;
const ZONE_SPACING_Y = 420;

const RELATIONSHIP_DISTANCE = 46;
const RELATIONSHIP_OFFSET = RELATIONSHIP_DISTANCE;
const RELATIONSHIP_PAIR_OFFSET = 82;
const RELATIONSHIP_TRIPLE_OFFSET = 64;
const SELF_RELATIONSHIP_DISTANCE = 252;
const SELF_LOOP_RADIUS = 62;
const SELF_LOOP_OFFSET = 26;
const RELATIONSHIP_COLLISION_PADDING = 48;
const MIN_ENTITY_RELATION_DISTANCE = 96;
const RELATIONSHIP_PADDING = 108;
const BINARY_CLUSTER_RADIUS = 285;
const TERNARY_CLUSTER_RADIUS = 235;
const CLUSTER_PADDING = 54;

const ATTRIBUTE_RADIUS = 196;
const ATTRIBUTE_BASE_RADIUS = ATTRIBUTE_RADIUS;
const ATTRIBUTE_CLUSTER_BASE_GAP = 80;
const ATTRIBUTE_INDEX_RADIUS_STEP = 10;
const ATTRIBUTE_VERTICAL_MIN_SPACING = 40;
const ATTRIBUTE_SECTOR_SPAN = (Math.PI * 2) / 3;
const ATTRIBUTE_COLUMN_CAPACITY = 6;
const ATTRIBUTE_COLUMN_X_STEP = 30;
const ATTRIBUTE_OVERFLOW_Y_STEP = 42;
const ATTRIBUTE_RING_STEP = 72;
const ATTRIBUTE_MAX_PER_RING = 8;
const ATTRIBUTE_COLLISION_PADDING = 20;
const MIN_ATTRIBUTE_GAP = 22;
const MIN_EDGE_TO_ATTRIBUTE_CLEARANCE = 18;
const ATTRIBUTE_SPACING = 98;
const ATTRIBUTE_OWNER_CURVE_BEND = 24;
const COMPOSITE_CHILD_SPACING = 122;
const COMPOSITE_CHILD_RADIUS = COMPOSITE_CHILD_SPACING;
const COMPOSITE_LEVEL_Y_STEP = 92;
const COMPOSITE_FAN_SPREAD = 1.25;
const KEY_ATTRIBUTE_Y_OFFSET = 148;
const REGULAR_ATTRIBUTE_SIDE_OFFSET = 188;
const REGULAR_ATTRIBUTE_ROW_GAP = ATTRIBUTE_SPACING;
const BOTTOM_ATTRIBUTE_Y_OFFSET = 156;
const COMPOSITE_ATTRIBUTE_Y_OFFSET = 176;

const EDGE_CURVE_STRENGTH = 0.075;
const EDGE_CURVE_OFFSET = 26;
const EDGE_OFFSET = 14;
const EDGE_SEPARATION_OFFSET = 16;
const MAX_EDGE_CURVE = 28;
const RELATIONSHIP_NUDGE_DISTANCE = 22;
const LOCAL_NUDGE_STEP = 10;
const MAX_LOCAL_NUDGE_DISTANCE = 42;
const LABEL_PADDING = 10;
const MANUAL_ALIGNMENT_THRESHOLD = 56;
const MANUAL_ENTITY_ALIGNMENT_PULL = 0.22;
const MANUAL_RELATIONSHIP_MIDPOINT_PULL = 0.82;
const TERNARY_ENTRY_MIN_SEPARATION = 0.82;
const TERNARY_ENTRY_GUIDE_OFFSET = 42;

const RELATIONSHIP_DOUBLE_LINE_OFFSET = 4;
const RELATIONSHIP_ARROW_LENGTH = 18;
const RELATIONSHIP_ARROW_WIDTH = 14;

type ShapeKind = "entity" | "relationship";
type AttributeOwnerKind = "entity" | "relationship";

interface EntityPlacement extends PositionedEntity {
  model: EntityModel;
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

interface CoreRelationshipInfo {
  model: RelationshipModel;
  participantEntityIds: string[];
}

interface RelationshipZone {
  relationshipId: string;
  x: number;
  y: number;
}

interface RelationshipComponent {
  relationshipIds: string[];
  weight: number;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function blendValue(current: number, target: number, strength: number): number {
  return current + (target - current) * strength;
}

function angleBetween(from: LayoutPoint, to: LayoutPoint): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function normalizeAngle(angle: number): number {
  let nextAngle = angle;

  while (nextAngle <= -Math.PI) {
    nextAngle += Math.PI * 2;
  }

  while (nextAngle > Math.PI) {
    nextAngle -= Math.PI * 2;
  }

  return nextAngle;
}

function normalizePositiveAngle(angle: number): number {
  let nextAngle = angle;

  while (nextAngle < 0) {
    nextAngle += Math.PI * 2;
  }

  while (nextAngle >= Math.PI * 2) {
    nextAngle -= Math.PI * 2;
  }

  return nextAngle;
}

function clampAngle(angle: number, minAngle: number, maxAngle: number): number {
  return Math.max(minAngle, Math.min(maxAngle, angle));
}

function polarPoint(centerX: number, centerY: number, radius: number, angle: number): LayoutPoint {
  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
  };
}

function getBalancedOffset(index: number, gap: number): number {
  if (index === 0) {
    return 0;
  }

  const step = Math.ceil(index / 2);
  return (index % 2 === 1 ? -1 : 1) * step * gap;
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

function expandRect(rect: LayoutRect, padding: number): LayoutRect {
  return {
    minX: rect.minX - padding,
    minY: rect.minY - padding,
    maxX: rect.maxX + padding,
    maxY: rect.maxY + padding,
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

function getAttributeBounds(attribute: Pick<PositionedAttribute, "x" | "y" | "rx" | "ry">): LayoutRect {
  return {
    minX: attribute.x - attribute.rx,
    minY: attribute.y - attribute.ry,
    maxX: attribute.x + attribute.rx,
    maxY: attribute.y + attribute.ry,
  };
}

function getRelationshipBounds(
  relationship: Pick<PositionedRelationship, "x" | "y" | "width" | "height">,
): LayoutRect {
  return {
    minX: relationship.x - relationship.width / 2,
    minY: relationship.y - relationship.height / 2,
    maxX: relationship.x + relationship.width / 2,
    maxY: relationship.y + relationship.height / 2,
  };
}

function getEntityBounds(entity: Pick<PositionedEntity, "x" | "y" | "width" | "height">): LayoutRect {
  return {
    minX: entity.x - entity.width / 2,
    minY: entity.y - entity.height / 2,
    maxX: entity.x + entity.width / 2,
    maxY: entity.y + entity.height / 2,
  };
}

function getRoleLabelBounds(text: string, x: number, y: number): LayoutRect {
  const width = Math.max(44, text.length * 8.4);
  const height = 22;

  return expandRect(
    {
      minX: x - width / 2,
      minY: y - height / 2,
      maxX: x + width / 2,
      maxY: y + height / 2,
    },
    LABEL_PADDING,
  );
}

function getPolylineMidpoint(points: LayoutPoint[]): LayoutPoint {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  if (points.length === 1) {
    return points[0];
  }

  const segmentLengths = points.slice(0, -1).map((point, index) =>
    Math.hypot(points[index + 1].x - point.x, points[index + 1].y - point.y),
  );
  const totalLength = sum(segmentLengths);

  if (totalLength === 0) {
    return points[0];
  }

  let traversed = 0;
  const targetLength = totalLength / 2;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];

    if (traversed + segmentLength < targetLength) {
      traversed += segmentLength;
      continue;
    }

    const start = points[index];
    const end = points[index + 1];
    const ratio = (targetLength - traversed) / (segmentLength || 1);
    return {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    };
  }

  return points[points.length - 1];
}

function getPointBetween(start: LayoutPoint, end: LayoutPoint, ratio: number): LayoutPoint {
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  };
}

function isStraightSegmentClear(
  start: LayoutPoint,
  end: LayoutPoint,
  obstacleRects: LayoutRect[],
): boolean {
  if (obstacleRects.length === 0) {
    return true;
  }

  const sampleCount = Math.max(8, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 32));

  for (let index = 1; index < sampleCount; index += 1) {
    const point = getPointBetween(start, end, index / sampleCount);

    if (obstacleRects.some((rect) => pointInRect(point, rect))) {
      return false;
    }
  }

  return true;
}

function getRectCenter(rect: LayoutRect): LayoutPoint {
  return {
    x: (rect.minX + rect.maxX) / 2,
    y: (rect.minY + rect.maxY) / 2,
  };
}

function sampleEdgePoints(edge: LayoutEdge, steps = 16): LayoutPoint[] {
  const points =
    edge.points && edge.points.length >= 2
      ? edge.points
      : [
          { x: edge.x1, y: edge.y1 },
          { x: edge.x2, y: edge.y2 },
        ];

  if (points.length <= 2) {
    return points.length === 2
      ? [points[0], getPointBetween(points[0], points[1], 0.5), points[1]]
      : points;
  }

  const samples: LayoutPoint[] = [];

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;

    if (points.length === 3) {
      const [p0, p1, p2] = points;
      const oneMinusT = 1 - t;
      samples.push({
        x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
        y: oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y,
      });
      continue;
    }

    if (points.length === 4) {
      const [p0, p1, p2, p3] = points;
      const oneMinusT = 1 - t;
      samples.push({
        x:
          oneMinusT * oneMinusT * oneMinusT * p0.x +
          3 * oneMinusT * oneMinusT * t * p1.x +
          3 * oneMinusT * t * t * p2.x +
          t * t * t * p3.x,
        y:
          oneMinusT * oneMinusT * oneMinusT * p0.y +
          3 * oneMinusT * oneMinusT * t * p1.y +
          3 * oneMinusT * t * t * p2.y +
          t * t * t * p3.y,
      });
      continue;
    }

    const scaledIndex = t * (points.length - 1);
    const baseIndex = Math.min(points.length - 2, Math.floor(scaledIndex));
    const localT = scaledIndex - baseIndex;
    samples.push(getPointBetween(points[baseIndex], points[baseIndex + 1], localT));
  }

  return samples;
}

function getClosestEdgeSample(edge: LayoutEdge, point: LayoutPoint): { point: LayoutPoint; distance: number } {
  const samples = sampleEdgePoints(edge);
  let closestPoint = samples[0] ?? point;
  let closestDistance = Math.hypot(point.x - closestPoint.x, point.y - closestPoint.y);

  samples.forEach((sample) => {
    const distance = Math.hypot(point.x - sample.x, point.y - sample.y);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestPoint = sample;
    }
  });

  return {
    point: closestPoint,
    distance: closestDistance,
  };
}

function edgeNearRect(edge: LayoutEdge, rect: LayoutRect, clearance: number): boolean {
  const expandedRect = expandRect(rect, clearance);
  return sampleEdgePoints(edge).some((sample) => pointInRect(sample, expandedRect));
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

function getGridSlots(count: number, columns: number, spacingX: number, spacingY: number): LayoutPoint[] {
  const rows = Math.ceil(count / columns);
  const slots: LayoutPoint[] = [];

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      if (slots.length >= count) {
        break;
      }

      slots.push({
        x: (columnIndex - (columns - 1) / 2) * spacingX,
        y: (rowIndex - (rows - 1) / 2) * spacingY,
      });
    }
  }

  return slots.sort((left, right) => {
    const leftDistance = Math.hypot(left.x, left.y);
    const rightDistance = Math.hypot(right.x, right.y);
    return leftDistance - rightDistance;
  });
}

function buildCoreRelationshipInfo(
  entities: EntityModel[],
  relationships: RelationshipModel[],
): {
  relationshipInfos: CoreRelationshipInfo[];
  degreesByEntityId: Map<string, number>;
  entityIdsByName: Map<string, string>;
  adjacencyWeights: Map<string, Map<string, number>>;
} {
  const entityIdsByName = new Map(entities.map((entity) => [entity.name.toLowerCase(), entity.id]));
  const degreesByEntityId = new Map(entities.map((entity) => [entity.id, 0]));
  const adjacencyWeights = new Map(
    entities.map((entity) => [entity.id, new Map<string, number>()]),
  );
  const relationshipInfos = relationships.map((relationship) => {
    const participantEntityIds = relationship.participants
      .map((participant) => entityIdsByName.get(participant.entity.toLowerCase()))
      .filter((entityId): entityId is string => entityId !== undefined);

    participantEntityIds.forEach((entityId) => {
      degreesByEntityId.set(entityId, (degreesByEntityId.get(entityId) ?? 0) + 1);
    });

    for (let leftIndex = 0; leftIndex < participantEntityIds.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < participantEntityIds.length; rightIndex += 1) {
        const leftId = participantEntityIds[leftIndex];
        const rightId = participantEntityIds[rightIndex];
        const leftEdges = adjacencyWeights.get(leftId);
        const rightEdges = adjacencyWeights.get(rightId);

        if (leftEdges && rightEdges) {
          leftEdges.set(rightId, (leftEdges.get(rightId) ?? 0) + 1);
          rightEdges.set(leftId, (rightEdges.get(leftId) ?? 0) + 1);
        }
      }
    }

    return {
      model: relationship,
      participantEntityIds,
    };
  });

  return {
    relationshipInfos,
    degreesByEntityId,
    entityIdsByName,
    adjacencyWeights,
  };
}

function buildRelationshipComponents(
  relationshipInfos: CoreRelationshipInfo[],
): RelationshipComponent[] {
  const adjacency = new Map(
    relationshipInfos.map((relationshipInfo) => [relationshipInfo.model.id, new Set<string>()]),
  );

  for (let leftIndex = 0; leftIndex < relationshipInfos.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < relationshipInfos.length; rightIndex += 1) {
      const left = relationshipInfos[leftIndex];
      const right = relationshipInfos[rightIndex];
      const sharedEntity = left.participantEntityIds.some((entityId) =>
        right.participantEntityIds.includes(entityId),
      );

      if (!sharedEntity) {
        continue;
      }

      adjacency.get(left.model.id)?.add(right.model.id);
      adjacency.get(right.model.id)?.add(left.model.id);
    }
  }

  const visited = new Set<string>();
  const components: RelationshipComponent[] = [];

  relationshipInfos.forEach((relationshipInfo) => {
    if (visited.has(relationshipInfo.model.id)) {
      return;
    }

    const stack = [relationshipInfo.model.id];
    const relationshipIds: string[] = [];
    let weight = 0;

    while (stack.length > 0) {
      const nextId = stack.pop();

      if (!nextId || visited.has(nextId)) {
        continue;
      }

      visited.add(nextId);
      relationshipIds.push(nextId);
      const info = relationshipInfos.find((candidate) => candidate.model.id === nextId);

      if (info) {
        weight += info.participantEntityIds.length * 2 + (info.model.isSelfRelationship ? 1.5 : 0);
      }

      adjacency.get(nextId)?.forEach((neighborId) => {
        if (!visited.has(neighborId)) {
          stack.push(neighborId);
        }
      });
    }

    components.push({
      relationshipIds,
      weight,
    });
  });

  return components.sort((left, right) => right.weight - left.weight);
}

function createRelationshipZones(
  relationshipInfos: CoreRelationshipInfo[],
  degreesByEntityId: Map<string, number>,
): Map<string, LayoutPoint> {
  const relationshipInfoById = new Map(
    relationshipInfos.map((relationshipInfo) => [relationshipInfo.model.id, relationshipInfo]),
  );
  const components = buildRelationshipComponents(relationshipInfos);
  const componentColumns = Math.max(
    1,
    Math.ceil(Math.sqrt(Math.max(1, components.length) * TARGET_PAGE_ASPECT_RATIO)),
  );
  const componentAnchors = getGridSlots(
    components.length,
    componentColumns,
    ZONE_SPACING_X,
    ZONE_SPACING_Y,
  );
  const zones = new Map<string, LayoutPoint>();

  components.forEach((component, componentIndex) => {
    const anchor = componentAnchors[componentIndex] ?? { x: 0, y: 0 };
    const componentInfos = component.relationshipIds
      .map((relationshipId) => relationshipInfoById.get(relationshipId))
      .filter((relationshipInfo): relationshipInfo is CoreRelationshipInfo => relationshipInfo !== undefined)
      .sort((left, right) => {
        const rightDegree = sum(
          right.participantEntityIds.map((entityId) => degreesByEntityId.get(entityId) ?? 0),
        );
        const leftDegree = sum(
          left.participantEntityIds.map((entityId) => degreesByEntityId.get(entityId) ?? 0),
        );

        return (
          right.participantEntityIds.length - left.participantEntityIds.length ||
          rightDegree - leftDegree
        );
      });
    const localColumns = Math.max(1, Math.ceil(Math.sqrt(componentInfos.length)));
    const localSlots = getGridSlots(
      componentInfos.length,
      localColumns,
      ZONE_SPACING_X * 0.64,
      ZONE_SPACING_Y * 0.56,
    );

    componentInfos.forEach((relationshipInfo, localIndex) => {
      const slot = localSlots[localIndex] ?? { x: 0, y: 0 };
      const selfShift = relationshipInfo.model.isSelfRelationship
        ? { x: ZONE_SPACING_X * 0.16, y: -ZONE_SPACING_Y * 0.2 }
        : { x: 0, y: 0 };

      zones.set(relationshipInfo.model.id, {
        x: anchor.x + slot.x + selfShift.x,
        y: anchor.y + slot.y + selfShift.y,
      });
    });
  });

  return zones;
}

function computeEntityTargetPositions(
  entities: EntityModel[],
  relationshipInfos: CoreRelationshipInfo[],
  relationshipZones: Map<string, LayoutPoint>,
  degreesByEntityId: Map<string, number>,
): Map<string, LayoutPoint> {
  const incidentZones = new Map<string, LayoutPoint[]>();

  entities.forEach((entity) => {
    incidentZones.set(entity.id, []);
  });

  relationshipInfos.forEach((relationshipInfo) => {
    const zone = relationshipZones.get(relationshipInfo.model.id);

    if (!zone) {
      return;
    }

    relationshipInfo.participantEntityIds.forEach((entityId) => {
      incidentZones.get(entityId)?.push(zone);
    });
  });

  const targetPositions = new Map<string, LayoutPoint>();
  const isolatedEntities = entities.filter(
    (entity) => (incidentZones.get(entity.id)?.length ?? 0) === 0,
  );
  const isolatedSlots = getGridSlots(
    isolatedEntities.length,
    Math.max(1, Math.ceil(Math.sqrt(Math.max(1, isolatedEntities.length) * TARGET_PAGE_ASPECT_RATIO))),
    ENTITY_GRID_SPACING_X * 0.9,
    ENTITY_GRID_SPACING_Y * 0.8,
  );

  entities.forEach((entity, index) => {
    const zones = incidentZones.get(entity.id) ?? [];

    if (zones.length === 0) {
      const isolatedIndex = isolatedEntities.findIndex((candidate) => candidate.id === entity.id);
      const slot = isolatedSlots[isolatedIndex] ?? { x: 0, y: 0 };
      targetPositions.set(entity.id, {
        x: slot.x + (isolatedIndex % 2 === 0 ? -1 : 1) * 120,
        y: slot.y + 220,
      });
      return;
    }

    const centroid = {
      x: sum(zones.map((zone) => zone.x)) / zones.length,
      y: sum(zones.map((zone) => zone.y)) / zones.length,
    };
    const degree = degreesByEntityId.get(entity.id) ?? 0;
    const spreadRadius = Math.max(56, Math.min(148, 108 - degree * 5));
    const angle = index * 2.399963229728653;

    targetPositions.set(entity.id, {
      x: centroid.x + Math.cos(angle) * spreadRadius,
      y: centroid.y + Math.sin(angle) * spreadRadius * 0.75,
    });
  });

  return targetPositions;
}

function createInitialEntityPlacements(
  entities: EntityModel[],
  degreesByEntityId: Map<string, number>,
): EntityPlacement[] {
  const orderedEntities = [...entities].sort((left, right) => {
    return (degreesByEntityId.get(right.id) ?? 0) - (degreesByEntityId.get(left.id) ?? 0);
  });
  const columnCount = Math.max(
    2,
    Math.ceil(Math.sqrt(Math.max(1, orderedEntities.length) * TARGET_PAGE_ASPECT_RATIO)),
  );
  const slots = getGridSlots(
    orderedEntities.length,
    columnCount,
    ENTITY_GRID_SPACING_X,
    ENTITY_GRID_SPACING_Y,
  );

  return orderedEntities.map((entity, index) => ({
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    model: entity,
    x: slots[index].x,
    y: slots[index].y,
    width: ENTITY_WIDTH,
    height: ENTITY_HEIGHT,
  }));
}

function resolveEntityCollisions(entities: EntityPlacement[]): EntityPlacement[] {
  const nextEntities = entities.map((entity) => ({ ...entity }));

  for (let pass = 0; pass < 14; pass += 1) {
    for (let leftIndex = 0; leftIndex < nextEntities.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < nextEntities.length; rightIndex += 1) {
        const left = nextEntities[leftIndex];
        const right = nextEntities[rightIndex];
        const overlapX =
          (left.width + right.width) / 2 + ENTITY_COLLISION_PADDING - Math.abs(left.x - right.x);
        const overlapY =
          (left.height + right.height) / 2 + ENTITY_COLLISION_PADDING - Math.abs(left.y - right.y);

        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }

        if (overlapX < overlapY) {
          const push = overlapX / 2;

          if (left.x <= right.x) {
            left.x -= push;
            right.x += push;
          } else {
            left.x += push;
            right.x -= push;
          }
        } else {
          const push = overlapY / 2;

          if (left.y <= right.y) {
            left.y -= push;
            right.y += push;
          } else {
            left.y += push;
            right.y -= push;
          }
        }
      }
    }
  }

  return nextEntities;
}

function runForceLayout(
  entities: EntityPlacement[],
  adjacencyWeights: Map<string, Map<string, number>>,
  degreesByEntityId: Map<string, number>,
  slotTargets: Map<string, LayoutPoint>,
): EntityPlacement[] {
  const positions = new Map(
    entities.map((entity) => [entity.id, { x: entity.x, y: entity.y }]),
  );
  const orderedEntities = [...entities];

  for (let iteration = 0; iteration < ENTITY_FORCE_ITERATIONS; iteration += 1) {
    const displacements = new Map(
      orderedEntities.map((entity) => [entity.id, { x: 0, y: 0 }]),
    );
    const temperature = 48 * (1 - iteration / ENTITY_FORCE_ITERATIONS) + 8;

    for (let leftIndex = 0; leftIndex < orderedEntities.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < orderedEntities.length; rightIndex += 1) {
        const leftId = orderedEntities[leftIndex].id;
        const rightId = orderedEntities[rightIndex].id;
        const left = positions.get(leftId);
        const right = positions.get(rightId);

        if (!left || !right) {
          continue;
        }

        let dx = right.x - left.x;
        let dy = right.y - left.y;
        let distance = Math.hypot(dx, dy);

        if (distance < 0.001) {
          dx = 1;
          dy = 0;
          distance = 1;
        }

        const force = ENTITY_REPULSION / (distance * distance);
        const unitX = dx / distance;
        const unitY = dy / distance;
        const leftDisplacement = displacements.get(leftId);
        const rightDisplacement = displacements.get(rightId);

        if (leftDisplacement && rightDisplacement) {
          leftDisplacement.x -= unitX * force;
          leftDisplacement.y -= unitY * force;
          rightDisplacement.x += unitX * force;
          rightDisplacement.y += unitY * force;
        }
      }
    }

    orderedEntities.forEach((entity) => {
      const source = positions.get(entity.id);
      const sourceDisplacement = displacements.get(entity.id);

      if (!source || !sourceDisplacement) {
        return;
      }

      for (const [targetId, weight] of adjacencyWeights.get(entity.id) ?? []) {
        if (targetId <= entity.id) {
          continue;
        }

        const target = positions.get(targetId);
        const targetDisplacement = displacements.get(targetId);

        if (!target || !targetDisplacement) {
          continue;
        }

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const idealDistance = ENTITY_SPACING - Math.min(72, (weight - 1) * 24);
        const force = (distance - idealDistance) * ENTITY_ATTRACTION * Math.max(1, weight);
        const unitX = dx / distance;
        const unitY = dy / distance;

        sourceDisplacement.x += unitX * force;
        sourceDisplacement.y += unitY * force;
        targetDisplacement.x -= unitX * force;
        targetDisplacement.y -= unitY * force;
      }
    });

    orderedEntities.forEach((entity) => {
      const position = positions.get(entity.id);
      const displacement = displacements.get(entity.id);
      const targetPosition = slotTargets.get(entity.id);

      if (!position || !displacement) {
        return;
      }

      if (targetPosition) {
        displacement.x += (targetPosition.x - position.x) * ENTITY_SLOT_ATTRACTION;
        displacement.y += (targetPosition.y - position.y) * ENTITY_SLOT_ATTRACTION;
      }

      displacement.x -= position.x * ENTITY_CENTER_GRAVITY;
      displacement.y -= position.y * ENTITY_CENTER_GRAVITY;

      const length = Math.hypot(displacement.x, displacement.y) || 1;
      const scale = Math.min(temperature, length) / length;
      position.x += displacement.x * scale;
      position.y += displacement.y * scale;
    });

    const nextPlacements = resolveEntityCollisions(
      orderedEntities.map((entity) => {
        const position = positions.get(entity.id);

        return {
          ...entity,
          x: position?.x ?? entity.x,
          y: position?.y ?? entity.y,
        };
      }),
    );

    nextPlacements.forEach((entity) => {
      positions.set(entity.id, { x: entity.x, y: entity.y });
    });
  }

  return resolveEntityCollisions(
    orderedEntities.map((entity) => {
      const position = positions.get(entity.id);

      return {
        ...entity,
        x: position?.x ?? entity.x,
        y: position?.y ?? entity.y,
      };
    }),
  );
}

function findBinaryRelationshipOffsetIndex(
  relationshipInfo: CoreRelationshipInfo,
  relationshipInfos: CoreRelationshipInfo[],
): { index: number; total: number } {
  const participantIds = [...relationshipInfo.participantEntityIds].sort();
  const siblings = relationshipInfos.filter((candidate) => {
    const candidateIds = [...candidate.participantEntityIds].sort();
    return candidateIds.length === 2 && candidateIds[0] === participantIds[0] && candidateIds[1] === participantIds[1];
  });

  return {
    index: siblings.findIndex((candidate) => candidate.model.id === relationshipInfo.model.id),
    total: siblings.length,
  };
}

function findTernaryRelationshipOffsetIndex(
  relationshipInfo: CoreRelationshipInfo,
  relationshipInfos: CoreRelationshipInfo[],
): { index: number; total: number } {
  const participantIds = [...relationshipInfo.participantEntityIds].sort().join("|");
  const siblings = relationshipInfos.filter((candidate) => {
    return candidate.participantEntityIds.length === 3 && [...candidate.participantEntityIds].sort().join("|") === participantIds;
  });

  return {
    index: siblings.findIndex((candidate) => candidate.model.id === relationshipInfo.model.id),
    total: siblings.length,
  };
}

function chooseSelfRelationshipAngle(
  entity: EntityPlacement,
  entities: EntityPlacement[],
  relationships: PositionedRelationship[],
): number {
  const candidates = [-Math.PI / 2, -Math.PI / 3, (-2 * Math.PI) / 3];

  return candidates
    .map((angle) => {
      const point = polarPoint(entity.x, entity.y, SELF_RELATIONSHIP_DISTANCE, angle);
      const clearance = Math.min(
        ...[
          ...entities.filter((candidate) => candidate.id !== entity.id).map((candidate) =>
            Math.hypot(candidate.x - point.x, candidate.y - point.y),
          ),
          ...relationships.map((relationship) =>
            Math.hypot(relationship.x - point.x, relationship.y - point.y),
          ),
          Infinity,
        ],
      );

      return { angle, clearance };
    })
    .sort((left, right) => right.clearance - left.clearance)[0].angle;
}

function nudgeRelationshipPoint(
  x: number,
  y: number,
  entities: EntityPlacement[],
  relationships: PositionedRelationship[],
  relationshipId: string,
): LayoutPoint {
  const candidateOffsets = [
    { x: 0, y: 0 },
    { x: CLUSTER_PADDING, y: 0 },
    { x: -CLUSTER_PADDING, y: 0 },
    { x: 0, y: CLUSTER_PADDING },
    { x: 0, y: -CLUSTER_PADDING },
    { x: CLUSTER_PADDING + 18, y: CLUSTER_PADDING * 0.7 },
    { x: -(CLUSTER_PADDING + 18), y: CLUSTER_PADDING * 0.7 },
    { x: CLUSTER_PADDING + 18, y: -(CLUSTER_PADDING * 0.7) },
    { x: -(CLUSTER_PADDING + 18), y: -(CLUSTER_PADDING * 0.7) },
    { x: CLUSTER_PADDING * 1.75, y: 0 },
    { x: -(CLUSTER_PADDING * 1.75), y: 0 },
  ];

  for (const offset of candidateOffsets) {
    const nextRect = expandRect(
      {
        minX: x + offset.x - RELATIONSHIP_WIDTH / 2,
        minY: y + offset.y - RELATIONSHIP_HEIGHT / 2,
        maxX: x + offset.x + RELATIONSHIP_WIDTH / 2,
        maxY: y + offset.y + RELATIONSHIP_HEIGHT / 2,
      },
      RELATIONSHIP_COLLISION_PADDING,
    );
    const collidesWithEntity = entities.some((entity) =>
      rectsOverlap(
        nextRect,
        expandRect(
          {
            minX: entity.x - entity.width / 2,
            minY: entity.y - entity.height / 2,
            maxX: entity.x + entity.width / 2,
            maxY: entity.y + entity.height / 2,
          },
          18,
        ),
      ),
    );
    const collidesWithRelationship = relationships
      .filter((relationship) => relationship.id !== relationshipId)
      .some((relationship) =>
        rectsOverlap(
          nextRect,
          expandRect(
            {
              minX: relationship.x - relationship.width / 2,
              minY: relationship.y - relationship.height / 2,
              maxX: relationship.x + relationship.width / 2,
              maxY: relationship.y + relationship.height / 2,
            },
            10,
          ),
        ),
      );

    if (!collidesWithEntity && !collidesWithRelationship) {
      return {
        x: x + offset.x,
        y: y + offset.y,
      };
    }
  }

  return { x, y };
}

function chooseBestRelationshipPoint(
  basePoint: LayoutPoint,
  participantEntities: EntityPlacement[],
  entities: EntityPlacement[],
  relationships: PositionedRelationship[],
  relationshipId: string,
): LayoutPoint {
  const candidateOffsets = [
    { x: 0, y: 0 },
    { x: RELATIONSHIP_NUDGE_DISTANCE, y: 0 },
    { x: -RELATIONSHIP_NUDGE_DISTANCE, y: 0 },
    { x: 0, y: RELATIONSHIP_NUDGE_DISTANCE },
    { x: 0, y: -RELATIONSHIP_NUDGE_DISTANCE },
    { x: RELATIONSHIP_NUDGE_DISTANCE * 0.75, y: RELATIONSHIP_NUDGE_DISTANCE * 0.6 },
    { x: -RELATIONSHIP_NUDGE_DISTANCE * 0.75, y: RELATIONSHIP_NUDGE_DISTANCE * 0.6 },
    { x: RELATIONSHIP_NUDGE_DISTANCE * 0.75, y: -RELATIONSHIP_NUDGE_DISTANCE * 0.6 },
    { x: -RELATIONSHIP_NUDGE_DISTANCE * 0.75, y: -RELATIONSHIP_NUDGE_DISTANCE * 0.6 },
  ];

  return candidateOffsets
    .map((offset) => {
      const candidate = {
        x: basePoint.x + offset.x,
        y: basePoint.y + offset.y,
      };
      const candidateRect = expandRect(
        {
          minX: candidate.x - RELATIONSHIP_WIDTH / 2,
          minY: candidate.y - RELATIONSHIP_HEIGHT / 2,
          maxX: candidate.x + RELATIONSHIP_WIDTH / 2,
          maxY: candidate.y + RELATIONSHIP_HEIGHT / 2,
        },
        RELATIONSHIP_COLLISION_PADDING,
      );
      const overlapPenalty =
        entities.reduce((total, entity) => {
          const entityRect = expandRect(getEntityBounds(entity), RELATIONSHIP_PADDING / 2);
          return total + (rectsOverlap(candidateRect, entityRect) ? 1000 : 0);
        }, 0) +
        relationships.reduce((total, relationship) => {
          if (relationship.id === relationshipId) {
            return total;
          }

          const relationshipRect = expandRect(getRelationshipBounds(relationship), MIN_NODE_GAP / 2);
          return total + (rectsOverlap(candidateRect, relationshipRect) ? 800 : 0);
        }, 0);
      const participantDistance = sum(
        participantEntities.map((entity) => Math.hypot(candidate.x - entity.x, candidate.y - entity.y)),
      );
      const nearestOtherEntity = Math.min(
        ...entities
          .filter((entity) => !participantEntities.some((participant) => participant.id === entity.id))
          .map((entity) => Math.hypot(candidate.x - entity.x, candidate.y - entity.y)),
        Infinity,
      );
      const nearestRelationship = Math.min(
        ...relationships
          .filter((relationship) => relationship.id !== relationshipId)
          .map((relationship) => Math.hypot(candidate.x - relationship.x, candidate.y - relationship.y)),
        Infinity,
      );
      const score =
        nearestOtherEntity * 0.45 +
        nearestRelationship * 0.25 -
        participantDistance * 0.18 -
        Math.hypot(offset.x, offset.y) * 0.4 -
        overlapPenalty;

      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score)[0].candidate;
}

function refineRelationshipPositions(
  relationships: PositionedRelationship[],
  entities: EntityPlacement[],
): PositionedRelationship[] {
  const entityBounds = entities.map((entity) => expandRect(getEntityBounds(entity), RELATIONSHIP_PADDING / 2));
  const nextRelationships = relationships.map((relationship) => ({ ...relationship }));

  for (let pass = 0; pass < 10; pass += 1) {
    nextRelationships.forEach((relationship, relationshipIndex) => {
      const currentBounds = expandRect(getRelationshipBounds(relationship), MIN_NODE_GAP);
      let pushX = 0;
      let pushY = 0;

      entityBounds.forEach((entityBoundsRect, entityIndex) => {
        if (!rectsOverlap(currentBounds, entityBoundsRect)) {
          return;
        }

        const entity = entities[entityIndex];
        const dx = relationship.x - entity.x || 1;
        const dy = relationship.y - entity.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        const overlapX = Math.min(currentBounds.maxX, entityBoundsRect.maxX) - Math.max(currentBounds.minX, entityBoundsRect.minX);
        const overlapY = Math.min(currentBounds.maxY, entityBoundsRect.maxY) - Math.max(currentBounds.minY, entityBoundsRect.minY);
        const push = Math.max(6, Math.min(RELATIONSHIP_NUDGE_DISTANCE, Math.max(overlapX, overlapY)));
        pushX += (dx / distance) * push;
        pushY += (dy / distance) * push;
      });

      nextRelationships.forEach((otherRelationship, otherIndex) => {
        if (relationshipIndex === otherIndex) {
          return;
        }

        const otherBounds = expandRect(getRelationshipBounds(otherRelationship), MIN_NODE_GAP * 0.8);

        if (!rectsOverlap(currentBounds, otherBounds)) {
          return;
        }

        const dx = relationship.x - otherRelationship.x || (relationshipIndex < otherIndex ? -1 : 1);
        const dy = relationship.y - otherRelationship.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        const overlapX = Math.min(currentBounds.maxX, otherBounds.maxX) - Math.max(currentBounds.minX, otherBounds.minX);
        const overlapY = Math.min(currentBounds.maxY, otherBounds.maxY) - Math.max(currentBounds.minY, otherBounds.minY);
        const push = Math.max(4, Math.min(RELATIONSHIP_NUDGE_DISTANCE, Math.max(overlapX, overlapY) * 0.5));
        pushX += (dx / distance) * push;
        pushY += (dy / distance) * push;
      });

      relationship.x += Math.max(-RELATIONSHIP_NUDGE_DISTANCE, Math.min(RELATIONSHIP_NUDGE_DISTANCE, pushX));
      relationship.y += Math.max(-RELATIONSHIP_NUDGE_DISTANCE, Math.min(RELATIONSHIP_NUDGE_DISTANCE, pushY));
    });
  }

  return nextRelationships;
}

function resolveRoleLabelPosition(
  label: string,
  basePoint: LayoutPoint,
  nodeObstacles: LayoutRect[],
  labelObstacles: LayoutRect[],
): LayoutPoint {
  const candidateOffsets = [
    { x: 0, y: -12 },
    { x: 0, y: 14 },
    { x: 18, y: -10 },
    { x: -18, y: -10 },
    { x: 22, y: 12 },
    { x: -22, y: 12 },
    { x: 28, y: 0 },
    { x: -28, y: 0 },
  ];

  for (const offset of candidateOffsets) {
    const candidate = {
      x: basePoint.x + offset.x,
      y: basePoint.y + offset.y,
    };
    const bounds = getRoleLabelBounds(label, candidate.x, candidate.y);
    const collidesWithNodes = nodeObstacles.some((obstacle) => rectsOverlap(bounds, obstacle));
    const collidesWithLabels = labelObstacles.some((obstacle) => rectsOverlap(bounds, obstacle));

    if (!collidesWithNodes && !collidesWithLabels) {
      return candidate;
    }
  }

  return basePoint;
}

function placeRelationships(
  relationshipInfos: CoreRelationshipInfo[],
  entities: EntityPlacement[],
): PositionedRelationship[] {
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const positionedRelationships: PositionedRelationship[] = [];

  relationshipInfos.forEach((relationshipInfo) => {
    const participants = relationshipInfo.model.participants.map((participant, index) => ({
      entityId: relationshipInfo.participantEntityIds[index] ?? participant.entity,
      entityName: participant.entity,
      endConstraint: participant.endConstraint,
      roleLabel: participant.roleLabel,
    }));
    const participantEntities = relationshipInfo.participantEntityIds
      .map((entityId) => entityById.get(entityId))
      .filter((entity): entity is EntityPlacement => entity !== undefined);
    let position: LayoutPoint = { x: 0, y: 0 };

    if (relationshipInfo.model.isSelfRelationship && participantEntities[0]) {
      const selfAngle = chooseSelfRelationshipAngle(
        participantEntities[0],
        entities,
        positionedRelationships,
      );
      position = polarPoint(
        participantEntities[0].x,
        participantEntities[0].y,
        SELF_RELATIONSHIP_DISTANCE,
        selfAngle,
      );
    } else if (participantEntities.length === 2) {
      const left = participantEntities[0];
      const right = participantEntities[1];
      const midpoint = {
        x: (left.x + right.x) / 2,
        y: (left.y + right.y) / 2,
      };
      const angle = angleBetween(left, right) + Math.PI / 2;
      const { index, total } = findBinaryRelationshipOffsetIndex(relationshipInfo, relationshipInfos);
      const offset =
        total > 1
          ? getBalancedOffset(index, RELATIONSHIP_PAIR_OFFSET)
          : (index % 2 === 0 ? 1 : -1) * RELATIONSHIP_OFFSET;
      const offsetPoint = polarPoint(
        midpoint.x,
        midpoint.y,
        Math.abs(offset),
        angle + (offset >= 0 ? 0 : Math.PI),
      );
      position = offsetPoint;
    } else {
      const centroid = {
        x: sum(participantEntities.map((entity) => entity.x)) / Math.max(1, participantEntities.length),
        y: sum(participantEntities.map((entity) => entity.y)) / Math.max(1, participantEntities.length),
      };
      const { index, total } = findTernaryRelationshipOffsetIndex(relationshipInfo, relationshipInfos);
      const offset =
        total > 1
          ? getBalancedOffset(index, RELATIONSHIP_TRIPLE_OFFSET)
          : RELATIONSHIP_OFFSET * 0.65;
      const openDirections = [
        -Math.PI / 2,
        0,
        Math.PI / 2,
        Math.PI,
        -Math.PI / 4,
        Math.PI / 4,
      ];
      const openDirection = openDirections
        .map((candidateAngle) => {
          const probe = polarPoint(centroid.x, centroid.y, TERNARY_CLUSTER_RADIUS * 0.55, candidateAngle);
          const clearance = Math.min(
            ...[
              ...entities.map((entity) => Math.hypot(entity.x - probe.x, entity.y - probe.y)),
              ...positionedRelationships.map((relationship) =>
                Math.hypot(relationship.x - probe.x, relationship.y - probe.y),
              ),
              Infinity,
            ],
          );

          return { candidateAngle, clearance };
        })
        .sort((left, right) => right.clearance - left.clearance)[0].candidateAngle;
      position = {
        x: centroid.x + Math.cos(openDirection) * offset,
        y: centroid.y + Math.sin(openDirection) * offset,
      };
    }

    const bestLocalPosition = chooseBestRelationshipPoint(
      position,
      participantEntities,
      entities,
      positionedRelationships,
      relationshipInfo.model.id,
    );
    const nudgedPosition = nudgeRelationshipPoint(
      bestLocalPosition.x,
      bestLocalPosition.y,
      entities,
      positionedRelationships,
      relationshipInfo.model.id,
    );

    positionedRelationships.push({
      id: relationshipInfo.model.id,
      name: relationshipInfo.model.name,
      kind: relationshipInfo.model.kind,
      isSelfRelationship: relationshipInfo.model.isSelfRelationship,
      x: nudgedPosition.x,
      y: nudgedPosition.y,
      width: RELATIONSHIP_WIDTH,
      height: RELATIONSHIP_HEIGHT,
      participants,
      legacyCardinality: relationshipInfo.model.legacyCardinality,
    });
  });

  return positionedRelationships;
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

function createCurvedEdge(
  start: LayoutPoint,
  end: LayoutPoint,
  bendAmount: number,
  obstacleRects: LayoutRect[] = [],
): LayoutPoint[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const straightBlocked = !isStraightSegmentClear(start, end, obstacleRects);

  if (!straightBlocked) {
    return [start, end];
  }

  const normalX = -dy / length;
  const normalY = dx / length;
  const maxBend = Math.min(MAX_EDGE_CURVE, length * EDGE_CURVE_STRENGTH + EDGE_CURVE_OFFSET * 0.25);
  const preferredBend = Math.max(-maxBend, Math.min(maxBend, bendAmount));
  const fallbackBends = [
    preferredBend,
    -preferredBend,
    preferredBend * 0.35,
    -preferredBend * 0.35,
    0,
  ];

  for (const nextBend of fallbackBends) {
    const control1 = {
      x: start.x + dx * 0.28 + normalX * nextBend,
      y: start.y + dy * 0.28 + normalY * nextBend,
    };
    const control2 = {
      x: start.x + dx * 0.72 + normalX * nextBend,
      y: start.y + dy * 0.72 + normalY * nextBend,
    };
    const midpoint = {
      x: (control1.x + control2.x) / 2,
      y: (control1.y + control2.y) / 2,
    };
    const intersectsObstacle = obstacleRects.some((rect) =>
      pointInRect(control1, rect) || pointInRect(control2, rect) || pointInRect(midpoint, rect),
    );

    if (!intersectsObstacle) {
      return [start, control1, control2, end];
    }
  }

  return [start, end];
}

function connectOwnerToAttribute(
  ownerShape: CoreShape,
  attribute: PositionedAttribute,
  bendAmount: number,
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
    points: createCurvedEdge(start, end, bendAmount),
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
    points: createCurvedEdge(start, end, 10),
  };
}

function attributeCollides(
  attribute: Pick<PositionedAttribute, "x" | "y" | "rx" | "ry">,
  nodeObstacles: LayoutRect[],
  placedAttributes: PositionedAttribute[],
): boolean {
  const bounds = expandRect(
    getAttributeBounds(attribute),
    Math.max(ATTRIBUTE_COLLISION_PADDING, MIN_ATTRIBUTE_GAP),
  );

  if (nodeObstacles.some((obstacle) => rectsOverlap(bounds, obstacle))) {
    return true;
  }

  return placedAttributes.some((placedAttribute) =>
    rectsOverlap(
      bounds,
      expandRect(getAttributeBounds(placedAttribute), MIN_ATTRIBUTE_GAP / 2),
    ),
  );
}

function placeCandidateAttribute(
  attribute: AttributeModel,
  ownerShape: CoreShape,
  ownerKind: AttributeOwnerKind,
  candidates: LayoutPoint[],
  placedAttributes: PositionedAttribute[],
  nodes: PositionedAttribute[],
  nodeObstacles: LayoutRect[],
  level: number,
): PositionedAttribute {
  for (const candidate of candidates) {
    const node = createAttributeNode(
      attribute,
      ownerShape.id,
      ownerKind,
      candidate.x,
      candidate.y,
      level,
    );

    if (!attributeCollides(node, nodeObstacles, [...placedAttributes, ...nodes])) {
      return node;
    }
  }

  const fallback = candidates[candidates.length - 1] ?? { x: ownerShape.x, y: ownerShape.y };
  return createAttributeNode(
    attribute,
    ownerShape.id,
    ownerKind,
    fallback.x,
    fallback.y,
    level,
  );
}

function getSectorRadius(
  ownerShape: Pick<CoreShape, "width" | "height">,
  slotIndex: number,
  attempt = 0,
): number {
  return (
    Math.max(ownerShape.width / 2, ownerShape.height / 2) +
    ATTRIBUTE_RX +
    ATTRIBUTE_CLUSTER_BASE_GAP +
    slotIndex * ATTRIBUTE_INDEX_RADIUS_STEP +
    attempt * 10
  );
}

function getRightSectorCandidates(
  ownerShape: CoreShape,
  slotIndex: number,
  slotCount: number,
): LayoutPoint[] {
  const candidates: LayoutPoint[] = [];
  const localIndex = slotCount <= 1 ? 0 : slotIndex % ATTRIBUTE_COLUMN_CAPACITY;
  const columnIndex = Math.floor(slotIndex / ATTRIBUTE_COLUMN_CAPACITY);
  const visibleCount = Math.min(slotCount, ATTRIBUTE_COLUMN_CAPACITY);
  const normalizedIndex =
    visibleCount <= 1 ? 0.5 : localIndex / Math.max(1, visibleCount - 1);
  const baseAngle = -ATTRIBUTE_SECTOR_SPAN / 2 + normalizedIndex * ATTRIBUTE_SECTOR_SPAN;
  const angleVariants = [0, 0.08, -0.08, 0.15, -0.15];

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const radius =
      getSectorRadius(ownerShape, slotIndex, attempt) + columnIndex * ATTRIBUTE_COLUMN_X_STEP;
    const overflowDown = columnIndex * ATTRIBUTE_OVERFLOW_Y_STEP + attempt * 6;

    angleVariants.forEach((angleOffset) => {
      const angle = clampAngle(
        baseAngle + angleOffset,
        -ATTRIBUTE_SECTOR_SPAN / 2,
        ATTRIBUTE_SECTOR_SPAN / 2,
      );
      candidates.push({
        x: ownerShape.x + Math.cos(angle) * radius,
        y: ownerShape.y + Math.sin(angle) * radius + overflowDown,
      });
    });
  }

  return candidates;
}

function getTopArcCandidates(
  ownerShape: CoreShape,
  slotIndex: number,
  slotCount: number,
): LayoutPoint[] {
  const candidates: LayoutPoint[] = [];
  const spread = slotCount > 1 ? (slotIndex / (slotCount - 1) - 0.5) * 0.72 : 0;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const radius = ATTRIBUTE_RADIUS - 10 + attempt * MIN_ATTRIBUTE_GAP;
    const angle = -Math.PI / 2 + spread;
    candidates.push({
      x: ownerShape.x + Math.cos(angle) * radius,
      y: ownerShape.y + Math.sin(angle) * radius,
    });
  }

  return candidates;
}

function getCompositeRootCandidates(
  ownerShape: CoreShape,
  slotIndex: number,
  slotCount: number,
): LayoutPoint[] {
  return getRightSectorCandidates(ownerShape, slotIndex, slotCount).map((candidate, index) => ({
    x: candidate.x + (index % 2 === 0 ? 8 : 0),
    y: candidate.y + 12,
  }));
}

function resolveOwnerAttributeCluster(
  ownerShape: CoreShape,
  clusterNodes: PositionedAttribute[],
  placedAttributes: PositionedAttribute[],
  nodeObstacles: LayoutRect[],
): PositionedAttribute[] {
  if (clusterNodes.length <= 1) {
    return clusterNodes;
  }

  const nextNodes = clusterNodes.map((node) => ({ ...node }));
  const sortedNodes = [...nextNodes].sort((left, right) => left.y - right.y || left.x - right.x);
  const minClusterX = ownerShape.x + ownerShape.width / 2 + ATTRIBUTE_CLUSTER_BASE_GAP + ATTRIBUTE_RX * 0.6;

  for (let pass = 0; pass < 4; pass += 1) {
    sortedNodes.forEach((node, index) => {
      node.x = Math.max(node.x, minClusterX + Math.floor(index / ATTRIBUTE_COLUMN_CAPACITY) * ATTRIBUTE_COLUMN_X_STEP);

      if (index === 0) {
        return;
      }

      const previous = sortedNodes[index - 1];
      const minimumY =
        previous.y +
        Math.max(
          ATTRIBUTE_VERTICAL_MIN_SPACING,
          previous.ry + node.ry + MIN_ATTRIBUTE_GAP * 0.5,
        );

      if (node.y < minimumY) {
        node.y = minimumY;
      }

      let collisionAttempts = 0;

      while (
        attributeCollides(node, nodeObstacles, [
          ...placedAttributes,
          ...sortedNodes.filter((candidate) => candidate.id !== node.id),
        ]) &&
        collisionAttempts < 6
      ) {
        node.x += 10;
        node.y += ATTRIBUTE_VERTICAL_MIN_SPACING * 0.35;
        collisionAttempts += 1;
      }
    });
  }

  return nextNodes;
}

function placeRootAttributes(
  ownerShape: CoreShape,
  ownerKind: AttributeOwnerKind,
  attributes: AttributeModel[],
  neighborPoints: LayoutPoint[],
  placedAttributes: PositionedAttribute[],
  nodeObstacles: LayoutRect[],
): { nodes: PositionedAttribute[]; edges: LayoutEdge[] } {
  const nodes: PositionedAttribute[] = [];
  const edges: LayoutEdge[] = [];
  const compositeRootModels: AttributeModel[] = [];

  if (attributes.length === 0) {
    return { nodes, edges };
  }

  const { keyAttributes, regularAttributes, compositeAttributes } = classifyRootAttributes(attributes);
  void neighborPoints;
  const rightClusterCount = regularAttributes.length + compositeAttributes.length;
  const rightClusterNodes: PositionedAttribute[] = [];

  const placeRegularAttribute = (attribute: AttributeModel, index: number) => {
    const node = placeCandidateAttribute(
      attribute,
      ownerShape,
      ownerKind,
      getRightSectorCandidates(ownerShape, index, rightClusterCount),
      placedAttributes,
      [...nodes, ...rightClusterNodes],
      nodeObstacles,
      0,
    );
    rightClusterNodes.push(node);
  };

  keyAttributes.forEach((attribute, index) => {
    const node = placeCandidateAttribute(
      attribute,
      ownerShape,
      ownerKind,
      getTopArcCandidates(ownerShape, index, keyAttributes.length),
      placedAttributes,
      nodes,
      nodeObstacles,
      0,
    );
    nodes.push(node);
    edges.push(connectOwnerToAttribute(ownerShape, node, 0));
  });

  regularAttributes.forEach((attribute, index) => {
    placeRegularAttribute(attribute, index);
  });

  compositeAttributes.forEach((attribute, index) => {
    const clusterIndex = regularAttributes.length + index;
    const node = placeCandidateAttribute(
      attribute,
      ownerShape,
      ownerKind,
      getCompositeRootCandidates(ownerShape, clusterIndex, rightClusterCount),
      placedAttributes,
      [...nodes, ...rightClusterNodes],
      nodeObstacles,
      0,
    );
    rightClusterNodes.push(node);
    compositeRootModels.push(attribute);
  });

  const resolvedRightClusterNodes = resolveOwnerAttributeCluster(
    ownerShape,
    rightClusterNodes,
    placedAttributes,
    nodeObstacles,
  );
  const resolvedNodeById = new Map(
    resolvedRightClusterNodes.map((node) => [node.id, node]),
  );
  resolvedRightClusterNodes.forEach((node) => nodes.push(node));
  resolvedRightClusterNodes.forEach((node) => {
    edges.push(
      connectOwnerToAttribute(
        ownerShape,
        node,
        Math.sign(node.y - ownerShape.y || 1) * ATTRIBUTE_OWNER_CURVE_BEND * 0.35,
      ),
    );
  });

  compositeRootModels.forEach((attribute) => {
    const rootNode = resolvedNodeById.get(attribute.id);

    if (!rootNode || attribute.children.length === 0) {
      return;
    }

    const childNodes = placeCompositeChildren(
      rootNode,
      attribute,
      { x: ownerShape.x, y: ownerShape.y },
      [...placedAttributes, ...nodes],
      nodeObstacles,
    );
    childNodes.nodes.forEach((childNode) => nodes.push(childNode));
    childNodes.edges.forEach((edge) => edges.push(edge));
  });

  return { nodes, edges };
}

function placeCompositeChildren(
  rootNode: PositionedAttribute,
  attribute: AttributeModel,
  ownerPoint: LayoutPoint,
  placedAttributes: PositionedAttribute[],
  nodeObstacles: LayoutRect[],
): { nodes: PositionedAttribute[]; edges: LayoutEdge[] } {
  const nodes: PositionedAttribute[] = [];
  const edges: LayoutEdge[] = [];
  const outwardAngle = angleBetween(ownerPoint, { x: rootNode.x, y: rootNode.y });
  const childCount = attribute.children.length;

  attribute.children.forEach((child, index) => {
    const spread =
      childCount > 1 ? (index / (childCount - 1) - 0.5) * Math.min(COMPOSITE_FAN_SPREAD, 0.9) : 0;
    let angle = outwardAngle + spread;
    let radius = COMPOSITE_CHILD_RADIUS;
    let node = createAttributeNode(
      child,
      rootNode.ownerId,
      rootNode.ownerKind,
      rootNode.x + Math.cos(angle) * radius,
      rootNode.y + Math.sin(angle) * radius + COMPOSITE_LEVEL_Y_STEP * 0.15,
      rootNode.level + 1,
    );
    node.parentAttributeId = rootNode.id;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (!attributeCollides(node, nodeObstacles, [...placedAttributes, ...nodes])) {
        break;
      }

      angle += index % 2 === 0 ? 0.16 : -0.16;
      radius += 14;
      node = createAttributeNode(
        child,
        rootNode.ownerId,
        rootNode.ownerKind,
        rootNode.x + Math.cos(angle) * radius,
        rootNode.y + Math.sin(angle) * radius + COMPOSITE_LEVEL_Y_STEP * 0.15,
        rootNode.level + 1,
      );
      node.parentAttributeId = rootNode.id;
    }

    nodes.push(node);
    edges.push(connectAttributeToAttribute(rootNode, node));

    if (child.children.length > 0) {
      const descendants = placeCompositeChildren(
        node,
        child,
        { x: rootNode.x, y: rootNode.y },
        [...placedAttributes, ...nodes],
        nodeObstacles,
      );
      descendants.nodes.forEach((descendant) => nodes.push(descendant));
      descendants.edges.forEach((edge) => edges.push(edge));
    }
  });

  return { nodes, edges };
}

function resolveGlobalCollisions(
  entities: EntityPlacement[],
  relationships: PositionedRelationship[],
  attributes: PositionedAttribute[],
  edges: LayoutEdge[],
): {
  relationships: PositionedRelationship[];
  attributes: PositionedAttribute[];
} {
  const nextRelationships = relationships.map((relationship) => ({ ...relationship }));
  const nextAttributes = attributes.map((attribute) => ({ ...attribute }));
  const fixedEntityRects = entities.map((entity) => expandRect(getEntityBounds(entity), MIN_NODE_DISTANCE));

  for (let pass = 0; pass < 18; pass += 1) {
    const relationshipRects = nextRelationships.map((relationship) =>
      expandRect(getRelationshipBounds(relationship), MIN_NODE_GAP),
    );
    const attributeRects = nextAttributes.map((attribute) =>
      expandRect(getAttributeBounds(attribute), MIN_ATTRIBUTE_GAP),
    );
    const labelRects = edges
      .filter((edge) => edge.label && edge.labelX !== undefined && edge.labelY !== undefined)
      .map((edge) => getRoleLabelBounds(edge.label!, edge.labelX!, edge.labelY!));

    nextRelationships.forEach((relationship, relationshipIndex) => {
      let pushX = 0;
      let pushY = 0;
      const currentRect = relationshipRects[relationshipIndex];

      fixedEntityRects.forEach((entityRect, entityIndex) => {
        if (!rectsOverlap(currentRect, entityRect)) {
          return;
        }

        const entity = entities[entityIndex];
        const dx = relationship.x - entity.x || 1;
        const dy = relationship.y - entity.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        pushX += (dx / distance) * RELATIONSHIP_NUDGE_DISTANCE;
        pushY += (dy / distance) * RELATIONSHIP_NUDGE_DISTANCE;
      });

      relationshipRects.forEach((otherRect, otherIndex) => {
        if (relationshipIndex === otherIndex || !rectsOverlap(currentRect, otherRect)) {
          return;
        }

        const otherRelationship = nextRelationships[otherIndex];
        const dx = relationship.x - otherRelationship.x || (relationshipIndex < otherIndex ? -1 : 1);
        const dy = relationship.y - otherRelationship.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        pushX += (dx / distance) * (RELATIONSHIP_NUDGE_DISTANCE * 0.7);
        pushY += (dy / distance) * (RELATIONSHIP_NUDGE_DISTANCE * 0.7);
      });

      attributeRects.forEach((attributeRect, attributeIndex) => {
        if (!rectsOverlap(currentRect, attributeRect)) {
          return;
        }

        const attribute = nextAttributes[attributeIndex];
        const dx = relationship.x - attribute.x || 1;
        const dy = relationship.y - attribute.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        pushX += (dx / distance) * (RELATIONSHIP_NUDGE_DISTANCE * 0.55);
        pushY += (dy / distance) * (RELATIONSHIP_NUDGE_DISTANCE * 0.55);
      });

      labelRects.forEach((labelRect) => {
        if (!rectsOverlap(currentRect, labelRect)) {
          return;
        }

        const labelCenter = {
          x: (labelRect.minX + labelRect.maxX) / 2,
          y: (labelRect.minY + labelRect.maxY) / 2,
        };
        const dx = relationship.x - labelCenter.x || 1;
        const dy = relationship.y - labelCenter.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        pushX += (dx / distance) * 8;
        pushY += (dy / distance) * 8;
      });

      relationship.x += Math.max(-RELATIONSHIP_NUDGE_DISTANCE, Math.min(RELATIONSHIP_NUDGE_DISTANCE, pushX));
      relationship.y += Math.max(-RELATIONSHIP_NUDGE_DISTANCE, Math.min(RELATIONSHIP_NUDGE_DISTANCE, pushY));
    });

    nextAttributes.forEach((attribute, attributeIndex) => {
      let pushX = 0;
      let pushY = 0;
      const currentRect = attributeRects[attributeIndex];
      const parentAttribute = attribute.parentAttributeId
        ? nextAttributes.find((candidate) => candidate.id === attribute.parentAttributeId)
        : null;
      const ownerPoint = parentAttribute
        ? { x: parentAttribute.x, y: parentAttribute.y }
        : attribute.ownerKind === "entity"
          ? entities.find((entity) => entity.id === attribute.ownerId)
          : nextRelationships.find((relationship) => relationship.id === attribute.ownerId);

      fixedEntityRects.forEach((entityRect, entityIndex) => {
        const entity = entities[entityIndex];

        if (entity.id === attribute.ownerId || !rectsOverlap(currentRect, entityRect)) {
          return;
        }

        const dx = attribute.x - entity.x || 1;
        const dy = attribute.y - entity.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        pushX += (dx / distance) * MIN_ATTRIBUTE_GAP;
        pushY += (dy / distance) * MIN_ATTRIBUTE_GAP;
      });

      relationshipRects.forEach((relationshipRect, relationshipIndex) => {
        const relationship = nextRelationships[relationshipIndex];

        if (relationship.id === attribute.ownerId || !rectsOverlap(currentRect, relationshipRect)) {
          return;
        }

        const dx = attribute.x - relationship.x || 1;
        const dy = attribute.y - relationship.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        pushX += (dx / distance) * MIN_ATTRIBUTE_GAP;
        pushY += (dy / distance) * MIN_ATTRIBUTE_GAP;
      });

      attributeRects.forEach((otherRect, otherIndex) => {
        if (attributeIndex === otherIndex || !rectsOverlap(currentRect, otherRect)) {
          return;
        }

        const otherAttribute = nextAttributes[otherIndex];
        const dx = attribute.x - otherAttribute.x || (attributeIndex < otherIndex ? -1 : 1);
        const dy = attribute.y - otherAttribute.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        pushX += (dx / distance) * (MIN_ATTRIBUTE_GAP * 0.8);
        pushY += (dy / distance) * (MIN_ATTRIBUTE_GAP * 0.8);
      });

      labelRects.forEach((labelRect) => {
        if (!rectsOverlap(currentRect, labelRect)) {
          return;
        }

        const labelCenter = {
          x: (labelRect.minX + labelRect.maxX) / 2,
          y: (labelRect.minY + labelRect.maxY) / 2,
        };
        const dx = attribute.x - labelCenter.x || 1;
        const dy = attribute.y - labelCenter.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        pushX += (dx / distance) * (MIN_ATTRIBUTE_GAP * 0.8);
        pushY += (dy / distance) * (MIN_ATTRIBUTE_GAP * 0.8);
      });

    if (ownerPoint) {
        const preferredRadius = attribute.parentAttributeId
          ? COMPOSITE_CHILD_RADIUS
          : getSectorRadius(
              attribute.ownerKind === "entity"
                ? entities.find((entity) => entity.id === attribute.ownerId) ?? {
                    width: ENTITY_WIDTH,
                    height: ENTITY_HEIGHT,
                  }
                : {
                    width: RELATIONSHIP_WIDTH,
                    height: RELATIONSHIP_HEIGHT,
                  },
              0,
            );
        const dx = attribute.x + pushX - ownerPoint.x;
        const dy = attribute.y + pushY - ownerPoint.y;
        const nextAngle = Math.atan2(dy || 1, dx || 1);
        const constrainedAngle = attribute.parentAttributeId
          ? nextAngle
          : clampAngle(nextAngle, -ATTRIBUTE_SECTOR_SPAN / 2, ATTRIBUTE_SECTOR_SPAN / 2);
        const adjustedRadius = Math.max(preferredRadius, Math.hypot(dx, dy));
        attribute.x = ownerPoint.x + Math.cos(constrainedAngle) * adjustedRadius;
        attribute.y = ownerPoint.y + Math.sin(constrainedAngle) * adjustedRadius;

        if (!attribute.parentAttributeId && attribute.x < ownerPoint.x + ATTRIBUTE_RX) {
          attribute.x = ownerPoint.x + ATTRIBUTE_RX + ATTRIBUTE_CLUSTER_BASE_GAP * 0.35;
        }
      } else {
        attribute.x += pushX;
        attribute.y += pushY;
      }
    });
  }

  return {
    relationships: nextRelationships,
    attributes: nextAttributes,
  };
}

function rebuildAttributeEdges(
  attributes: PositionedAttribute[],
  shapesById: Map<string, CoreShape>,
): LayoutEdge[] {
  const attributeById = new Map(attributes.map((attribute) => [attribute.id, attribute]));

  return attributes.flatMap((attribute, index) => {
    if (attribute.parentAttributeId) {
      const parent = attributeById.get(attribute.parentAttributeId);

      return parent ? [connectAttributeToAttribute(parent, attribute)] : [];
    }

    const ownerShape = shapesById.get(attribute.ownerId);

    if (!ownerShape) {
      return [];
    }

    const bendAmount = Math.sign(attribute.y - ownerShape.y || 1) * EDGE_CURVE_OFFSET * 0.18;
    return [connectOwnerToAttribute(ownerShape, attribute, bendAmount)];
  });
}

function refineRelationshipsLocally(
  entities: EntityPlacement[],
  relationships: PositionedRelationship[],
  attributes: PositionedAttribute[],
): PositionedRelationship[] {
  const nextRelationships = relationships.map((relationship) => ({ ...relationship }));
  const entityRects = entities.map((entity) =>
    expandRect(getEntityBounds(entity), MIN_ENTITY_RELATION_DISTANCE / 2),
  );
  const attributeRects = attributes.map((attribute) =>
    expandRect(getAttributeBounds(attribute), MIN_NODE_CLEARANCE),
  );

  for (let pass = 0; pass < 3; pass += 1) {
    nextRelationships.forEach((relationship, relationshipIndex) => {
      let pushX = 0;
      let pushY = 0;
      const relationshipRect = expandRect(getRelationshipBounds(relationship), MIN_NODE_CLEARANCE);

      entityRects.forEach((entityRect, entityIndex) => {
        if (!rectsOverlap(relationshipRect, entityRect)) {
          return;
        }

        const entity = entities[entityIndex];
        const dx = relationship.x - entity.x || 1;
        const dy = relationship.y - entity.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        pushX += (dx / distance) * (LOCAL_NUDGE_STEP * 0.65);
        pushY += (dy / distance) * (LOCAL_NUDGE_STEP * 0.65);
      });

      attributeRects.forEach((attributeRect, attributeIndex) => {
        if (!rectsOverlap(relationshipRect, attributeRect)) {
          return;
        }

        const attribute = attributes[attributeIndex];
        const dx = relationship.x - attribute.x || 1;
        const dy = relationship.y - attribute.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        pushX += (dx / distance) * (LOCAL_NUDGE_STEP * 0.45);
        pushY += (dy / distance) * (LOCAL_NUDGE_STEP * 0.45);
      });

      nextRelationships.forEach((otherRelationship, otherIndex) => {
        if (relationshipIndex === otherIndex) {
          return;
        }

        const otherRect = expandRect(getRelationshipBounds(otherRelationship), MIN_NODE_CLEARANCE * 0.8);

        if (!rectsOverlap(relationshipRect, otherRect)) {
          return;
        }

        const dx = relationship.x - otherRelationship.x || (relationshipIndex < otherIndex ? -1 : 1);
        const dy = relationship.y - otherRelationship.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        pushX += (dx / distance) * (LOCAL_NUDGE_STEP * 0.4);
        pushY += (dy / distance) * (LOCAL_NUDGE_STEP * 0.4);
      });

      relationship.x += Math.max(-LOCAL_NUDGE_STEP, Math.min(LOCAL_NUDGE_STEP, pushX));
      relationship.y += Math.max(-LOCAL_NUDGE_STEP, Math.min(LOCAL_NUDGE_STEP, pushY));
    });
  }

  return nextRelationships;
}

function refineAttributeClustersLocally(
  entities: EntityPlacement[],
  relationships: PositionedRelationship[],
  attributes: PositionedAttribute[],
  primaryEdges: LayoutEdge[],
): PositionedAttribute[] {
  const nextAttributes = attributes.map((attribute) => ({ ...attribute }));
  const originalPositions = new Map(
    attributes.map((attribute) => [attribute.id, { x: attribute.x, y: attribute.y }]),
  );
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const relationshipById = new Map(relationships.map((relationship) => [relationship.id, relationship]));

  for (let pass = 0; pass < 3; pass += 1) {
    const relationshipRects = relationships.map((relationship) =>
      expandRect(getRelationshipBounds(relationship), MIN_NODE_CLEARANCE),
    );
    const labelRects = primaryEdges
      .filter((edge) => edge.label && edge.labelX !== undefined && edge.labelY !== undefined)
      .map((edge) => getRoleLabelBounds(edge.label!, edge.labelX!, edge.labelY!));

    nextAttributes.forEach((attribute, attributeIndex) => {
      let pushX = 0;
      let pushY = 0;
      const currentRect = expandRect(getAttributeBounds(attribute), MIN_NODE_CLEARANCE);
      const ownerShape = attribute.parentAttributeId
        ? nextAttributes.find((candidate) => candidate.id === attribute.parentAttributeId)
        : attribute.ownerKind === "entity"
          ? entityById.get(attribute.ownerId)
          : relationshipById.get(attribute.ownerId);

      if (!ownerShape) {
        return;
      }

      nextAttributes.forEach((otherAttribute, otherIndex) => {
        if (attributeIndex === otherIndex) {
          return;
        }

        const otherRect = expandRect(getAttributeBounds(otherAttribute), MIN_ATTRIBUTE_GAP);

        if (!rectsOverlap(currentRect, otherRect)) {
          return;
        }

        const dx = attribute.x - otherAttribute.x || (attributeIndex < otherIndex ? -1 : 1);
        const dy = attribute.y - otherAttribute.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        pushX += (dx / distance) * LOCAL_NUDGE_STEP;
        pushY += (dy / distance) * LOCAL_NUDGE_STEP;
      });

      entities.forEach((entity) => {
        if (entity.id === attribute.ownerId) {
          return;
        }

        const entityRect = expandRect(getEntityBounds(entity), MIN_NODE_CLEARANCE);

        if (!rectsOverlap(currentRect, entityRect)) {
          return;
        }

        const dx = attribute.x - entity.x || 1;
        const dy = attribute.y - entity.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        pushX += (dx / distance) * (LOCAL_NUDGE_STEP * 0.9);
        pushY += (dy / distance) * (LOCAL_NUDGE_STEP * 0.9);
      });

      relationshipRects.forEach((relationshipRect, relationshipIndex) => {
        const relationship = relationships[relationshipIndex];

        if (relationship.id === attribute.ownerId || !rectsOverlap(currentRect, relationshipRect)) {
          return;
        }

        const dx = attribute.x - relationship.x || 1;
        const dy = attribute.y - relationship.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        pushX += (dx / distance) * (LOCAL_NUDGE_STEP * 0.75);
        pushY += (dy / distance) * (LOCAL_NUDGE_STEP * 0.75);
      });

      labelRects.forEach((labelRect) => {
        if (!rectsOverlap(currentRect, labelRect)) {
          return;
        }

        const labelCenter = getRectCenter(labelRect);
        const dx = attribute.x - labelCenter.x || 1;
        const dy = attribute.y - labelCenter.y || 1;
        const distance = Math.hypot(dx, dy) || 1;
        pushX += (dx / distance) * (LOCAL_NUDGE_STEP * 0.8);
        pushY += (dy / distance) * (LOCAL_NUDGE_STEP * 0.8);
      });

      primaryEdges.forEach((edge) => {
        if (
          edge.id.includes(attribute.id) ||
          edge.id.startsWith(`${attribute.ownerId}-`) ||
          edge.id.endsWith(`-${attribute.ownerId}`)
        ) {
          return;
        }

        if (!edgeNearRect(edge, getAttributeBounds(attribute), MIN_EDGE_TO_ATTRIBUTE_CLEARANCE)) {
          return;
        }

        const closest = getClosestEdgeSample(edge, { x: attribute.x, y: attribute.y });
        const dx = attribute.x - closest.point.x || 1;
        const dy = attribute.y - closest.point.y || 1;
        const distance = Math.max(1, closest.distance);
        const push = Math.max(0, MIN_EDGE_TO_ATTRIBUTE_CLEARANCE - distance) + LOCAL_NUDGE_STEP * 0.5;
        pushX += (dx / distance) * push;
        pushY += (dy / distance) * push;
      });

      const ownerPoint = { x: ownerShape.x, y: ownerShape.y };
      const original = originalPositions.get(attribute.id) ?? ownerPoint;
      const targetX = attribute.x + Math.max(-LOCAL_NUDGE_STEP, Math.min(LOCAL_NUDGE_STEP, pushX));
      const targetY = attribute.y + Math.max(-LOCAL_NUDGE_STEP, Math.min(LOCAL_NUDGE_STEP, pushY));
      const dx = targetX - ownerPoint.x;
      const dy = targetY - ownerPoint.y;
      const nextAngle = Math.atan2(dy || 1, dx || 1);
      const constrainedAngle = attribute.parentAttributeId
        ? nextAngle
        : clampAngle(nextAngle, -ATTRIBUTE_SECTOR_SPAN / 2, ATTRIBUTE_SECTOR_SPAN / 2);
      const preferredRadius = attribute.parentAttributeId
        ? COMPOSITE_CHILD_RADIUS
        : getSectorRadius(
            "width" in ownerShape && "height" in ownerShape
              ? ownerShape
              : {
                  width: attribute.ownerKind === "entity" ? ENTITY_WIDTH : RELATIONSHIP_WIDTH,
                  height: attribute.ownerKind === "entity" ? ENTITY_HEIGHT : RELATIONSHIP_HEIGHT,
                },
            0,
          );
      const maxRadius = preferredRadius + MAX_LOCAL_NUDGE_DISTANCE;
      const nextRadius = Math.max(
        preferredRadius,
        Math.min(maxRadius, Math.hypot(dx, dy)),
      );

      attribute.x = ownerPoint.x + Math.cos(constrainedAngle) * nextRadius;
      attribute.y = ownerPoint.y + Math.sin(constrainedAngle) * nextRadius;

      if (!attribute.parentAttributeId) {
        attribute.x = Math.max(attribute.x, ownerPoint.x + ATTRIBUTE_RX + ATTRIBUTE_CLUSTER_BASE_GAP * 0.35);
      }

      const driftDistance = Math.hypot(attribute.x - original.x, attribute.y - original.y);

      if (driftDistance > MAX_LOCAL_NUDGE_DISTANCE) {
        const ratio = MAX_LOCAL_NUDGE_DISTANCE / driftDistance;
        attribute.x = original.x + (attribute.x - original.x) * ratio;
        attribute.y = original.y + (attribute.y - original.y) * ratio;
      }
    });

    const byOwner = new Map<string, PositionedAttribute[]>();

    nextAttributes.forEach((attribute) => {
      const ownerKey = attribute.parentAttributeId ?? attribute.ownerId;
      const list = byOwner.get(ownerKey) ?? [];
      list.push(attribute);
      byOwner.set(ownerKey, list);
    });

    byOwner.forEach((group) => {
      const sorted = [...group].sort((left, right) => left.y - right.y || left.x - right.x);

      for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        const minimumY =
          previous.y +
          Math.max(MIN_NODE_CLEARANCE * 1.2, ATTRIBUTE_VERTICAL_MIN_SPACING);

        if (current.y < minimumY) {
          current.y = minimumY;
        }
      }
    });
  }

  return nextAttributes;
}

function refineRoleLabelsLocally(
  edges: LayoutEdge[],
  entities: PositionedEntity[],
  relationships: PositionedRelationship[],
  attributes: PositionedAttribute[],
): LayoutEdge[] {
  const nextEdges = edges.map((edge) => ({ ...edge }));
  const nodeObstacles: LayoutRect[] = [
    ...entities.map((entity) => expandRect(getEntityBounds(entity), MIN_NODE_CLEARANCE)),
    ...relationships.map((relationship) => expandRect(getRelationshipBounds(relationship), MIN_NODE_CLEARANCE)),
    ...attributes.map((attribute) => expandRect(getAttributeBounds(attribute), MIN_NODE_CLEARANCE * 0.6)),
  ];
  const labelObstacles: LayoutRect[] = [];

  nextEdges.forEach((edge) => {
    if (!edge.label || edge.labelX === undefined || edge.labelY === undefined) {
      return;
    }

    const basePoint = {
      x: edge.labelX,
      y: edge.labelY + 12,
    };
    const resolvedPoint = resolveRoleLabelPosition(
      edge.label,
      basePoint,
      nodeObstacles,
      labelObstacles,
    );

    edge.labelX = resolvedPoint.x;
    edge.labelY = resolvedPoint.y - 12;
    labelObstacles.push(getRoleLabelBounds(edge.label, edge.labelX, edge.labelY));
  });

  return nextEdges;
}

function createAttributeLayout(
  entities: EntityPlacement[],
  relationships: PositionedRelationship[],
  relationshipModels: RelationshipModel[],
  shapesById: Map<string, CoreShape>,
  primaryEdges: LayoutEdge[],
): { attributes: PositionedAttribute[]; edges: LayoutEdge[] } {
  const attributes: PositionedAttribute[] = [];
  const edges: LayoutEdge[] = [];
  const relationshipModelById = new Map(
    relationshipModels.map((relationship) => [relationship.id, relationship]),
  );
  const nodeObstacles = [
    ...entities.map((entity) =>
      expandRect(
        {
          minX: entity.x - entity.width / 2,
          minY: entity.y - entity.height / 2,
          maxX: entity.x + entity.width / 2,
          maxY: entity.y + entity.height / 2,
        },
        18,
      ),
    ),
    ...relationships.map((relationship) =>
      expandRect(
        {
          minX: relationship.x - relationship.width / 2,
          minY: relationship.y - relationship.height / 2,
          maxX: relationship.x + relationship.width / 2,
          maxY: relationship.y + relationship.height / 2,
        },
        CLUSTER_PADDING * 0.45,
      ),
    ),
    ...primaryEdges
      .filter((edge) => edge.label && edge.labelX !== undefined && edge.labelY !== undefined)
      .map((edge) => getRoleLabelBounds(edge.label!, edge.labelX!, edge.labelY!)),
  ];

  entities.forEach((entity) => {
    const ownerShape = shapesById.get(entity.id);

    if (!ownerShape) {
      return;
    }

    const attributeGroups = classifyRootAttributes(entity.model.attributes);
    const rootAttributes = [
      ...attributeGroups.keyAttributes,
      ...attributeGroups.regularAttributes,
      ...attributeGroups.compositeAttributes,
    ];
    const neighborPoints = relationships
      .filter((relationship) => relationship.participants.some((participant) => participant.entityId === entity.id))
      .map((relationship) => ({ x: relationship.x, y: relationship.y }));
    const layout = placeRootAttributes(
      ownerShape,
      "entity",
      rootAttributes,
      neighborPoints,
      attributes,
      nodeObstacles,
    );

    layout.nodes.forEach((node) => attributes.push(node));
    layout.edges.forEach((edge) => edges.push(edge));
  });

  relationships.forEach((relationship) => {
    const ownerShape = shapesById.get(relationship.id);
    const relationshipModel = relationshipModelById.get(relationship.id);

    if (!ownerShape || !relationshipModel || relationshipModel.attributes.length === 0) {
      return;
    }

    const attributeGroups = classifyRootAttributes(relationshipModel.attributes);
    const rootAttributes = [
      ...attributeGroups.keyAttributes,
      ...attributeGroups.regularAttributes,
      ...attributeGroups.compositeAttributes,
    ];
    const neighborPoints = relationship.participants.map((participant) => {
      const entity = entities.find((candidate) => candidate.id === participant.entityId);
      return entity ? { x: entity.x, y: entity.y } : { x: relationship.x, y: relationship.y };
    });
    const layout = placeRootAttributes(
      ownerShape,
      "relationship",
      rootAttributes,
      neighborPoints,
      attributes,
      nodeObstacles,
    );

    layout.nodes.forEach((node) => attributes.push(node));
    layout.edges.forEach((edge) => edges.push(edge));
  });

  return { attributes, edges };
}

function buildEdgeTrackOffsets(
  relationships: PositionedRelationship[],
  shapesById: Map<string, CoreShape>,
): Map<string, number> {
  const trackOffsets = new Map<string, number>();
  const byEntity = new Map<string, Array<{ edgeId: string; angle: number }>>();
  const byRelationship = new Map<string, Array<{ edgeId: string; angle: number }>>();

  relationships.forEach((relationship) => {
    const relationshipShape = shapesById.get(relationship.id);

    if (!relationshipShape) {
      return;
    }

    relationship.participants.forEach((participant, participantIndex) => {
      const entityShape = shapesById.get(participant.entityId);

      if (!entityShape) {
        return;
      }

      const edgeId = `${relationship.id}-participant-${participantIndex}`;
      const entityAngle = angleBetween(entityShape, relationshipShape);
      const relationshipAngle = angleBetween(relationshipShape, entityShape);
      const entityList = byEntity.get(participant.entityId) ?? [];
      const relationshipList = byRelationship.get(relationship.id) ?? [];

      entityList.push({ edgeId, angle: entityAngle });
      relationshipList.push({ edgeId, angle: relationshipAngle });
      byEntity.set(participant.entityId, entityList);
      byRelationship.set(relationship.id, relationshipList);
    });
  });

  const applyTracks = (groups: Map<string, Array<{ edgeId: string; angle: number }>>, scale: number) => {
    groups.forEach((entries) => {
      if (entries.length <= 1) {
        return;
      }

      const sortedEntries = [...entries].sort((left, right) => left.angle - right.angle);

      sortedEntries.forEach((entry, index) => {
        const previous = sortedEntries[index - 1];
        const next = sortedEntries[index + 1];
        const hasNearbySibling =
          (previous && Math.abs(entry.angle - previous.angle) < 0.75) ||
          (next && Math.abs(next.angle - entry.angle) < 0.75);

        if (!hasNearbySibling) {
          return;
        }

        const nextOffset =
          (trackOffsets.get(entry.edgeId) ?? 0) +
          getBalancedOffset(index, EDGE_SEPARATION_OFFSET * scale);
        trackOffsets.set(entry.edgeId, nextOffset);
      });
    });
  };

  applyTracks(byEntity, 1);
  applyTracks(byRelationship, 0.65);

  return trackOffsets;
}

function getTernaryEntryAngles(
  relationship: PositionedRelationship,
  shapesById: Map<string, CoreShape>,
): Map<string, number> {
  const relationshipShape = shapesById.get(relationship.id);

  if (!relationshipShape || relationship.participants.length !== 3) {
    return new Map<string, number>();
  }

  const entries = relationship.participants
    .map((participant, participantIndex) => {
      const participantShape = shapesById.get(participant.entityId);

      if (!participantShape) {
        return null;
      }

      return {
        edgeId: `${relationship.id}-participant-${participantIndex}`,
        angle: normalizePositiveAngle(angleBetween(relationshipShape, participantShape)),
      };
    })
    .filter((entry): entry is { edgeId: string; angle: number } => entry !== null)
    .sort((left, right) => left.angle - right.angle);

  if (entries.length !== 3) {
    return new Map<string, number>();
  }

  const adjustedAngles = new Map(entries.map((entry) => [entry.edgeId, entry.angle]));

  for (let pass = 0; pass < 4; pass += 1) {
    for (let index = 0; index < entries.length; index += 1) {
      const current = entries[index];
      const next = entries[(index + 1) % entries.length];
      const currentAngle = adjustedAngles.get(current.edgeId) ?? current.angle;
      const nextAngle =
        (adjustedAngles.get(next.edgeId) ?? next.angle) +
        (index === entries.length - 1 ? Math.PI * 2 : 0);
      const separation = nextAngle - currentAngle;

      if (separation >= TERNARY_ENTRY_MIN_SEPARATION) {
        continue;
      }

      const delta = (TERNARY_ENTRY_MIN_SEPARATION - separation) / 2;
      adjustedAngles.set(current.edgeId, currentAngle - delta);
      adjustedAngles.set(next.edgeId, (adjustedAngles.get(next.edgeId) ?? next.angle) + delta);
    }
  }

  return new Map(
    [...adjustedAngles.entries()].map(([edgeId, angle]) => [
      edgeId,
      normalizeAngle(angle),
    ]),
  );
}

function createPrimaryEdges(
  relationships: PositionedRelationship[],
  shapesById: Map<string, CoreShape>,
  extraNodeObstacles: LayoutRect[] = [],
): LayoutEdge[] {
  const edges: LayoutEdge[] = [];
  const trackOffsets = buildEdgeTrackOffsets(relationships, shapesById);
  const entityObstacles = [...shapesById.values()]
    .filter((shape) => shape.kind === "entity")
    .map((shape) => expandRect(getShapeBounds(shape), 18));
  const relationshipObstacles = relationships.map((relationship) =>
    expandRect(getRelationshipBounds(relationship), MIN_NODE_GAP * 0.45),
  );
  const labelObstacles: LayoutRect[] = [];

  relationships.forEach((relationship) => {
    const relationshipShape = shapesById.get(relationship.id);
    const ternaryEntryAngles =
      relationship.participants.length === 3
        ? getTernaryEntryAngles(relationship, shapesById)
        : new Map<string, number>();

    if (!relationshipShape) {
      return;
    }

    relationship.participants.forEach((participant, participantIndex) => {
      const participantShape = shapesById.get(participant.entityId);

      if (!participantShape) {
        return;
      }

      let points: LayoutPoint[];
      let labelPoint: LayoutPoint | null = null;
      const edgeId = `${relationship.id}-participant-${participantIndex}`;
      const trackOffset = trackOffsets.get(edgeId) ?? 0;

      if (relationship.isSelfRelationship) {
        const sideDirection = participantIndex === 0 ? -1 : 1;
        const topAnchor = {
          x: participantShape.x + sideDirection * (participantShape.width * 0.18 + SELF_LOOP_OFFSET * 0.15),
          y: relationshipShape.y,
        };
        const start = getRectBoundaryPoint(
          participantShape.x,
          participantShape.y,
          participantShape.width,
          participantShape.height,
          topAnchor.x,
          topAnchor.y,
        );
        const end = getDiamondBoundaryPoint(
          relationshipShape.x,
          relationshipShape.y,
          relationshipShape.width,
          relationshipShape.height,
          start.x,
          start.y,
        );
        const control = {
          x: participantShape.x + sideDirection * (participantShape.width / 2 + SELF_LOOP_RADIUS),
          y: participantShape.y - participantShape.height / 2 - SELF_LOOP_RADIUS + SELF_LOOP_OFFSET * 0.2,
        };
        points = [start, control, end];
        labelPoint = {
          x: control.x + sideDirection * 18,
          y: control.y - 14,
        };
      } else {
        const ternaryEntryAngle = ternaryEntryAngles.get(edgeId);
        const relationshipGuidePoint =
          ternaryEntryAngle === undefined
            ? {
                x: participantShape.x,
                y: participantShape.y,
              }
            : {
                x:
                  relationshipShape.x +
                  Math.cos(ternaryEntryAngle) *
                    (relationshipShape.width / 2 + TERNARY_ENTRY_GUIDE_OFFSET),
                y:
                  relationshipShape.y +
                  Math.sin(ternaryEntryAngle) *
                    (relationshipShape.height / 2 + TERNARY_ENTRY_GUIDE_OFFSET),
              };
        const start = getShapeBoundaryPoint(participantShape, relationshipGuidePoint);
        const end = getShapeBoundaryPoint(relationshipShape, relationshipGuidePoint);
        const bendAmount =
          relationship.participants.length === 2
            ? getBalancedOffset(participantIndex, EDGE_CURVE_OFFSET * 0.42) + trackOffset
            : getBalancedOffset(participantIndex, EDGE_CURVE_OFFSET * 0.28) + trackOffset * 0.7;
        const obstacleRects = [
          ...entityObstacles,
          ...relationshipObstacles,
          ...extraNodeObstacles,
        ].filter((rect) => {
          return !pointInRect({ x: participantShape.x, y: participantShape.y }, rect) &&
            !pointInRect({ x: relationshipShape.x, y: relationshipShape.y }, rect);
        });
        points = createCurvedEdge(start, end, bendAmount, obstacleRects);
      }

      const resolvedLabelPoint =
        participant.roleLabel
          ? resolveRoleLabelPosition(
              participant.roleLabel,
              labelPoint ?? getPolylineMidpoint(points),
              [
                ...entityObstacles,
                ...extraNodeObstacles,
                ...relationships
                  .filter((candidate) => candidate.id !== relationship.id)
                  .map((candidate) => expandRect(getRelationshipBounds(candidate), MIN_NODE_GAP * 0.4)),
              ],
              labelObstacles,
            )
          : getPolylineMidpoint(points);

      if (participant.roleLabel) {
        labelObstacles.push(
          getRoleLabelBounds(participant.roleLabel, resolvedLabelPoint.x, resolvedLabelPoint.y - 12),
        );
      }

      edges.push({
        id: edgeId,
        kind: "entity-relationship",
        x1: points[0].x,
        y1: points[0].y,
        x2: points[points.length - 1].x,
        y2: points[points.length - 1].y,
        points,
        endConstraint: participant.endConstraint,
        label: participant.roleLabel,
        labelX: participant.roleLabel ? resolvedLabelPoint.x : undefined,
        labelY: participant.roleLabel ? resolvedLabelPoint.y - 12 : undefined,
        isSelfRelationship: relationship.isSelfRelationship,
        labelDragKey:
          relationship.isSelfRelationship && participant.roleLabel
            ? `${relationship.id}:${participantIndex === 0 ? "left" : "right"}`
            : undefined,
      });
    });
  });

  return edges;
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

  if (edge.label && edge.labelX !== undefined && edge.labelY !== undefined) {
    const labelBounds = getRoleLabelBounds(edge.label, edge.labelX, edge.labelY);
    minX = Math.min(minX, labelBounds.minX);
    minY = Math.min(minY, labelBounds.minY);
    maxX = Math.max(maxX, labelBounds.maxX);
    maxY = Math.max(maxY, labelBounds.maxY);
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

  const includeBounds = (nextMinX: number, nextMinY: number, nextMaxX: number, nextMaxY: number) => {
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
    const ringOffset = attribute.isMultivalued ? 6 : 0;
    includeBounds(
      attribute.x - attribute.rx - ringOffset,
      attribute.y - attribute.ry - ringOffset,
      attribute.x + attribute.rx + ringOffset,
      attribute.y + attribute.ry + ringOffset,
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

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  let marginX = LAYOUT_MARGIN;
  let marginY = LAYOUT_MARGIN;
  const rawAspectRatio =
    (contentWidth + marginX * 2) / Math.max(1, contentHeight + marginY * 2);

  if (rawAspectRatio < TARGET_PAGE_ASPECT_RATIO) {
    marginX = ((contentHeight + marginY * 2) * TARGET_PAGE_ASPECT_RATIO - contentWidth) / 2;
  } else {
    marginY = ((contentWidth + marginX * 2) / TARGET_PAGE_ASPECT_RATIO - contentHeight) / 2;
  }

  const shiftX = marginX - minX;
  const shiftY = marginY - minY;

  return {
    width: contentWidth + marginX * 2,
    height: contentHeight + marginY * 2,
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
  const {
    relationshipInfos,
    degreesByEntityId,
    adjacencyWeights,
  } = buildCoreRelationshipInfo(model.entities, model.relationships);
  const initialEntities = createInitialEntityPlacements(
    model.entities,
    degreesByEntityId,
  );
  const entitySlotTargets = new Map(
    initialEntities.map((entity) => [entity.id, { x: entity.x, y: entity.y }]),
  );
  const positionedEntities = runForceLayout(
    initialEntities,
    adjacencyWeights,
    degreesByEntityId,
    entitySlotTargets,
  );
  const positionedRelationships = placeRelationships(
    relationshipInfos,
    positionedEntities,
  );
  const refinedRelationships = refineRelationshipPositions(
    positionedRelationships,
    positionedEntities,
  );
  let shapesById = new Map<string, CoreShape>();

  positionedEntities.forEach((entity) => {
    shapesById.set(entity.id, {
      id: entity.id,
      kind: "entity",
      x: entity.x,
      y: entity.y,
      width: entity.width,
      height: entity.height,
    });
  });

  refinedRelationships.forEach((relationship) => {
    shapesById.set(relationship.id, {
      id: relationship.id,
      kind: "relationship",
      x: relationship.x,
      y: relationship.y,
      width: relationship.width,
      height: relationship.height,
    });
  });

  const initialPrimaryEdges = createPrimaryEdges(refinedRelationships, shapesById);
  const initialAttributeLayout = createAttributeLayout(
    positionedEntities,
    refinedRelationships,
    model.relationships,
    shapesById,
    initialPrimaryEdges,
  );
  const refinedNodes = resolveGlobalCollisions(
    positionedEntities,
    refinedRelationships,
    initialAttributeLayout.attributes,
    initialPrimaryEdges,
  );
  shapesById = new Map<string, CoreShape>();

  positionedEntities.forEach((entity) => {
    shapesById.set(entity.id, {
      id: entity.id,
      kind: "entity",
      x: entity.x,
      y: entity.y,
      width: entity.width,
      height: entity.height,
    });
  });

  refinedNodes.relationships.forEach((relationship) => {
    shapesById.set(relationship.id, {
      id: relationship.id,
      kind: "relationship",
      x: relationship.x,
      y: relationship.y,
      width: relationship.width,
      height: relationship.height,
    });
  });

  const locallyRefinedRelationships = refineRelationshipsLocally(
    positionedEntities,
    refinedNodes.relationships,
    refinedNodes.attributes,
  );
  shapesById = new Map<string, CoreShape>();

  positionedEntities.forEach((entity) => {
    shapesById.set(entity.id, {
      id: entity.id,
      kind: "entity",
      x: entity.x,
      y: entity.y,
      width: entity.width,
      height: entity.height,
    });
  });

  locallyRefinedRelationships.forEach((relationship) => {
    shapesById.set(relationship.id, {
      id: relationship.id,
      kind: "relationship",
      x: relationship.x,
      y: relationship.y,
      width: relationship.width,
      height: relationship.height,
    });
  });

  const finalPrimaryEdges = createPrimaryEdges(
    locallyRefinedRelationships,
    shapesById,
    refinedNodes.attributes.map((attribute) =>
      expandRect(getAttributeBounds(attribute), MIN_ATTRIBUTE_GAP / 2),
    ),
  );
  const locallyRefinedAttributes = refineAttributeClustersLocally(
    positionedEntities,
    locallyRefinedRelationships,
    refinedNodes.attributes,
    finalPrimaryEdges,
  );
  const finalAttributeEdges = rebuildAttributeEdges(locallyRefinedAttributes, shapesById);
  const finalPrimaryEdgesWithLabelCleanup = refineRoleLabelsLocally(
    finalPrimaryEdges,
    positionedEntities,
    locallyRefinedRelationships,
    locallyRefinedAttributes,
  );

  return normalizeLayout(
    positionedEntities.map(({ model: _model, ...entity }) => entity),
    locallyRefinedAttributes,
    locallyRefinedRelationships,
    [...finalPrimaryEdgesWithLabelCleanup, ...finalAttributeEdges],
  );
}

function buildShapesById(
  entities: PositionedEntity[],
  relationships: PositionedRelationship[],
): Map<string, CoreShape> {
  const shapesById = new Map<string, CoreShape>();

  entities.forEach((entity) => {
    shapesById.set(entity.id, {
      id: entity.id,
      kind: "entity",
      x: entity.x,
      y: entity.y,
      width: entity.width,
      height: entity.height,
    });
  });

  relationships.forEach((relationship) => {
    shapesById.set(relationship.id, {
      id: relationship.id,
      kind: "relationship",
      x: relationship.x,
      y: relationship.y,
      width: relationship.width,
      height: relationship.height,
    });
  });

  return shapesById;
}

export function recomputeLayoutEdges(layout: DiagramLayout): DiagramLayout {
  const shapesById = buildShapesById(layout.entities, layout.relationships);
  const primaryEdges = createPrimaryEdges(
    layout.relationships,
    shapesById,
    layout.attributes.map((attribute) =>
      expandRect(getAttributeBounds(attribute), MIN_ATTRIBUTE_GAP / 2),
    ),
  );
  const attributeEdges = rebuildAttributeEdges(layout.attributes, shapesById);
  const refinedPrimaryEdges = refineRoleLabelsLocally(
    primaryEdges,
    layout.entities,
    layout.relationships,
    layout.attributes,
  );

  return {
    ...layout,
    edges: [...refinedPrimaryEdges, ...attributeEdges],
  };
}
