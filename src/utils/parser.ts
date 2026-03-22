import type {
  AttributeModel,
  CardinalityLabels,
  DiagramModel,
  EntityKind,
  EntityModel,
  ParseIssue,
  ParseResult,
  RelationshipEndStyle,
  RelationshipKind,
  RelationshipModel,
  RelationshipParticipantModel,
  RelationshipParticipation,
} from "../types/diagram";

interface SourceLine {
  lineNumber: number;
  raw: string;
  trimmed: string;
  indent: number;
}

type SectionHeader =
  | { kind: "entity"; name: string }
  | { kind: "weak-entity"; name: string }
  | { kind: "relationship"; name: string }
  | { kind: "identifying-relationship"; name: string };

type RangeConstraint = "0..1" | "1..1" | "0..M" | "1..M";

interface RelationshipBlockParseState {
  participantNames: string[];
  participantLineNumber: number | null;
  participantStylesByName: Map<string, RelationshipEndStyle>;
  leftParticipation: RelationshipParticipation | null;
  rightParticipation: RelationshipParticipation | null;
  leftArrow: boolean | null;
  rightArrow: boolean | null;
  legacyCardinality: CardinalityLabels | null;
  attributes: AttributeModel[];
}

const ENTITY_HEADER = /^Entity\s*:\s*(.+)$/i;
const WEAK_ENTITY_HEADER = /^WeakEntity\s*:\s*(.+)$/i;
const RELATIONSHIP_HEADER = /^Relationship\s*:\s*(.+)$/i;
const IDENTIFYING_RELATIONSHIP_HEADER = /^IdentifyingRelationship\s*:\s*(.+)$/i;

const ATTRIBUTE_TAGS = new Set([
  "key",
  "composite",
  "partial-key",
  "weak-key",
  "derived",
  "multivalued",
]);

function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function normalizeLine(raw: string, lineNumber: number): SourceLine {
  const expanded = raw.replace(/\t/g, "    ");
  const indentMatch = expanded.match(/^\s*/);
  const indent = indentMatch ? indentMatch[0].length : 0;

  return {
    lineNumber,
    raw: expanded,
    trimmed: expanded.trim(),
    indent,
  };
}

function normalizeAttributeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

function normalizeLegacyCardinalityPart(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();

  if (normalized === "1") {
    return "1";
  }

  if (normalized === "m" || normalized === "n") {
    return "M";
  }

  return null;
}

function normalizeParticipation(raw: string): RelationshipParticipation | null {
  const normalized = raw.trim().toLowerCase();

  if (normalized === "partial" || normalized === "single") {
    return "partial";
  }

  if (normalized === "total" || normalized === "double") {
    return "total";
  }

  return null;
}

function normalizeBoolean(raw: string): boolean | null {
  const normalized = raw.trim().toLowerCase();

  if (normalized === "true" || normalized === "yes") {
    return true;
  }

  if (normalized === "false" || normalized === "no") {
    return false;
  }

  return null;
}

function matchHeader(line: SourceLine): SectionHeader | null {
  const weakEntityHeader = line.trimmed.match(WEAK_ENTITY_HEADER);
  if (weakEntityHeader) {
    return { kind: "weak-entity", name: weakEntityHeader[1].trim() };
  }

  const entityHeader = line.trimmed.match(ENTITY_HEADER);
  if (entityHeader) {
    return { kind: "entity", name: entityHeader[1].trim() };
  }

  const identifyingRelationshipHeader = line.trimmed.match(IDENTIFYING_RELATIONSHIP_HEADER);
  if (identifyingRelationshipHeader) {
    return {
      kind: "identifying-relationship",
      name: identifyingRelationshipHeader[1].trim(),
    };
  }

  const relationshipHeader = line.trimmed.match(RELATIONSHIP_HEADER);
  if (relationshipHeader) {
    return { kind: "relationship", name: relationshipHeader[1].trim() };
  }

  return null;
}

function isHeaderLine(line: SourceLine): boolean {
  return matchHeader(line) !== null;
}

function parseCardinality(raw: string, lineNumber: number, errors: ParseIssue[]): CardinalityLabels | null {
  const match = raw.match(/^(.*?)\s*:\s*(.*?)$/);

  if (!match) {
    errors.push({
      line: lineNumber,
      message: 'Legacy cardinality must look like "1:N", "1:1", or "M:N".',
    });
    return null;
  }

  const source = normalizeLegacyCardinalityPart(match[1]);
  const target = normalizeLegacyCardinalityPart(match[2]);

  if (!source || !target) {
    errors.push({
      line: lineNumber,
      message: 'Legacy cardinality must use only "1", "M", or "N".',
    });
    return null;
  }

  return {
    raw: `${source}:${target}`,
    source,
    target,
  };
}

function mapLegacyCardinalityToEndStyle(part: string): RelationshipEndStyle {
  const normalized = part.trim().toUpperCase();
  const isOne = normalized === "1";

  return {
    raw: isOne ? "partial one" : "partial many",
    participation: "partial",
    hasArrow: isOne,
  };
}

function mapRangeToEndStyle(range: RangeConstraint): RelationshipEndStyle {
  const [minimum, maximum] = range.split("..");

  return {
    raw: range,
    participation: minimum === "1" ? "total" : "partial",
    hasArrow: maximum === "1",
  };
}

function parseRangeConstraint(raw: string): RangeConstraint | null {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/\s+to\s+/g, "..")
    .replace(/\s+/g, "");

  if (normalized === "0..1") {
    return "0..1";
  }

  if (normalized === "1..1") {
    return "1..1";
  }

  if (normalized === "0..m" || normalized === "0..n") {
    return "0..M";
  }

  if (normalized === "1..m" || normalized === "1..n") {
    return "1..M";
  }

  return null;
}

function parseCompactEndStyle(raw: string): RelationshipEndStyle | null {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, " ");

  if (normalized === "m" || normalized === "n" || normalized === "many") {
    return {
      raw: normalized,
      participation: "partial",
      hasArrow: false,
    };
  }

  if (normalized === "1" || normalized === "one") {
    return {
      raw: normalized,
      participation: "partial",
      hasArrow: true,
    };
  }

  if (normalized === "partial many") {
    return {
      raw: normalized,
      participation: "partial",
      hasArrow: false,
    };
  }

  if (normalized === "total many") {
    return {
      raw: normalized,
      participation: "total",
      hasArrow: false,
    };
  }

  if (normalized === "partial one") {
    return {
      raw: normalized,
      participation: "partial",
      hasArrow: true,
    };
  }

  if (normalized === "total one") {
    return {
      raw: normalized,
      participation: "total",
      hasArrow: true,
    };
  }

  return null;
}

function parseParticipantEndStyle(
  raw: string,
  lineNumber: number,
  label: string,
  errors: ParseIssue[],
): RelationshipEndStyle | null {
  const range = parseRangeConstraint(raw);

  if (range) {
    return mapRangeToEndStyle(range);
  }

  const compact = parseCompactEndStyle(raw);

  if (compact) {
    return compact;
  }

  errors.push({
    line: lineNumber,
    message:
      `Invalid constraint for "${label}": "${raw}". ` +
      `Use 0 to 1, 1 to 1, 0 to m, 1 to m, or compact forms like "total one".`,
  });
  return null;
}

function parseAttributeLine(
  line: SourceLine,
  ownerId: string,
  path: string,
  index: number,
  errors: ParseIssue[],
): AttributeModel | null {
  if (!line.trimmed.startsWith("-")) {
    errors.push({
      line: line.lineNumber,
      message: 'Attribute lines must begin with "-".',
    });
    return null;
  }

  const content = line.trimmed.slice(1).trim();

  if (!content) {
    errors.push({
      line: line.lineNumber,
      message: "Attribute name cannot be empty.",
    });
    return null;
  }

  const rawTags = Array.from(content.matchAll(/\(([^)]+)\)/g)).map((match) =>
    normalizeAttributeTag(match[1]),
  );
  const unknownTags = rawTags.filter((tag) => !ATTRIBUTE_TAGS.has(tag));

  if (unknownTags.length > 0) {
    errors.push({
      line: line.lineNumber,
      message: `Unsupported attribute marker(s): ${unknownTags.map((tag) => `"${tag}"`).join(", ")}.`,
    });
  }

  const tags = new Set(
    rawTags.map((tag) => {
      if (tag === "weak-key") {
        return "partial-key";
      }

      return tag;
    }),
  );
  const name = content.replace(/\s*\(([^)]+)\)/g, "").trim();

  if (!name) {
    errors.push({
      line: line.lineNumber,
      message: "Attribute name cannot be empty after removing annotations.",
    });
    return null;
  }

  if (tags.has("key") && tags.has("partial-key")) {
    errors.push({
      line: line.lineNumber,
      message: 'An attribute cannot be both "(key)" and "(partial-key)".',
    });
  }

  return {
    id: `${ownerId}-${path}-${slugify(name, `attribute-${index + 1}`)}`,
    name,
    isKey: tags.has("key"),
    isPartialKey: tags.has("partial-key"),
    isComposite: tags.has("composite"),
    isMultivalued: tags.has("multivalued"),
    isDerived: tags.has("derived"),
    children: [],
  };
}

function parseAttributeList(
  lines: SourceLine[],
  startIndex: number,
  baseIndent: number,
  ownerId: string,
  path: string,
  errors: ParseIssue[],
): { attributes: AttributeModel[]; nextIndex: number } {
  const attributes: AttributeModel[] = [];
  let currentIndex = startIndex;

  while (currentIndex < lines.length) {
    const line = lines[currentIndex];

    if (!line.trimmed) {
      currentIndex += 1;
      continue;
    }

    if (isHeaderLine(line)) {
      break;
    }

    if (line.indent < baseIndent) {
      break;
    }

    if (line.indent > baseIndent) {
      errors.push({
        line: line.lineNumber,
        message: "Unexpected indentation. Indent child attributes under a composite attribute only.",
      });
      currentIndex += 1;
      continue;
    }

    const attribute = parseAttributeLine(line, ownerId, path, attributes.length, errors);
    currentIndex += 1;

    if (!attribute) {
      continue;
    }

    let nextMeaningfulIndex = currentIndex;

    while (nextMeaningfulIndex < lines.length && !lines[nextMeaningfulIndex].trimmed) {
      nextMeaningfulIndex += 1;
    }

    if (
      nextMeaningfulIndex < lines.length &&
      !isHeaderLine(lines[nextMeaningfulIndex]) &&
      lines[nextMeaningfulIndex].indent > line.indent
    ) {
      if (!attribute.isComposite) {
        errors.push({
          line: lines[nextMeaningfulIndex].lineNumber,
          message: `Only composite attributes can contain nested child attributes. "${attribute.name}" should be marked "(composite)".`,
        });
      }

      const childPath = `${path}-${slugify(attribute.name, `attribute-${attributes.length + 1}`)}`;
      const childResult = parseAttributeList(
        lines,
        nextMeaningfulIndex,
        lines[nextMeaningfulIndex].indent,
        ownerId,
        childPath,
        errors,
      );

      attribute.children = childResult.attributes;
      currentIndex = childResult.nextIndex;

      if (attribute.isComposite && attribute.children.length === 0) {
        errors.push({
          line: line.lineNumber,
          message: `Composite attribute "${attribute.name}" must include at least one child attribute.`,
        });
      }
    }

    attributes.push(attribute);
  }

  return {
    attributes,
    nextIndex: currentIndex,
  };
}

function parseEntityBlock(
  name: string,
  lines: SourceLine[],
  entityIndex: number,
  kind: EntityKind,
  errors: ParseIssue[],
): EntityModel {
  const entityId = `entity-${slugify(name, `entity-${entityIndex + 1}`)}`;
  const meaningfulLines = lines.filter((line) => line.trimmed);
  const attributeIndent = meaningfulLines[0]?.indent ?? 0;
  const attributeResult = parseAttributeList(
    lines,
    0,
    attributeIndent,
    entityId,
    "root",
    errors,
  );

  if (attributeResult.attributes.length === 0) {
    const lineNumber = meaningfulLines[0]?.lineNumber ?? 1;
    errors.push({
      line: lineNumber,
      message: `${kind === "weak" ? "Weak entity" : "Entity"} "${name}" must include at least one attribute.`,
    });
  }

  return {
    id: entityId,
    name,
    kind,
    attributes: attributeResult.attributes,
  };
}

function parseParticipantChain(line: SourceLine): string[] | null {
  if (!line.trimmed.startsWith("-")) {
    return null;
  }

  const content = line.trimmed.slice(1).trim();

  if (!content.includes("->")) {
    return null;
  }

  const parts = content.split("->").map((part) => part.trim());

  if (parts.some((part) => part.length === 0)) {
    return [];
  }

  return parts;
}

function defaultManyStyle(): RelationshipEndStyle {
  return {
    raw: "0..M",
    participation: "partial",
    hasArrow: false,
  };
}

function resolveRelationshipParticipants(
  name: string,
  state: RelationshipBlockParseState,
  lineNumber: number,
  errors: ParseIssue[],
): RelationshipParticipantModel[] {
  const participantCount = state.participantNames.length;

  if (participantCount === 0) {
    errors.push({
      line: lineNumber,
      message:
        `Relationship "${name}" must declare its participants using "- A -> B" or "- A -> B -> C".`,
    });
    return [];
  }

  if (participantCount !== 2 && participantCount !== 3) {
    errors.push({
      line: state.participantLineNumber ?? lineNumber,
      message:
        `Relationship "${name}" currently supports only binary or ternary participant lines.`,
    });
    return [];
  }

  const duplicateParticipant = state.participantNames.find(
    (participant, index) =>
      state.participantNames.findIndex(
        (candidate) => candidate.toLowerCase() === participant.toLowerCase(),
      ) !== index,
  );

  if (duplicateParticipant) {
    errors.push({
      line: state.participantLineNumber ?? lineNumber,
      message: `Relationship "${name}" cannot list "${duplicateParticipant}" more than once.`,
    });
  }

  if (participantCount === 3) {
    if (
      state.leftParticipation !== null ||
      state.rightParticipation !== null ||
      state.leftArrow !== null ||
      state.rightArrow !== null
    ) {
      errors.push({
        line: lineNumber,
        message:
          `Ternary relationship "${name}" must use participant names for constraints, not left/right.`,
      });
    }

    if (state.legacyCardinality) {
      errors.push({
        line: lineNumber,
        message:
          `Ternary relationship "${name}" cannot use legacy "- cardinality: ..." syntax. Use participant names instead.`,
      });
    }

    return state.participantNames.map((participantName) => ({
      entity: participantName,
      endStyle: state.participantStylesByName.get(participantName.toLowerCase()) ?? defaultManyStyle(),
    }));
  }

  const [leftParticipant, rightParticipant] = state.participantNames;
  const hasNamedStyles = state.participantStylesByName.size > 0;
  const hasSideStyles =
    state.leftParticipation !== null ||
    state.rightParticipation !== null ||
    state.leftArrow !== null ||
    state.rightArrow !== null;

  if (hasNamedStyles && hasSideStyles) {
    errors.push({
      line: lineNumber,
      message:
        `Binary relationship "${name}" cannot mix named participant constraints with left/right syntax.`,
    });
  }

  let leftStyle = state.participantStylesByName.get(leftParticipant.toLowerCase()) ?? null;
  let rightStyle = state.participantStylesByName.get(rightParticipant.toLowerCase()) ?? null;

  if (!hasNamedStyles) {
    if (state.leftParticipation !== null || state.leftArrow !== null) {
      if (state.leftParticipation === null || state.leftArrow === null) {
        errors.push({
          line: lineNumber,
          message: `Relationship "${name}" must define both "left participation" and "left arrow".`,
        });
      } else {
        leftStyle = {
          raw: `${state.leftParticipation} ${state.leftArrow ? "one" : "many"}`,
          participation: state.leftParticipation,
          hasArrow: state.leftArrow,
        };
      }
    }

    if (state.rightParticipation !== null || state.rightArrow !== null) {
      if (state.rightParticipation === null || state.rightArrow === null) {
        errors.push({
          line: lineNumber,
          message: `Relationship "${name}" must define both "right participation" and "right arrow".`,
        });
      } else {
        rightStyle = {
          raw: `${state.rightParticipation} ${state.rightArrow ? "one" : "many"}`,
          participation: state.rightParticipation,
          hasArrow: state.rightArrow,
        };
      }
    }
  }

  if (!leftStyle || !rightStyle) {
    if (state.legacyCardinality) {
      leftStyle = leftStyle ?? mapLegacyCardinalityToEndStyle(state.legacyCardinality.source);
      rightStyle = rightStyle ?? mapLegacyCardinalityToEndStyle(state.legacyCardinality.target);
    }
  }

  if (!leftStyle || !rightStyle) {
    errors.push({
      line: lineNumber,
      message:
        `Binary relationship "${name}" must define both ends using left/right, participant names, or "- cardinality: 1:N".`,
    });
  }

  return [
    {
      entity: leftParticipant,
      endStyle: leftStyle ?? defaultManyStyle(),
    },
    {
      entity: rightParticipant,
      endStyle: rightStyle ?? defaultManyStyle(),
    },
  ];
}

function parseRelationshipBlock(
  name: string,
  lines: SourceLine[],
  relationshipIndex: number,
  kind: RelationshipKind,
  errors: ParseIssue[],
): RelationshipModel {
  const relationshipId = `relationship-${slugify(name, `relationship-${relationshipIndex + 1}`)}`;
  const state: RelationshipBlockParseState = {
    participantNames: [],
    participantLineNumber: null,
    participantStylesByName: new Map<string, RelationshipEndStyle>(),
    leftParticipation: null,
    rightParticipation: null,
    leftArrow: null,
    rightArrow: null,
    legacyCardinality: null,
    attributes: [],
  };

  let currentIndex = 0;

  while (currentIndex < lines.length) {
    const line = lines[currentIndex];

    if (!line.trimmed) {
      currentIndex += 1;
      continue;
    }

    const participantChain = parseParticipantChain(line);

    if (participantChain) {
      if (participantChain.length < 2 || participantChain.length > 3) {
        errors.push({
          line: line.lineNumber,
          message:
            `Relationship "${name}" must declare either two participants ("A -> B") or three participants ("A -> B -> C").`,
        });
      } else if (state.participantNames.length > 0) {
        errors.push({
          line: line.lineNumber,
          message: `Relationship "${name}" can only declare its participant chain once.`,
        });
      } else {
        state.participantNames = participantChain;
        state.participantLineNumber = line.lineNumber;
      }

      currentIndex += 1;
      continue;
    }

    const cardinalityMatch = line.trimmed.match(/^-\s*cardinality\s*:\s*(.+)$/i);
    if (cardinalityMatch) {
      state.legacyCardinality = parseCardinality(cardinalityMatch[1].trim(), line.lineNumber, errors);
      currentIndex += 1;
      continue;
    }

    const participationMatch = line.trimmed.match(/^-\s*(left|right)\s+participation\s*:\s*(.+)$/i);
    if (participationMatch) {
      const side = participationMatch[1].toLowerCase() as "left" | "right";
      const parsed = normalizeParticipation(participationMatch[2]);

      if (!parsed) {
        errors.push({
          line: line.lineNumber,
          message: `Invalid ${side} participation "${participationMatch[2].trim()}". Use "partial" or "total".`,
        });
      } else if (side === "left") {
        state.leftParticipation = parsed;
      } else {
        state.rightParticipation = parsed;
      }

      currentIndex += 1;
      continue;
    }

    const arrowMatch = line.trimmed.match(/^-\s*(left|right)\s+arrow\s*:\s*(.+)$/i);
    if (arrowMatch) {
      const side = arrowMatch[1].toLowerCase() as "left" | "right";
      const parsed = normalizeBoolean(arrowMatch[2]);

      if (parsed === null) {
        errors.push({
          line: line.lineNumber,
          message: `Invalid ${side} arrow "${arrowMatch[2].trim()}". Use "true" or "false".`,
        });
      } else if (side === "left") {
        state.leftArrow = parsed;
      } else {
        state.rightArrow = parsed;
      }

      currentIndex += 1;
      continue;
    }

    const sideMatch = line.trimmed.match(/^-\s*(left|right)\s*:\s*(.+)$/i);
    if (sideMatch) {
      const side = sideMatch[1].toLowerCase() as "left" | "right";
      const parsed = parseParticipantEndStyle(sideMatch[2].trim(), line.lineNumber, side, errors);

      if (parsed) {
        if (side === "left") {
          state.participantStylesByName.set("__left__", parsed);
        } else {
          state.participantStylesByName.set("__right__", parsed);
        }
      }

      currentIndex += 1;
      continue;
    }

    const namedMatch = line.trimmed.match(/^-\s*([^:]+?)\s*:\s*(.+)$/);
    if (namedMatch) {
      const participantName = namedMatch[1].trim();
      const parsed = parseParticipantEndStyle(
        namedMatch[2].trim(),
        line.lineNumber,
        participantName,
        errors,
      );

      if (parsed) {
        state.participantStylesByName.set(participantName.toLowerCase(), parsed);
      }

      currentIndex += 1;
      continue;
    }

    if (line.trimmed.startsWith("-")) {
      const attribute = parseAttributeLine(
        line,
        relationshipId,
        "attributes",
        state.attributes.length,
        errors,
      );
      currentIndex += 1;

      if (!attribute) {
        continue;
      }

      let nextMeaningfulIndex = currentIndex;

      while (nextMeaningfulIndex < lines.length && !lines[nextMeaningfulIndex].trimmed) {
        nextMeaningfulIndex += 1;
      }

      if (
        nextMeaningfulIndex < lines.length &&
        !isHeaderLine(lines[nextMeaningfulIndex]) &&
        lines[nextMeaningfulIndex].indent > line.indent
      ) {
        if (!attribute.isComposite) {
          errors.push({
            line: lines[nextMeaningfulIndex].lineNumber,
            message: `Only composite attributes can contain nested child attributes. "${attribute.name}" should be marked "(composite)".`,
          });
        }

        const childPath = `attributes-${slugify(attribute.name, `attribute-${state.attributes.length + 1}`)}`;
        const childResult = parseAttributeList(
          lines,
          nextMeaningfulIndex,
          lines[nextMeaningfulIndex].indent,
          relationshipId,
          childPath,
          errors,
        );

        attribute.children = childResult.attributes;
        currentIndex = childResult.nextIndex;
      }

      state.attributes.push(attribute);
      continue;
    }

    errors.push({
      line: line.lineNumber,
      message:
        `Unrecognized relationship line "${line.trimmed}". ` +
        `Use a participant chain, a constraint line, or a relationship attribute.`,
    });
    currentIndex += 1;
  }

  if (state.participantStylesByName.has("__left__") || state.participantStylesByName.has("__right__")) {
    const leftNamed = state.participantStylesByName.get("__left__") ?? null;
    const rightNamed = state.participantStylesByName.get("__right__") ?? null;
    state.participantStylesByName.delete("__left__");
    state.participantStylesByName.delete("__right__");

    if (state.participantNames.length === 2) {
      if (leftNamed) {
        state.participantStylesByName.set(state.participantNames[0].toLowerCase(), leftNamed);
      }

      if (rightNamed) {
        state.participantStylesByName.set(state.participantNames[1].toLowerCase(), rightNamed);
      }
    } else {
      errors.push({
        line: state.participantLineNumber ?? 1,
        message:
          `Ternary relationship "${name}" must use participant names for constraints, not "left" and "right".`,
      });
    }
  }

  const participants = resolveRelationshipParticipants(
    name,
    state,
    lines.find((line) => line.trimmed)?.lineNumber ?? 1,
    errors,
  );

  return {
    id: relationshipId,
    name,
    kind,
    participants,
    attributes: state.attributes,
    legacyCardinality: state.legacyCardinality,
  };
}

export function parseDiagram(input: string): ParseResult {
  const sourceLines = input.split(/\r?\n/).map((line, index) => normalizeLine(line, index + 1));
  const errors: ParseIssue[] = [];
  const entities: EntityModel[] = [];
  const relationships: RelationshipModel[] = [];
  const entityHeaderLines = new Map<string, number>();
  const relationshipHeaderLines = new Map<string, number>();
  let currentIndex = 0;

  while (currentIndex < sourceLines.length) {
    const line = sourceLines[currentIndex];

    if (!line.trimmed) {
      currentIndex += 1;
      continue;
    }

    const header = matchHeader(line);

    if (!header) {
      errors.push({
        line: line.lineNumber,
        message:
          'Expected "Entity: <name>", "WeakEntity: <name>", "Relationship: <name>", or "IdentifyingRelationship: <name>".',
      });
      currentIndex += 1;
      continue;
    }

    if (!header.name) {
      errors.push({
        line: line.lineNumber,
        message: "Section name cannot be empty.",
      });
      currentIndex += 1;
      continue;
    }

    const blockLines: SourceLine[] = [];
    currentIndex += 1;

    while (currentIndex < sourceLines.length && !isHeaderLine(sourceLines[currentIndex])) {
      blockLines.push(sourceLines[currentIndex]);
      currentIndex += 1;
    }

    if (header.kind === "entity" || header.kind === "weak-entity") {
      const entity = parseEntityBlock(
        header.name,
        blockLines,
        entities.length,
        header.kind === "weak-entity" ? "weak" : "strong",
        errors,
      );
      entities.push(entity);
      entityHeaderLines.set(entity.id, line.lineNumber);

      if (!blockLines.some((item) => item.trimmed)) {
        errors.push({
          line: line.lineNumber,
          message: `${header.kind === "weak-entity" ? "Weak entity" : "Entity"} "${header.name}" has no attribute lines.`,
        });
      }

      continue;
    }

    const relationship = parseRelationshipBlock(
      header.name,
      blockLines,
      relationships.length,
      header.kind === "identifying-relationship" ? "identifying" : "regular",
      errors,
    );
    relationships.push(relationship);
    relationshipHeaderLines.set(relationship.id, line.lineNumber);

    if (!blockLines.some((item) => item.trimmed)) {
      errors.push({
        line: line.lineNumber,
        message: `Relationship "${header.name}" has no body lines.`,
      });
    }
  }

  const entityNameLookup = new Map<string, string>();

  for (const entity of entities) {
    const key = entity.name.toLowerCase();

    if (entityNameLookup.has(key)) {
      errors.push({
        line: entityHeaderLines.get(entity.id) ?? 1,
        message: `Duplicate entity "${entity.name}" found. Use unique entity names.`,
      });
      continue;
    }

    entityNameLookup.set(key, entity.id);
  }

  for (const relationship of relationships) {
    relationship.participants.forEach((participant) => {
      if (!entityNameLookup.has(participant.entity.toLowerCase())) {
        errors.push({
          line: relationshipHeaderLines.get(relationship.id) ?? 1,
          message:
            `Relationship "${relationship.name}" references missing entity "${participant.entity}".`,
        });
      }
    });
  }

  if (entities.length === 0) {
    errors.push({
      line: 1,
      message: "Add at least one entity or weak entity to generate a diagram.",
    });
  }

  if (errors.length > 0) {
    return {
      model: null,
      errors,
    };
  }

  const model: DiagramModel = {
    entities,
    relationships,
  };

  return {
    model,
    errors: [],
  };
}
