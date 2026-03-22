interface TextInputPanelProps {
  value: string;
  onChange: (value: string) => void;
}

const syntaxLines = [
  'Use "Entity: Name" or "WeakEntity: Name".',
  'Use "Relationship: Name" or "IdentifyingRelationship: Name".',
  'Add attributes with "- AttributeName" and markers like "(key)", "(partial-key)", "(multivalued)", "(derived)", "(composite)".',
  'Relationships can use "- A -> B" or ternary syntax like "- A -> B -> C".',
  'Preferred relationship syntax uses min/max ranges like "- left: 1..m" or "- right: 0 to 1".',
  'Ternary relationships use named constraints like "- Library: 0..m"; binary compatibility still supports "- cardinality: 1:N" and older left/right participation + arrow lines.',
];

const notationLines = [
  "min = 0 draws a single line; min = 1 draws a double line.",
  "max = 1 draws an arrow toward the relationship diamond; max = m draws no arrow.",
  "0..m = single line + no arrow.",
  "1..m = double line + no arrow.",
  "0..1 = single line + arrow.",
  "1..1 = double line + arrow.",
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
          'Relationship: Stores\n- Library -> Book\n- left: 1..m\n- right: 0..m'
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
