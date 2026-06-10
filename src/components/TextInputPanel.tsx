interface TextInputPanelProps {
  value: string;
  onChange: (value: string) => void;
}

const syntaxSections = [
  {
    title: "1. Define entities",
    description: "Start each object with Entity or WeakEntity, then list its attributes below.",
    example: "Entity: Library\n- LibraryID (key)\n- Name\n- Address",
  },
  {
    title: "2. Mark attributes",
    description: "Add simple markers in parentheses when an attribute needs Chen notation styling.",
    example: "- Email\n- Address (composite)\n- PhoneNumber (multivalued)\n- Age (derived)",
  },
  {
    title: "3. Connect entities",
    description: "Use Relationship blocks for binary, ternary, and recursive relationships.",
    example:
      "Relationship: Registers\n- Library -> Member\n\nRelationship: Supervises\n- Employee -> Employee",
  },
  {
    title: "4. Add constraints",
    description: "Use min..max ranges. The renderer infers line weight and arrows automatically.",
    example: "- left: 0..m\n- right: 1..1\n- left role: Supervisor\n- right role: Subordinate",
  },
];

const constraintCards = [
  {
    value: "0..m",
    meaning: "Optional many",
    visual: "thin line, no arrow",
  },
  {
    value: "1..m",
    meaning: "Mandatory many",
    visual: "thick line, no arrow",
  },
  {
    value: "0..1",
    meaning: "Optional one",
    visual: "thin line, arrow",
  },
  {
    value: "1..1",
    meaning: "Mandatory one",
    visual: "thick line, arrow",
  },
];

export function TextInputPanel({ value, onChange }: TextInputPanelProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Structured Input</p>
          <h2>Diagram Source</h2>
        </div>
        <span className="panel__badge">Plain text</span>
      </div>

      <p className="panel__description">
        Type Chen / EER entities, attributes, and relationships in a compact text format.
        The preview updates automatically and can also be refreshed with the generate
        button.
      </p>

      <textarea
        className="editor"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          'Relationship: Supervises\n- Employee -> Employee\n- left: 0..m\n- right: 0..1\n- left role: Supervisor\n- right role: Subordinate'
        }
        aria-label="Chen diagram source input"
      />

      <div className="helper-card">
        <h3>Syntax guide</h3>
        <div className="syntax-guide">
          {syntaxSections.map((section) => (
            <article className="syntax-step" key={section.title}>
              <h4>{section.title}</h4>
              <p>{section.description}</p>
              <pre className="syntax-example">
                <code>{section.example}</code>
              </pre>
            </article>
          ))}
        </div>
      </div>

      <div className="helper-card">
        <h3>Constraint cheat sheet</h3>
        <div className="notation-grid">
          {constraintCards.map((card) => (
            <article className="notation-card" key={card.value}>
              <strong>{card.value}</strong>
              <span>{card.meaning}</span>
              <small>{card.visual}</small>
            </article>
          ))}
        </div>
        <p className="helper-footnote">
          Rule of thumb: min = 1 means total participation, rendered as a thicker line.
          max = 1 adds an arrow toward the relationship diamond.
        </p>
      </div>
    </section>
  );
}
