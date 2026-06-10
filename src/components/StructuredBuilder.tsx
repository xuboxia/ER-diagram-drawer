import { useState } from "react";
import { EntityEditor } from "./EntityEditor";
import { RelationshipEditor } from "./RelationshipEditor";
import {
  cloneStructuredModel,
  DEFAULT_STRUCTURED_PRESET_ID,
  STRUCTURED_PRESETS,
} from "../data/structuredPresets";
import type { StructuredDiagramModel, StructuredValidationIssue } from "../types/structured";
import {
  createStructuredEntity,
  createStructuredRelationship,
  normalizeStructuredModel,
} from "../utils/structuredModel";

interface StructuredBuilderProps {
  model: StructuredDiagramModel;
  generatedSource: string;
  validationIssues: StructuredValidationIssue[];
  onChange: (model: StructuredDiagramModel) => void;
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  const [item] = nextItems.splice(index, 1);
  nextItems.splice(nextIndex, 0, item);
  return nextItems;
}

async function copyText(value: string): Promise<boolean> {
  if (!navigator.clipboard) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function StructuredBuilder({
  model,
  generatedSource,
  validationIssues,
  onChange,
}: StructuredBuilderProps) {
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_STRUCTURED_PRESET_ID);
  const [jsonDraft, setJsonDraft] = useState("");
  const [builderNotice, setBuilderNotice] = useState("");
  const errors = validationIssues.filter((issue) => issue.severity === "error");
  const warnings = validationIssues.filter((issue) => issue.severity === "warning");

  const updateEntities = (entities: StructuredDiagramModel["entities"]) => {
    onChange({
      ...model,
      entities,
    });
  };

  const updateRelationships = (relationships: StructuredDiagramModel["relationships"]) => {
    onChange({
      ...model,
      relationships,
    });
  };

  const removeEntity = (entityId: string) => {
    onChange({
      ...model,
      entities: model.entities.filter((entity) => entity.id !== entityId),
      relationships: model.relationships.map((relationship) => ({
        ...relationship,
        participants: relationship.participants.map((participant) =>
          participant.entityId === entityId
            ? {
                ...participant,
                entityId: "",
              }
            : participant,
        ),
      })),
    });
  };

  const loadPreset = () => {
    const preset = STRUCTURED_PRESETS.find((item) => item.id === selectedPresetId);

    if (!preset) {
      return;
    }

    onChange(cloneStructuredModel(preset.model));
    setBuilderNotice(`Loaded preset: ${preset.name}.`);
  };

  const importJson = () => {
    try {
      const parsed = JSON.parse(jsonDraft);
      const normalized = normalizeStructuredModel(parsed);

      if (!normalized) {
        setBuilderNotice("JSON import failed: expected a structured diagram object.");
        return;
      }

      onChange(normalized);
      setBuilderNotice("Structured JSON imported.");
    } catch {
      setBuilderNotice("JSON import failed: paste valid JSON first.");
    }
  };

  const exportJson = async () => {
    const json = JSON.stringify(model, null, 2);
    setJsonDraft(json);
    const copied = await copyText(json);
    setBuilderNotice(copied ? "Structured JSON copied." : "Structured JSON placed in the box below.");
  };

  const copySource = async () => {
    const copied = await copyText(generatedSource);
    setBuilderNotice(copied ? "Generated source copied." : "Generated source is ready to select and copy.");
  };

  return (
    <section className="panel structured-builder">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Structured Builder</p>
          <h2>Build The Model</h2>
        </div>
        <span className="panel__badge">Default mode</span>
      </div>

      <p className="panel__description">
        Add entities, attributes, relationships, cardinality, and participation explicitly.
        The builder formats your choices into the same source syntax used by Plain Text mode.
      </p>

      <div className="builder-callout">
        <strong>No automatic modelling:</strong> this tool does not infer conceptual design
        choices from prose. You still decide the entities, identifiers, participation, and
        cardinalities.
      </div>

      <div className="preset-row">
        <label className="field">
          <span>Example presets</span>
          <select value={selectedPresetId} onChange={(event) => setSelectedPresetId(event.target.value)}>
            {STRUCTURED_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button button--secondary" type="button" onClick={loadPreset}>
          Load Preset
        </button>
      </div>

      <div className="helper-strip">
        <article>
          <strong>Entity</strong>
          <span>A thing type in the domain, such as Library or Book.</span>
        </article>
        <article>
          <strong>Key</strong>
          <span>An identifier attribute used to distinguish entity instances.</span>
        </article>
        <article>
          <strong>Relationship</strong>
          <span>An association among one, two, or three entities.</span>
        </article>
        <article>
          <strong>Participation</strong>
          <span>Optional means min 0; mandatory means min 1.</span>
        </article>
        <article>
          <strong>Cardinality</strong>
          <span>One means max 1; many means max m.</span>
        </article>
      </div>

      {validationIssues.length > 0 ? (
        <div className="builder-validation">
          {errors.length > 0 ? <h3>Fix before rendering cleanly</h3> : <h3>Modelling checks</h3>}
          <ul>
            {validationIssues.map((issue) => (
              <li className={`builder-validation__${issue.severity}`} key={issue.id}>
                <strong>{issue.severity === "error" ? "Error:" : "Warning:"}</strong> {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="builder-validation builder-validation--ok">
          No structured-model warnings. The generated source is ready for the parser.
        </div>
      )}

      <div className="builder-section-header">
        <div>
          <p className="eyebrow">Step 1</p>
          <h3>Entities</h3>
        </div>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => updateEntities([...model.entities, createStructuredEntity()])}
        >
          + Add Entity
        </button>
      </div>

      <div className="builder-stack">
        {model.entities.length === 0 ? (
          <p className="builder-empty">Add at least one entity to start modelling.</p>
        ) : null}
        {model.entities.map((entity, index) => (
          <EntityEditor
            canMoveDown={index < model.entities.length - 1}
            canMoveUp={index > 0}
            entity={entity}
            index={index}
            key={entity.id}
            onChange={(nextEntity) =>
              updateEntities(
                model.entities.map((current) =>
                  current.id === entity.id ? nextEntity : current,
                ),
              )
            }
            onMoveDown={() => updateEntities(moveItem(model.entities, index, 1))}
            onMoveUp={() => updateEntities(moveItem(model.entities, index, -1))}
            onRemove={() => removeEntity(entity.id)}
          />
        ))}
      </div>

      <div className="builder-section-header">
        <div>
          <p className="eyebrow">Step 2</p>
          <h3>Relationships</h3>
        </div>
        <button
          className="button button--secondary"
          type="button"
          onClick={() =>
            updateRelationships([
              ...model.relationships,
              createStructuredRelationship(
                "",
                "binary",
                model.entities.slice(0, 2).map((entity) => entity.id),
              ),
            ])
          }
        >
          + Add Relationship
        </button>
      </div>

      <div className="builder-stack">
        {model.relationships.length === 0 ? (
          <p className="builder-empty">Add relationships when the participating entities are clear.</p>
        ) : null}
        {model.relationships.map((relationship, index) => (
          <RelationshipEditor
            canMoveDown={index < model.relationships.length - 1}
            canMoveUp={index > 0}
            entities={model.entities}
            index={index}
            key={relationship.id}
            relationship={relationship}
            onChange={(nextRelationship) =>
              updateRelationships(
                model.relationships.map((current) =>
                  current.id === relationship.id ? nextRelationship : current,
                ),
              )
            }
            onMoveDown={() => updateRelationships(moveItem(model.relationships, index, 1))}
            onMoveUp={() => updateRelationships(moveItem(model.relationships, index, -1))}
            onRemove={() =>
              updateRelationships(
                model.relationships.filter((current) => current.id !== relationship.id),
              )
            }
          />
        ))}
      </div>

      <div className="generated-source">
        <div className="builder-section-header builder-section-header--compact">
          <div>
            <p className="eyebrow">Generated Source</p>
            <h3>Plain Text Output</h3>
          </div>
          <button className="mini-button" type="button" onClick={copySource}>
            Copy source
          </button>
        </div>
        <textarea className="generated-source__textarea" readOnly value={generatedSource} />
        <p className="helper-footnote">
          Switch to Plain Text if you want to edit this source manually. Attribute optionality
          is stored in JSON but is not emitted because the current Chen renderer has no
          visual optional-attribute marker.
        </p>
      </div>

      <details className="json-tools">
        <summary>Import / export structured JSON</summary>
        <div className="json-tools__actions">
          <button className="mini-button" type="button" onClick={exportJson}>
            Copy JSON
          </button>
          <button className="mini-button" type="button" onClick={importJson}>
            Load pasted JSON
          </button>
        </div>
        <textarea
          className="generated-source__textarea generated-source__textarea--json"
          value={jsonDraft}
          onChange={(event) => setJsonDraft(event.target.value)}
          placeholder="Paste a structured diagram JSON object here."
        />
      </details>

      {builderNotice ? <div className="builder-notice">{builderNotice}</div> : null}

      {warnings.length > 0 && errors.length === 0 ? (
        <p className="helper-footnote">
          Warnings are there to help you review the conceptual model; they do not automatically
          change your modelling choices.
        </p>
      ) : null}
    </section>
  );
}
