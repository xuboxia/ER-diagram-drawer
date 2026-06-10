import type { StructuredAttribute, StructuredEntity } from "../types/structured";
import { createStructuredAttribute } from "../utils/structuredModel";

interface AttributeListEditorProps {
  attributes: StructuredAttribute[];
  onChange: (attributes: StructuredAttribute[]) => void;
  ownerLabel: string;
  depth?: number;
}

interface EntityEditorProps {
  entity: StructuredEntity;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (entity: StructuredEntity) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
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

export function AttributeListEditor({
  attributes,
  onChange,
  ownerLabel,
  depth = 0,
}: AttributeListEditorProps) {
  const updateAttribute = (attributeId: string, nextAttribute: StructuredAttribute) => {
    onChange(attributes.map((attribute) => (attribute.id === attributeId ? nextAttribute : attribute)));
  };

  const addAttribute = () => {
    onChange([...attributes, createStructuredAttribute()]);
  };

  const removeAttribute = (attributeId: string) => {
    onChange(attributes.filter((attribute) => attribute.id !== attributeId));
  };

  return (
    <div className={`attribute-list attribute-list--depth-${depth}`}>
      <div className="builder-subhead">
        <span>{depth === 0 ? "Attributes" : "Child attributes"}</span>
        <button className="mini-button" type="button" onClick={addAttribute}>
          + Add attribute
        </button>
      </div>

      {attributes.length === 0 ? (
        <p className="builder-empty">No attributes yet for {ownerLabel}.</p>
      ) : null}

      {attributes.map((attribute, index) => (
        <article className="attribute-row" key={attribute.id}>
          <div className="attribute-row__main">
            <label className="field">
              <span>Attribute name</span>
              <input
                value={attribute.name}
                onChange={(event) =>
                  updateAttribute(attribute.id, {
                    ...attribute,
                    name: event.target.value,
                  })
                }
                placeholder="e.g. LibraryID"
              />
            </label>

            <div className="attribute-row__actions">
              <button
                className="mini-button"
                disabled={index === 0}
                type="button"
                onClick={() => onChange(moveItem(attributes, index, -1))}
              >
                Up
              </button>
              <button
                className="mini-button"
                disabled={index === attributes.length - 1}
                type="button"
                onClick={() => onChange(moveItem(attributes, index, 1))}
              >
                Down
              </button>
              <button
                className="mini-button mini-button--danger"
                type="button"
                onClick={() => removeAttribute(attribute.id)}
              >
                Remove
              </button>
            </div>
          </div>

          <div className="flag-grid">
            <label>
              <input
                checked={attribute.isKey}
                type="checkbox"
                onChange={(event) =>
                  updateAttribute(attribute.id, {
                    ...attribute,
                    isKey: event.target.checked,
                    isPartialKey: event.target.checked ? false : attribute.isPartialKey,
                  })
                }
              />
              Key / identifier
            </label>
            <label>
              <input
                checked={attribute.isPartialKey}
                type="checkbox"
                onChange={(event) =>
                  updateAttribute(attribute.id, {
                    ...attribute,
                    isPartialKey: event.target.checked,
                    isKey: event.target.checked ? false : attribute.isKey,
                  })
                }
              />
              Partial key
            </label>
            <label>
              <input
                checked={attribute.isDerived}
                type="checkbox"
                onChange={(event) =>
                  updateAttribute(attribute.id, {
                    ...attribute,
                    isDerived: event.target.checked,
                  })
                }
              />
              Derived
            </label>
            <label>
              <input
                checked={attribute.isMultivalued}
                type="checkbox"
                onChange={(event) =>
                  updateAttribute(attribute.id, {
                    ...attribute,
                    isMultivalued: event.target.checked,
                  })
                }
              />
              Multivalued
            </label>
            <label>
              <input
                checked={attribute.isComposite}
                type="checkbox"
                onChange={(event) =>
                  updateAttribute(attribute.id, {
                    ...attribute,
                    isComposite: event.target.checked,
                    children: event.target.checked ? attribute.children : [],
                  })
                }
              />
              Composite
            </label>
            <label className="field field--inline">
              <span>Attribute participation</span>
              <select
                value={attribute.isOptional ? "optional" : "mandatory"}
                onChange={(event) =>
                  updateAttribute(attribute.id, {
                    ...attribute,
                    isOptional: event.target.value === "optional",
                  })
                }
              >
                <option value="mandatory">Mandatory</option>
                <option value="optional">Optional</option>
              </select>
            </label>
          </div>

          {attribute.isComposite ? (
            <AttributeListEditor
              attributes={attribute.children}
              depth={depth + 1}
              ownerLabel={`composite attribute ${attribute.name || "UnnamedAttribute"}`}
              onChange={(children) =>
                updateAttribute(attribute.id, {
                  ...attribute,
                  children,
                })
              }
            />
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function EntityEditor({
  entity,
  index,
  canMoveUp,
  canMoveDown,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: EntityEditorProps) {
  return (
    <article className="builder-card">
      <div className="builder-card__header">
        <div>
          <span className="builder-card__kicker">Entity {index + 1}</span>
          <h3>{entity.name || "Unnamed entity"}</h3>
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
          <span>Entity name</span>
          <input
            value={entity.name}
            onChange={(event) =>
              onChange({
                ...entity,
                name: event.target.value,
              })
            }
            placeholder="e.g. Library"
          />
        </label>

        <label className="field">
          <span>Entity type</span>
          <select
            value={entity.kind}
            onChange={(event) =>
              onChange({
                ...entity,
                kind: event.target.value === "weak" ? "weak" : "strong",
              })
            }
          >
            <option value="strong">Strong entity</option>
            <option value="weak">Weak entity</option>
          </select>
        </label>
      </div>

      <AttributeListEditor
        attributes={entity.attributes}
        ownerLabel={entity.name || "this entity"}
        onChange={(attributes) =>
          onChange({
            ...entity,
            attributes,
          })
        }
      />
    </article>
  );
}
