# Chen Diagram Generator

A browser-only React + TypeScript app that converts structured text into Chen and EER diagrams rendered with SVG.

## Features

- Two-column editor and preview layout
- Structured text parser for strong entities, weak entities, attributes, and relationships
- Support for key, partial-key, composite, multivalued, and derived attributes
- Support for regular and identifying relationships
- Textbook-style relationship edges with single or double lines plus optional arrows
- Backward compatibility for legacy `1:N` and compact relationship-end syntax
- Deterministic SVG auto-layout
- Friendly parse error messages
- Export as PNG or SVG
- No backend required

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Open the local URL shown by Vite in your browser.

## Build for production

```bash
npm run build
```

The production files will be generated in `dist/`.

## Deploy on Vercel

1. Push this project to a Git repository.
2. Import the repository into [Vercel](https://vercel.com/).
3. Keep the default framework preset as `Vite`.
4. Use the default build command:

```bash
npm run build
```

5. Use the default output directory:

```bash
dist
```

6. Deploy.

Because the app is fully client-side, no backend configuration is required for v1.

## Preferred input syntax

Use sections like this:

```text
Entity: Patient
- PatientID (key)
- FirstName
- LastName
- Phone (multivalued)
- Age (derived)

Entity: Allergy
- Name (key)
- TypicalRemedy

WeakEntity: AllergyEvent
- EventDate (partial-key)
- ReactionDetails

Relationship: SuffersFrom
- Patient -> Allergy
- left participation: total
- left arrow: false
- right participation: partial
- right arrow: true

IdentifyingRelationship: ImplicatedIn
- Allergy -> AllergyEvent
- left participation: partial
- left arrow: false
- right participation: total
- right arrow: true
```

## Section headers

- `Entity: <name>` creates a regular entity.
- `WeakEntity: <name>` creates a weak entity.
- `Relationship: <name>` creates a regular relationship.
- `IdentifyingRelationship: <name>` creates an identifying relationship.

## Attribute markers

- `(key)` renders a key attribute with a solid underline.
- `(partial-key)` and `(weak-key)` render a weak / partial key with a dashed underline.
- `(multivalued)` renders a double oval.
- `(derived)` renders a dashed oval.
- `(composite)` marks a composite attribute that can contain indented child attributes.

Indented child attributes are attached to the composite attribute above them.

## Relationship-end syntax

The preferred explicit syntax is:

```text
- left participation: partial | total
- left arrow: true | false
- right participation: partial | total
- right arrow: true | false
```

Interpretation:

- `participation: partial` = single line
- `participation: total` = double line
- `arrow: true` = arrow at that entity end, meaning the one-side / key-constrained side
- `arrow: false` = no arrow, meaning the many-side

This allows each relationship end to independently represent:

- single line + no arrow = partial many
- double line + no arrow = total many
- single line + arrow = partial one
- double line + arrow = total one

## Compact and legacy compatibility

The parser also accepts:

1. Compact end styles:

```text
- left: total one
- right: partial many
```

2. Range shorthand from the earlier version:

```text
- left: 0..1
- right: 1..m
```

The parser also accepts the same shorthand written with `to`:

```text
- left: 0 to 1
- right: 1 to m
```

These are mapped internally as:

- `0..1` -> partial + arrow
- `1..1` -> total + arrow
- `0..m` -> partial + no arrow
- `1..m` -> total + no arrow

3. Legacy cardinality syntax:

```text
- cardinality: 1:N
```

Legacy mapping:

- `1` side -> arrow
- `M` / `N` side -> no arrow
- legacy cardinality does not specify total participation, so both ends default to partial participation

## Visual mapping

- Entity = rectangle
- Weak entity = double rectangle
- Relationship = diamond
- Identifying relationship = double diamond
- Attribute = oval
- Multivalued attribute = double oval
- Derived attribute = dashed oval
- Key attribute = solid underline
- Partial key attribute = dashed underline
- Composite attribute = parent oval with child ovals
- Partial participation = single line
- Total participation = double line
- One-side / key constraint = arrow at that entity end
- Many-side = no arrow at that entity end

## One-to-one / one-to-many / many-to-many

- One-to-one: arrows on both ends
- One-to-many: arrow on only one end
- Many-to-many: no arrows on either end

Participation is independent from key constraint, so either end can be partial or total while still being one or many.

## Backward compatibility

- Existing `Entity:` and `Relationship:` inputs still work.
- Existing `(key)` and `(composite)` attributes still work.
- Existing `- cardinality: 1:N` style relationships still work.
- Earlier range-based end syntax like `- left: 0..m` still works.

## Notes

- The layout is deterministic and browser-only.
- The app is designed as a clean student/demo-friendly MVP.
