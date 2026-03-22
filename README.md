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
Entity: Library
- LibraryID (key)
- Name
- Address

Entity: Book
- ISBN (key)
- Title
- Genre

Entity: Member
- MemberID (key)
- FullName
- Email

Relationship: Registers
- Library -> Member
- left: 0..m
- right: 1..1

Relationship: Stores
- Library -> Book
- left: 1..m
- right: 0..m

Relationship: Supervises
- Member -> Member
- left: 0..m
- right: 0..1
- left role: Supervisor
- right role: Subordinate
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

The preferred syntax is min/max cardinality at each end:

```text
- left: 0..1
- right: 1..m
```

The parser also accepts the same form written with `to`:

```text
- left: 0 to 1
- right: 1 to m
```

These values drive the rendering automatically:

- `min = 0` -> single line
- `min = 1` -> double line
- `max = 1` -> arrow toward the relationship diamond
- `max = m` -> no arrow

Examples:

- `0..m` = single line + no arrow
- `1..m` = double line + no arrow
- `0..1` = single line + arrow
- `1..1` = double line + arrow

For ternary relationships, use named constraints:

```text
Relationship: Borrows
- Library -> Book -> Member
- Library: 0..m
- Book: 0..m
- Member: 0..m
```

For self relationships, use the normal binary syntax:

```text
Relationship: Supervises
- Employee -> Employee
- left: 0..m
- right: 0..1
- left role: Supervisor
- right role: Subordinate
```

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

3. Legacy cardinality syntax:

```text
- cardinality: 1:N
```

Legacy mapping:

- `1` side -> `0..1`
- `M` / `N` side -> `0..m`
- legacy cardinality does not specify total participation, so both ends default to `min = 0`

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

For self relationships, the renderer draws two separate ends from the same entity to the same relationship diamond so the two endpoint constraints remain distinct.

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
- Older `left/right participation` and `left/right arrow` lines are still accepted and converted internally to min/max constraints.

## Notes

- The layout is deterministic and browser-only.
- The app is designed as a clean student/demo-friendly MVP.
