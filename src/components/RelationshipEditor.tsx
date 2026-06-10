import { AttributeListEditor } from "./EntityEditor";
import type {
  StructuredEntity,
  StructuredRelationship,
  StructuredRelationshipDegree,
  StructuredRelationshipParticipant,
} from "../types/structured";
import { ensureRelationshipDegreeShape } from "../utils/structuredModel";

interface RelationshipEditorProps {
  relationship: StructuredRelationship;
  entities: StructuredEntity[];
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (relationship: StructuredRelationship) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

interface ParticipantEditorProps {
  participant: StructuredRelationshipParticipant;
  entities: StructuredEntity[];
  label: string;
  hideEntitySelect?: boolean;
  showRoleName?: boolean;
  onChange: (participant: StructuredRelationshipParticipant) => void;
}

function participantLabel(index: number): string {
  return index === 0 ? "Left participant" : index === 1 ? "Right participant" : "Third participant";
}

function degreeLabel(degree: StructuredRelationshipDegree): string {
  if (degree === "unary") {
    return "Unary / recursive";
  }

  if (degree === "ternary") {
    return "Ternary";
  }

  return "Binary";
}

function ParticipantEditor({
  participant,
  entities,
  label,
  hideEntitySelect = false,
  showRoleName = false,
  onChange,
}: ParticipantEditorProps) {
  return (
    <div className="participant-card">
      <div className="participant-card__title">{label}</div>

      {hideEntitySelect ? null : (
        <label className="field">
          <span>Entity</span>
          <select
            value={participant.entityId}
            onChange={(event) =>
              onChange({
                ...participant,
                entityId: event.target.value,
              })
            }
          >
            <option value="">Choose entity</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name || "Unnamed entity"}
              </option>
            ))}
          </select>
        </label>
      )}

      {showRoleName ? (
        <label className="field">
          <span>Role name</span>
          <input
            value={participant.roleName}
            onChange={(event) =>
              onChange({
                ...participant,
                roleName: event.target.value,
              })
            }
            placeholder="e.g. Supervisor"
          />
        </label>
      ) : null}

      <div className="builder-grid builder-grid--compact">
        <label className="field">
          <span>Cardinality</span>
          <select
            value={participant.cardinality}
            onChange={(event) =>
              onChange({
                ...participant,
                cardinality: event.target.value === "one" ? "one" : "many",
              })
            }
          >
            <option value="one">One</option>
            <option value="many">Many</option>
          </select>
        </label>

        <label className="field">
          <span>Participation</span>
          <select
            value={participant.participation}
            onChange={(event) =>
              onChange({
                ...participant,
                participation: event.target.value === "mandatory" ? "mandatory" : "optional",
              })
            }
          >
            <option value="optional">Optional</option>
            <option value="mandatory">Mandatory</option>
          </select>
        </label>
      </div>
    </div>
  );
}

export function RelationshipEditor({
  relationship,
  entities,
  index,
  canMoveUp,
  canMoveDown,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: RelationshipEditorProps) {
  const normalizedRelationship = ensureRelationshipDegreeShape(relationship);

  const updateParticipant = (
    participantIndex: number,
    participant: StructuredRelationshipParticipant,
  ) => {
    const participants = normalizedRelationship.participants.map((current, index) =>
      index === participantIndex ? participant : current,
    );

    onChange({
      ...normalizedRelationship,
      participants,
    });
  };

  const updateDegree = (degree: StructuredRelationshipDegree) => {
    const nextRelationship = ensureRelationshipDegreeShape({
      ...normalizedRelationship,
      degree,
    });

    if (degree === "unary") {
      const entityId = nextRelationship.participants[0]?.entityId ?? "";
      nextRelationship.participants = nextRelationship.participants.map((participant) => ({
        ...participant,
        entityId,
      }));
    }

    onChange(nextRelationship);
  };

  const updateUnaryEntity = (entityId: string) => {
    onChange({
      ...normalizedRelationship,
      participants: normalizedRelationship.participants.map((participant) => ({
        ...participant,
        entityId,
      })),
    });
  };

  return (
    <article className="builder-card">
      <div className="builder-card__header">
        <div>
          <span className="builder-card__kicker">
            {degreeLabel(normalizedRelationship.degree)} relationship {index + 1}
          </span>
          <h3>{relationship.name || "Unnamed relationship"}</h3>
        </div>
        <div className="builder-card__actions">
          <button className="mini-button" disabled={!canMoveUp} type="button" onClick={onMoveUp}>
            Up
          </button>
          <button className="mini-button" disabled={!canMoveDown} type="button" onClick={onMoveDown}>
            Down
          </button>
          <button className="mini-button mini-button--danger" type="button" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>

      <div className="builder-grid">
        <label className="field">
          <span>Relationship name</span>
          <input
            value={relationship.name}
            onChange={(event) =>
              onChange({
                ...normalizedRelationship,
                name: event.target.value,
              })
            }
            placeholder="e.g. Registers"
          />
        </label>

        <label className="field">
          <span>Degree</span>
          <select
            value={normalizedRelationship.degree}
            onChange={(event) => updateDegree(event.target.value as StructuredRelationshipDegree)}
          >
            <option value="unary">Unary / recursive</option>
            <option value="binary">Binary</option>
            <option value="ternary">Ternary</option>
          </select>
        </label>

        <label className="field">
          <span>Relationship type</span>
          <select
            value={normalizedRelationship.kind}
            onChange={(event) =>
              onChange({
                ...normalizedRelationship,
                kind: event.target.value === "identifying" ? "identifying" : "regular",
              })
            }
          >
            <option value="regular">Regular relationship</option>
            <option value="identifying">Identifying relationship</option>
          </select>
        </label>
      </div>

      {normalizedRelationship.degree === "unary" ? (
        <div className="relationship-section">
          <label className="field">
            <span>Recursive entity</span>
            <select
              value={normalizedRelationship.participants[0]?.entityId ?? ""}
              onChange={(event) => updateUnaryEntity(event.target.value)}
            >
              <option value="">Choose entity</option>
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name || "Unnamed entity"}
                </option>
              ))}
            </select>
          </label>

          <div className="participant-grid">
            {normalizedRelationship.participants.map((participant, participantIndex) => (
              <ParticipantEditor
                entities={entities}
                hideEntitySelect
                key={participant.id}
                label={participantIndex === 0 ? "Left role end" : "Right role end"}
                participant={participant}
                showRoleName
                onChange={(nextParticipant) => {
                  updateParticipant(participantIndex, {
                    ...nextParticipant,
                    entityId: normalizedRelationship.participants[0]?.entityId ?? nextParticipant.entityId,
                  });
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="participant-grid">
          {normalizedRelationship.participants.map((participant, participantIndex) => (
            <ParticipantEditor
              entities={entities}
              key={participant.id}
              label={participantLabel(participantIndex)}
              participant={participant}
              onChange={(nextParticipant) => updateParticipant(participantIndex, nextParticipant)}
            />
          ))}
        </div>
      )}

      <div className="relationship-note">
        <strong>Course note:</strong> cardinality says one vs many. Participation says
        optional vs mandatory. The diagram needs both.
      </div>

      <AttributeListEditor
        attributes={normalizedRelationship.attributes}
        ownerLabel={relationship.name || "this relationship"}
        onChange={(attributes) =>
          onChange({
            ...normalizedRelationship,
            attributes,
          })
        }
      />
    </article>
  );
}
