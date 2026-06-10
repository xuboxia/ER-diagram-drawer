import type {
  InputMode,
  StructuredAttribute,
  StructuredCardinality,
  StructuredDiagramModel,
  StructuredEntity,
  StructuredEntityKind,
  StructuredParticipation,
  StructuredRelationship,
  StructuredRelationshipDegree,
  StructuredRelationshipKind,
  StructuredRelationshipParticipant,
  StructuredValidationIssue,
} from "../types/structured";

const DEFAULT_CARDINALITY: StructuredCardinality = "many";
const DEFAULT_PARTICIPATION: StructuredParticipation = "optional";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createStructuredId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createStructuredAttribute(name = ""): StructuredAttribute {
  return {
    id: createStructuredId("attribute"),
    name,
    isKey: false,
    isPartialKey: false,
    isOptional: false,
    isDerived: false,
    isMultivalued: false,
    isComposite: false,
    children: [],
  };
}

export function createStructuredEntity(name = ""): StructuredEntity {
  return {
    id: createStructuredId("entity"),
    name,
    kind: "strong",
    attributes: [createStructuredAttribute()],
  };
}

export function createStructuredRelationshipParticipant(
  entityId = "",
): StructuredRelationshipParticipant {
  return {
    id: createStructuredId("participant"),
    entityId,
    roleName: "",
    cardinality: DEFAULT_CARDINALITY,
    participation: DEFAULT_PARTICIPATION,
  };
}

export function createStructuredRelationship(
  name = "",
  degree: StructuredRelationshipDegree = "binary",
  entityIds: string[] = [],
): StructuredRelationship {
  const participantCount = degree === "ternary" ? 3 : 2;

  return {
    id: createStructuredId("relationship"),
    name,
    kind: "regular",
    degree,
    participants: Array.from({ length: participantCount }, (_, index) =>
      createStructuredRelationshipParticipant(entityIds[index] ?? entityIds[0] ?? ""),
    ),
    attributes: [],
  };
}

export function createEmptyStructuredModel(): StructuredDiagramModel {
  return {
    entities: [],
    relationships: [],
  };
}

export function ensureRelationshipDegreeShape(
  relationship: StructuredRelationship,
): StructuredRelationship {
  const participantCount = relationship.degree === "ternary" ? 3 : 2;
  const participants = relationship.participants.slice(0, participantCount);

  while (participants.length < participantCount) {
    participants.push(createStructuredRelationshipParticipant(participants[0]?.entityId ?? ""));
  }

  return {
    ...relationship,
    participants,
  };
}

function normalizeEntityKind(value: unknown): StructuredEntityKind {
  return value === "weak" ? "weak" : "strong";
}

function normalizeRelationshipKind(value: unknown): StructuredRelationshipKind {
  return value === "identifying" ? "identifying" : "regular";
}

function normalizeRelationshipDegree(value: unknown): StructuredRelationshipDegree {
  if (value === "unary" || value === "ternary") {
    return value;
  }

  return "binary";
}

function normalizeCardinality(value: unknown): StructuredCardinality {
  return value === "one" ? "one" : DEFAULT_CARDINALITY;
}

function normalizeParticipation(value: unknown): StructuredParticipation {
  return value === "mandatory" ? "mandatory" : DEFAULT_PARTICIPATION;
}

function normalizeStructuredAttribute(value: unknown): StructuredAttribute | null {
  if (!isRecord(value)) {
    return null;
  }

  const isComposite = Boolean(value.isComposite);

  return {
    id: typeof value.id === "string" && value.id ? value.id : createStructuredId("attribute"),
    name: typeof value.name === "string" ? value.name : "",
    isKey: Boolean(value.isKey),
    isPartialKey: Boolean(value.isPartialKey),
    isOptional: Boolean(value.isOptional),
    isDerived: Boolean(value.isDerived),
    isMultivalued: Boolean(value.isMultivalued),
    isComposite,
    children: Array.isArray(value.children)
      ? value.children
          .map((child) => normalizeStructuredAttribute(child))
          .filter((child): child is StructuredAttribute => child !== null)
      : [],
  };
}

function normalizeStructuredEntity(value: unknown): StructuredEntity | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    id: typeof value.id === "string" && value.id ? value.id : createStructuredId("entity"),
    name: typeof value.name === "string" ? value.name : "",
    kind: normalizeEntityKind(value.kind),
    attributes: Array.isArray(value.attributes)
      ? value.attributes
          .map((attribute) => normalizeStructuredAttribute(attribute))
          .filter((attribute): attribute is StructuredAttribute => attribute !== null)
      : [],
  };
}

function normalizeStructuredParticipant(
  value: unknown,
): StructuredRelationshipParticipant | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    id:
      typeof value.id === "string" && value.id
        ? value.id
        : createStructuredId("participant"),
    entityId: typeof value.entityId === "string" ? value.entityId : "",
    roleName: typeof value.roleName === "string" ? value.roleName : "",
    cardinality: normalizeCardinality(value.cardinality),
    participation: normalizeParticipation(value.participation),
  };
}

function normalizeStructuredRelationship(value: unknown): StructuredRelationship | null {
  if (!isRecord(value)) {
    return null;
  }

  const relationship: StructuredRelationship = {
    id:
      typeof value.id === "string" && value.id
        ? value.id
        : createStructuredId("relationship"),
    name: typeof value.name === "string" ? value.name : "",
    kind: normalizeRelationshipKind(value.kind),
    degree: normalizeRelationshipDegree(value.degree),
    participants: Array.isArray(value.participants)
      ? value.participants
          .map((participant) => normalizeStructuredParticipant(participant))
          .filter((participant): participant is StructuredRelationshipParticipant => participant !== null)
      : [],
    attributes: Array.isArray(value.attributes)
      ? value.attributes
          .map((attribute) => normalizeStructuredAttribute(attribute))
          .filter((attribute): attribute is StructuredAttribute => attribute !== null)
      : [],
  };

  return ensureRelationshipDegreeShape(relationship);
}

export function normalizeStructuredModel(value: unknown): StructuredDiagramModel | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    entities: Array.isArray(value.entities)
      ? value.entities
          .map((entity) => normalizeStructuredEntity(entity))
          .filter((entity): entity is StructuredEntity => entity !== null)
      : [],
    relationships: Array.isArray(value.relationships)
      ? value.relationships
          .map((relationship) => normalizeStructuredRelationship(relationship))
          .filter((relationship): relationship is StructuredRelationship => relationship !== null)
      : [],
  };
}

export function normalizeInputMode(value: unknown): InputMode {
  return value === "plain-text" ? "plain-text" : "structured";
}

function formatConstraint(
  participation: StructuredParticipation,
  cardinality: StructuredCardinality,
): string {
  const min = participation === "mandatory" ? "1" : "0";
  const max = cardinality === "one" ? "1" : "m";
  return `${min}..${max}`;
}

function formatAttributeLine(attribute: StructuredAttribute, depth: number): string[] {
  const markers = [
    attribute.isKey ? "key" : null,
    attribute.isPartialKey ? "partial-key" : null,
    attribute.isDerived ? "derived" : null,
    attribute.isMultivalued ? "multivalued" : null,
    attribute.isComposite ? "composite" : null,
  ].filter((marker): marker is string => marker !== null);
  const indent = "  ".repeat(depth);
  const name = attribute.name.trim() || "UnnamedAttribute";
  const markerText = markers.length > 0 ? ` ${markers.map((marker) => `(${marker})`).join(" ")}` : "";
  const lines = [`${indent}- ${name}${markerText}`];

  if (attribute.isComposite) {
    attribute.children.forEach((child) => {
      lines.push(...formatAttributeLine(child, depth + 1));
    });
  }

  return lines;
}

function entityNameById(model: StructuredDiagramModel): Map<string, string> {
  return new Map(
    model.entities.map((entity, index) => [
      entity.id,
      entity.name.trim() || `UnnamedEntity${index + 1}`,
    ]),
  );
}

export function structuredModelToSource(model: StructuredDiagramModel): string {
  const namesById = entityNameById(model);
  const blocks: string[] = [];

  model.entities.forEach((entity, index) => {
    const name = entity.name.trim() || `UnnamedEntity${index + 1}`;
    const header = entity.kind === "weak" ? "WeakEntity" : "Entity";
    const attributeLines =
      entity.attributes.length > 0
        ? entity.attributes.flatMap((attribute) => formatAttributeLine(attribute, 0))
        : ["- UnnamedAttribute"];

    blocks.push([`${header}: ${name}`, ...attributeLines].join("\n"));
  });

  model.relationships.forEach((relationship, index) => {
    const normalizedRelationship = ensureRelationshipDegreeShape(relationship);
    const name = relationship.name.trim() || `UnnamedRelationship${index + 1}`;
    const header =
      relationship.kind === "identifying" ? "IdentifyingRelationship" : "Relationship";
    const participantNames = normalizedRelationship.participants.map(
      (participant, participantIndex) =>
        namesById.get(participant.entityId) ?? `MissingEntity${participantIndex + 1}`,
    );
    const lines = [`${header}: ${name}`];

    lines.push(`- ${participantNames.join(" -> ")}`);

    if (normalizedRelationship.degree === "ternary") {
      normalizedRelationship.participants.forEach((participant, participantIndex) => {
        lines.push(
          `- ${participantNames[participantIndex]}: ${formatConstraint(
            participant.participation,
            participant.cardinality,
          )}`,
        );
      });
    } else {
      const [leftParticipant, rightParticipant] = normalizedRelationship.participants;
      lines.push(
        `- left: ${formatConstraint(leftParticipant.participation, leftParticipant.cardinality)}`,
      );
      lines.push(
        `- right: ${formatConstraint(rightParticipant.participation, rightParticipant.cardinality)}`,
      );

      if (normalizedRelationship.degree === "unary") {
        if (leftParticipant.roleName.trim()) {
          lines.push(`- left role: ${leftParticipant.roleName.trim()}`);
        }

        if (rightParticipant.roleName.trim()) {
          lines.push(`- right role: ${rightParticipant.roleName.trim()}`);
        }
      }
    }

    normalizedRelationship.attributes.forEach((attribute) => {
      lines.push(...formatAttributeLine(attribute, 0));
    });

    blocks.push(lines.join("\n"));
  });

  return blocks.join("\n\n");
}

function collectAttributeNames(
  attributes: StructuredAttribute[],
  ownerLabel: string,
  issues: StructuredValidationIssue[],
): void {
  const siblingNames = new Map<string, string>();

  attributes.forEach((attribute) => {
    const name = attribute.name.trim();

    if (!name) {
      issues.push({
        id: `${attribute.id}-missing-name`,
        severity: "warning",
        message: `${ownerLabel} has an attribute without a name.`,
      });
    } else {
      const key = name.toLowerCase();

      if (siblingNames.has(key)) {
        issues.push({
          id: `${attribute.id}-duplicate-name`,
          severity: "warning",
          message: `${ownerLabel} repeats the attribute "${name}". Attribute names should be unique within the same owner.`,
        });
      }

      siblingNames.set(key, name);
    }

    if (attribute.isKey && attribute.isPartialKey) {
      issues.push({
        id: `${attribute.id}-key-partial-key`,
        severity: "warning",
        message: `${ownerLabel} marks "${name || "an attribute"}" as both key and partial key.`,
      });
    }

    if (attribute.isComposite && attribute.children.length === 0) {
      issues.push({
        id: `${attribute.id}-empty-composite`,
        severity: "warning",
        message: `Composite attribute "${name || "UnnamedAttribute"}" should include child attributes.`,
      });
    }

    if (attribute.children.length > 0) {
      collectAttributeNames(attribute.children, `Composite attribute "${name || "UnnamedAttribute"}"`, issues);
    }
  });
}

export function validateStructuredModel(model: StructuredDiagramModel): StructuredValidationIssue[] {
  const issues: StructuredValidationIssue[] = [];
  const entityNames = new Map<string, StructuredEntity>();

  if (model.entities.length === 0) {
    issues.push({
      id: "model-no-entities",
      severity: "error",
      message: "Add at least one entity before generating a diagram.",
    });
  }

  model.entities.forEach((entity, index) => {
    const name = entity.name.trim();

    if (!name) {
      issues.push({
        id: `${entity.id}-missing-name`,
        severity: "error",
        message: `Entity ${index + 1} needs a name.`,
      });
    } else {
      const key = name.toLowerCase();

      if (entityNames.has(key)) {
        issues.push({
          id: `${entity.id}-duplicate-name`,
          severity: "error",
          message: `Duplicate entity name "${name}". Entity names must be unique.`,
        });
      }

      entityNames.set(key, entity);
    }

    if (!entity.attributes.some((attribute) => attribute.isKey || attribute.isPartialKey)) {
      issues.push({
        id: `${entity.id}-missing-key`,
        severity: "warning",
        message: `${name || `Entity ${index + 1}`} has no key or partial key attribute.`,
      });
    }

    collectAttributeNames(entity.attributes, `Entity "${name || `Entity ${index + 1}`}"`, issues);
  });

  model.relationships.forEach((relationship, index) => {
    const relationshipName = relationship.name.trim() || `Relationship ${index + 1}`;
    const expectedCount = relationship.degree === "ternary" ? 3 : 2;
    const selectedParticipants = relationship.participants.filter((participant) => participant.entityId);

    if (!relationship.name.trim()) {
      issues.push({
        id: `${relationship.id}-missing-name`,
        severity: "warning",
        message: `Relationship ${index + 1} needs a name.`,
      });
    }

    if (selectedParticipants.length < expectedCount) {
      issues.push({
        id: `${relationship.id}-not-enough-participants`,
        severity: "error",
        message: `${relationshipName} needs ${expectedCount} participant entities for a ${relationship.degree} relationship.`,
      });
    }

    relationship.participants.forEach((participant, participantIndex) => {
      const entity = model.entities.find((candidate) => candidate.id === participant.entityId);

      if (participant.entityId && !entity) {
        issues.push({
          id: `${participant.id}-missing-entity`,
          severity: "error",
          message: `${relationshipName} references an entity that no longer exists. Choose a valid participant entity.`,
        });
      }

      if (!participant.cardinality || !participant.participation) {
        issues.push({
          id: `${participant.id}-missing-constraint`,
          severity: "error",
          message: `${relationshipName} participant ${participantIndex + 1} must specify both cardinality and participation. Cardinality alone is not enough in Chen notation.`,
        });
      }
    });

    if (relationship.degree === "unary") {
      const [leftParticipant, rightParticipant] = relationship.participants;

      if (leftParticipant?.entityId && rightParticipant?.entityId && leftParticipant.entityId !== rightParticipant.entityId) {
        issues.push({
          id: `${relationship.id}-unary-mismatch`,
          severity: "error",
          message: `${relationshipName} is unary, so both role ends must refer to the same entity.`,
        });
      }
    }

    if (relationship.degree === "ternary") {
      const participantIds = relationship.participants.map((participant) => participant.entityId).filter(Boolean);
      const uniqueParticipantIds = new Set(participantIds);

      if (uniqueParticipantIds.size < participantIds.length) {
        issues.push({
          id: `${relationship.id}-ternary-duplicates`,
          severity: "warning",
          message: `${relationshipName} repeats an entity in a ternary relationship. Use a unary relationship when modelling recursive roles.`,
        });
      }
    }

    collectAttributeNames(relationship.attributes, `Relationship "${relationshipName}"`, issues);
  });

  return issues;
}
