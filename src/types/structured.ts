export type InputMode = "structured" | "plain-text";
export type StructuredEntityKind = "strong" | "weak";
export type StructuredRelationshipKind = "regular" | "identifying";
export type StructuredRelationshipDegree = "unary" | "binary" | "ternary";
export type StructuredCardinality = "one" | "many";
export type StructuredParticipation = "optional" | "mandatory";
export type StructuredValidationSeverity = "warning" | "error";

export interface StructuredAttribute {
  id: string;
  name: string;
  isKey: boolean;
  isPartialKey: boolean;
  isOptional: boolean;
  isDerived: boolean;
  isMultivalued: boolean;
  isComposite: boolean;
  children: StructuredAttribute[];
}

export interface StructuredEntity {
  id: string;
  name: string;
  kind: StructuredEntityKind;
  attributes: StructuredAttribute[];
}

export interface StructuredRelationshipParticipant {
  id: string;
  entityId: string;
  roleName: string;
  cardinality: StructuredCardinality;
  participation: StructuredParticipation;
}

export interface StructuredRelationship {
  id: string;
  name: string;
  kind: StructuredRelationshipKind;
  degree: StructuredRelationshipDegree;
  participants: StructuredRelationshipParticipant[];
  attributes: StructuredAttribute[];
}

export interface StructuredDiagramModel {
  entities: StructuredEntity[];
  relationships: StructuredRelationship[];
}

export interface StructuredPreset {
  id: string;
  name: string;
  description: string;
  model: StructuredDiagramModel;
}

export interface StructuredValidationIssue {
  id: string;
  severity: StructuredValidationSeverity;
  message: string;
}
