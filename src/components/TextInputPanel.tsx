interface TextInputPanelProps {
  value: string;
  onChange: (value: string) => void;
}

const syntaxLines = [
  'Use "Entity: Name" or "WeakEntity: Name".',
  'Use "Relationship: Name" or "IdentifyingRelationship: Name".',
  'Add attributes with "- AttributeName" and markers like "(key)", "(partial-key)", "(multivalued)", "(derived)", "(composite)".',
  'Preferred relationship syntax: "- left participation: total|partial" and "- left arrow: true|false".',
  'Backward compatibility still supports "- cardinality: 1:N" and compact forms like "- left: total one", "- right: 0..m", or "- right: 0 to m".',
];

const notationLines = [
  "Single line = partial participation.",
  "Double line = total participation.",
  "Arrow at an entity end = one-side / key-constrained side.",
  "No arrow = many-side.",
  "Weak entity = double rectangle.",
  "Identifying relationship = double diamond.",
  "Multivalued attribute = double oval.",
  "Derived attribute = dashed oval.",
  "Partial key = dashed underline.",
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
          'Relationship: EnrolledIn\n- Student -> Course\n- left participation: total\n- left arrow: false\n- right participation: partial\n- right arrow: true'
        }
        aria-label="Chen diagram source input"
      />

      <div className="helper-card">
        <h3>Syntax guide</h3>
        <ul className="helper-list">
          {syntaxLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="helper-card">
        <h3>Notation guide</h3>
        <ul className="helper-list">
          {notationLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
