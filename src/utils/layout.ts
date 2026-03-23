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

const LAYOUT_MARGIN = 120;
const TARGET_PAGE_ASPECT_RATIO = 1.414;

const ENTITY_SPACING = 340;
const ENTITY_GRID_SPACING_X = ENTITY_SPACING;
const ENTITY_GRID_SPACING_Y = 270;
const ENTITY_REPULSION = 92000;
const ENTITY_ATTRACTION = 0.0032;
const ENTITY_CENTER_GRAVITY = 0.005;
const ENTITY_FORCE_ITERATIONS = 180;
const ENTITY_COLLISION_PADDING = 60;

const RELATIONSHIP_OFFSET = 34;
const RELATIONSHIP_PAIR_OFFSET = 58;
const RELATIONSHIP_TRIPLE_OFFSET = 42;
const SELF_RELATIONSHIP_DISTANCE = 210;
const RELATIONSHIP_COLLISION_PADDING = 30;

const ATTRIBUTE_RADIUS = 156;
const ATTRIBUTE_BASE_RADIUS = ATTRIBUTE_RADIUS;
const ATTRIBUTE_RING_STEP = 54;
const ATTRIBUTE_MAX_PER_RING = 8;
const ATTRIBUTE_COLLISION_PADDING = 14;
const ATTRIBUTE_OWNER_CURVE_BEND = 18;
const COMPOSITE_CHILD_RADIUS = 92;
const COMPOSITE_LEVEL_Y_STEP = 74;

const EDGE_CURVE_STRENGTH = 0.12;

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

interface RelationshipPlacementInfo {
  relationship: PositionedRelationship;
  participantCount: number;
  groupIndex: number;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
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

function createInitialEntityPlacements(
  entities: EntityModel[],
  degreesByEntityId: Map<string, number>,
): EntityPlacement[] {
  const orderedEntities = [...entities].sort((left, right) => {
    return (degreesByEntityId.get(right.id) ?? 0) - (degreesByEntityId.get(left.id) ?? 0);
  });
  const columnCount = Math.max(2, Math.ceil(Math.sqrt(orderedEntities.length * TARGET_PAGE_ASPECT_RATIO)));
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

      if (!position || !displacement) {
        return;
      }

      displacement.x -= position.x * ENTITY_CENTER_GRAVITY * Math.max(0.9, (degreesByEntityId.get(entity.id) ?? 1) / 2);
      displacement.y -= position.y * ENTITY_CENTER_GRAVITY;

      // A small outward pressure keeps medium/low-degree entities from collapsing into the center.
      const radialDistance = Math.hypot(position.x, position.y) || 1;
      const radialUnitX = position.x / radialDistance;
      const radialUnitY = position.y / radialDistance;
      const degreeScale = Math.max(0, 4 - (degreesByEntityId.get(entity.id) ?? 0));
      displacement.x += radialUnitX * degreeScale * 1.1;
      displacement.y += radialUnitY * degreeScale * 0.9;

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
  const candidates = [-Math.PI / 4, Math.PI / 4, (3 * Math.PI) / 4, (-3 * Math.PI) / 4];

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
    { x: 26, y: 0 },
    { x: -26, y: 0 },
    { x: 0, y: 26 },
    { x: 0, y: -26 },
    { x: 36, y: 24 },
    { x: -36, y: 24 },
    { x: 36, y: -24 },
    { x: -36, y: -24 },
    { x: 52, y: 0 },
    { x: -52, y: 0 },
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
          8,
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
      position = polarPoint(midpoint.x, midpoint.y, Math.abs(offset), angle + (offset >= 0 ? 0 : Math.PI));
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
      position = {
        x: centroid.x + offset,
        y: centroid.y - offset * 0.35,
      };
    }

    const nudgedPosition = nudgeRelationshipPoint(
      position.x,
      position.y,
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
  const normalX = -dy / length;
  const normalY = dx / length;
  const maxBend = Math.min(42, length * EDGE_CURVE_STRENGTH);
  const preferredBend = Math.max(-maxBend, Math.min(maxBend, bendAmount));
  const fallbackBends = [
    preferredBend,
    -preferredBend,
    preferredBend * 0.5,
    -preferredBend * 0.5,
    0,
  ];

  for (const nextBend of fallbackBends) {
    const control1 = {
      x: start.x + dx * 0.32 + normalX * nextBend,
      y: start.y + dy * 0.32 + normalY * nextBend,
    };
    const control2 = {
      x: start.x + dx * 0.68 + normalX * nextBend,
      y: start.y + dy * 0.68 + normalY * nextBend,
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
  const bounds = expandRect(getAttributeBounds(attribute), ATTRIBUTE_COLLISION_PADDING);

  if (nodeObstacles.some((obstacle) => rectsOverlap(bounds, obstacle))) {
    return true;
  }

  return placedAttributes.some((placedAttribute) =>
    rectsOverlap(
      bounds,
      expandRect(getAttributeBounds(placedAttribute), ATTRIBUTE_COLLISION_PADDING / 2),
    ),
  );
}

function getOwnerBaseAngle(owner: LayoutPoint, neighborPoints: LayoutPoint[]): number {
  if (neighborPoints.length === 0) {
    return -Math.PI / 2;
  }

  const averagePoint = {
    x: sum(neighborPoints.map((point) => point.x)) / neighborPoints.length,
    y: sum(neighborPoints.map((point) => point.y)) / neighborPoints.length,
  };

  return normalizeAngle(angleBetween(owner, averagePoint) + Math.PI);
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

  if (attributes.length === 0) {
    return { nodes, edges };
  }

  const baseAngle = getOwnerBaseAngle({ x: ownerShape.x, y: ownerShape.y }, neighborPoints);

  attributes.forEach((attribute, index) => {
    const ring = Math.floor(index / ATTRIBUTE_MAX_PER_RING);
    const ringIndex = index % ATTRIBUTE_MAX_PER_RING;
    const ringCount = Math.min(ATTRIBUTE_MAX_PER_RING, attributes.length - ring * ATTRIBUTE_MAX_PER_RING);
    const angleStep = (Math.PI * 2) / Math.max(1, ringCount);
    const ringPhase = ring % 2 === 0 ? 0 : angleStep / 2;
    let angle = baseAngle + ringPhase + ringIndex * angleStep;
    let radius = ATTRIBUTE_BASE_RADIUS + ring * ATTRIBUTE_RING_STEP;
    let node = createAttributeNode(
      attribute,
      ownerShape.id,
      ownerKind,
      ownerShape.x + Math.cos(angle) * radius,
      ownerShape.y + Math.sin(angle) * radius,
      0,
    );

    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (!attributeCollides(node, nodeObstacles, [...placedAttributes, ...nodes])) {
        break;
      }

      angle += Math.PI / 14;
      radius += 12;
      node = createAttributeNode(
        attribute,
        ownerShape.id,
        ownerKind,
        ownerShape.x + Math.cos(angle) * radius,
        ownerShape.y + Math.sin(angle) * radius,
        0,
      );
    }

    nodes.push(node);
    edges.push(connectOwnerToAttribute(ownerShape, node, ATTRIBUTE_OWNER_CURVE_BEND));

    if (attribute.children.length > 0) {
      const childNodes = placeCompositeChildren(
        node,
        attribute,
        { x: ownerShape.x, y: ownerShape.y },
        [...placedAttributes, ...nodes],
        nodeObstacles,
      );
      childNodes.nodes.forEach((childNode) => nodes.push(childNode));
      childNodes.edges.forEach((edge) => edges.push(edge));
    }
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
    const spread = childCount > 1 ? (index / (childCount - 1) - 0.5) * 0.9 : 0;
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

      angle += 0.14;
      radius += 12;
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

function createAttributeLayout(
  entities: EntityPlacement[],
  relationships: PositionedRelationship[],
  relationshipModels: RelationshipModel[],
  shapesById: Map<string, CoreShape>,
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
        8,
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
        8,
      ),
    ),
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

function createPrimaryEdges(
  relationships: PositionedRelationship[],
  shapesById: Map<string, CoreShape>,
): LayoutEdge[] {
  const edges: LayoutEdge[] = [];
  const entityObstacles = [...shapesById.values()]
    .filter((shape) => shape.kind === "entity")
    .map((shape) => expandRect(getShapeBounds(shape), 8));

  relationships.forEach((relationship) => {
    const relationshipShape = shapesById.get(relationship.id);

    if (!relationshipShape) {
      return;
    }

    relationship.participants.forEach((participant, participantIndex) => {
      const participantShape = shapesById.get(participant.entityId);

      if (!participantShape) {
        return;
      }

      let points: LayoutPoint[];

      if (relationship.isSelfRelationship) {
        const branchDirection = participantIndex === 0 ? -1 : 1;
        const lateral = participantShape.width / 2 + 56;
        const vertical = participantShape.height / 2 + 34;
        const start = getRectBoundaryPoint(
          participantShape.x,
          participantShape.y,
          participantShape.width,
          participantShape.height,
          relationshipShape.x,
          relationshipShape.y + branchDirection * vertical,
        );
        const end = getDiamondBoundaryPoint(
          relationshipShape.x,
          relationshipShape.y,
          relationshipShape.width,
          relationshipShape.height,
          participantShape.x,
          participantShape.y + branchDirection * vertical,
        );
        const control1 = {
          x: participantShape.x + (relationshipShape.x >= participantShape.x ? lateral : -lateral),
          y: participantShape.y + branchDirection * vertical,
        };
        const control2 = {
          x: relationshipShape.x + (relationshipShape.x >= participantShape.x ? -34 : 34),
          y: relationshipShape.y + branchDirection * 42,
        };
        points = [start, control1, control2, end];
      } else {
        const start = getShapeBoundaryPoint(participantShape, {
          x: relationshipShape.x,
          y: relationshipShape.y,
        });
        const end = getShapeBoundaryPoint(relationshipShape, {
          x: participantShape.x,
          y: participantShape.y,
        });
        const bendAmount =
          relationship.participants.length === 2
            ? getBalancedOffset(participantIndex, RELATIONSHIP_OFFSET * 0.55)
            : getBalancedOffset(participantIndex, RELATIONSHIP_OFFSET * 0.8);
        const obstacleRects = entityObstacles.filter((rect) => {
          return !pointInRect({ x: participantShape.x, y: participantShape.y }, rect) &&
            !pointInRect({ x: relationshipShape.x, y: relationshipShape.y }, rect);
        });
        points = createCurvedEdge(start, end, bendAmount, obstacleRects);
      }

      const labelPoint = getPolylineMidpoint(points);

      edges.push({
        id: `${relationship.id}-participant-${participantIndex}`,
        kind: "entity-relationship",
        x1: points[0].x,
        y1: points[0].y,
        x2: points[points.length - 1].x,
        y2: points[points.length - 1].y,
        points,
        endConstraint: participant.endConstraint,
        label: participant.roleLabel,
        labelX: participant.roleLabel ? labelPoint.x : undefined,
        labelY: participant.roleLabel ? labelPoint.y - 12 : undefined,
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
  const initialEntities = createInitialEntityPlacements(model.entities, degreesByEntityId);
  const positionedEntities = runForceLayout(
    initialEntities,
    adjacencyWeights,
    degreesByEntityId,
  );
  const positionedRelationships = placeRelationships(
    relationshipInfos,
    positionedEntities,
  );
  const shapesById = new Map<string, CoreShape>();

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

  positionedRelationships.forEach((relationship) => {
    shapesById.set(relationship.id, {
      id: relationship.id,
      kind: "relationship",
      x: relationship.x,
      y: relationship.y,
      width: relationship.width,
      height: relationship.height,
    });
  });

  const primaryEdges = createPrimaryEdges(positionedRelationships, shapesById);
  const attributeLayout = createAttributeLayout(
    positionedEntities,
    positionedRelationships,
    model.relationships,
    shapesById,
  );

  return normalizeLayout(
    positionedEntities.map(({ model: _model, ...entity }) => entity),
    attributeLayout.attributes,
    positionedRelationships,
    [...primaryEdges, ...attributeLayout.edges],
  );
}
