export type EntityKind = "strong" | "weak";
export type RelationshipKind = "regular" | "identifying";
export type RelationshipConstraintMin = 0 | 1;
export type RelationshipConstraintMax = "1" | "m";

export interface AttributeModel {
  id: string;
  name: string;
  isKey: boolean;
  isPartialKey: boolean;
  isComposite: boolean;
  isMultivalued: boolean;
  isDerived: boolean;
  children: AttributeModel[];
}

export interface EntityModel {
  id: string;
  name: string;
  kind: EntityKind;
  attributes: AttributeModel[];
}

export interface CardinalityLabels {
  raw: string;
  source: string;
  target: string;
}

export interface RelationshipEndConstraint {
  raw: string;
  min: RelationshipConstraintMin;
  max: RelationshipConstraintMax;
}

export interface RelationshipParticipantModel {
  entity: string;
  endConstraint: RelationshipEndConstraint;
  roleLabel?: string;
}

export interface RelationshipModel {
  id: string;
  name: string;
  kind: RelationshipKind;
  isSelfRelationship: boolean;
  participants: RelationshipParticipantModel[];
  attributes: AttributeModel[];
  legacyCardinality: CardinalityLabels | null;
}

export interface DiagramModel {
  entities: EntityModel[];
  relationships: RelationshipModel[];
}

export interface ParseIssue {
  line: number;
  message: string;
}

export interface ParseResult {
  model: DiagramModel | null;
  errors: ParseIssue[];
}

export interface PositionedEntity {
  id: string;
  name: string;
  kind: EntityKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedAttribute {
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
  x: number;
  y: number;
  rx: number;
  ry: number;
  level: number;
}

export interface PositionedRelationshipParticipant {
  entityId: string;
  entityName: string;
  endConstraint: RelationshipEndConstraint;
  roleLabel?: string;
}

export interface PositionedRelationship {
  id: string;
  name: string;
  kind: RelationshipKind;
  isSelfRelationship: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  participants: PositionedRelationshipParticipant[];
  legacyCardinality: CardinalityLabels | null;
}

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutEdge {
  id: string;
  kind:
    | "entity-attribute"
    | "relationship-attribute"
    | "attribute-attribute"
    | "entity-relationship";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  points?: LayoutPoint[];
  label?: string;
  labelX?: number;
  labelY?: number;
  endConstraint?: RelationshipEndConstraint;
}

export interface DiagramLayout {
  width: number;
  height: number;
  entities: PositionedEntity[];
  attributes: PositionedAttribute[];
  relationships: PositionedRelationship[];
  edges: LayoutEdge[];
}
