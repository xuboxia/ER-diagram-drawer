import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { DiagramCanvas } from "./components/DiagramCanvas";
import { TextInputPanel } from "./components/TextInputPanel";
import { Toolbar } from "./components/Toolbar";
import { EXAMPLE_INPUT } from "./data/exampleInput";
import type { DiagramLayout, DiagramModel, ParseIssue } from "./types/diagram";
import { exportPng, exportSvg } from "./utils/export";
import { createDiagramLayout, recomputeLayoutEdges } from "./utils/layout";
import { parseDiagram } from "./utils/parser";

const DRAFT_STORAGE_KEY = "chen-diagram-generator:draft:v1";

interface SavedDraft {
  inputValue: string;
  zoom: number;
  savedAt: string;
}

type DraggableNodeKind = "entity" | "relationship" | "attribute";

function readSavedDraft(): SavedDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);

    if (!rawDraft) {
      return null;
    }

    const parsedDraft = JSON.parse(rawDraft) as Partial<SavedDraft>;

    if (typeof parsedDraft.inputValue !== "string" || typeof parsedDraft.zoom !== "number") {
      return null;
    }

    return {
      inputValue: parsedDraft.inputValue,
      zoom: parsedDraft.zoom,
      savedAt: typeof parsedDraft.savedAt === "string" ? parsedDraft.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);

  if (Number.isNaN(date.getTime())) {
    return "just now";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function saveDraftToStorage(inputValue: string, zoom: number): SavedDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const draft: SavedDraft = {
      inputValue,
      zoom,
      savedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    return draft;
  } catch {
    return null;
  }
}

function App() {
  const restoredDraft = readSavedDraft();
  const [inputValue, setInputValue] = useState(restoredDraft?.inputValue ?? EXAMPLE_INPUT);
  const [diagramModel, setDiagramModel] = useState<DiagramModel | null>(null);
  const [layout, setLayout] = useState<DiagramLayout | null>(null);
  const [errors, setErrors] = useState<ParseIssue[]>([]);
  const [notice, setNotice] = useState(
    restoredDraft
      ? `Restored saved draft from ${formatSavedAt(restoredDraft.savedAt)}.`
      : "Example loaded. Edit the source to regenerate the diagram.",
  );
  const [zoom, setZoom] = useState(restoredDraft?.zoom ?? 1);
  const deferredInput = useDeferredValue(inputValue);
  const svgRef = useRef<SVGSVGElement>(null);
  const layoutRequestIdRef = useRef(0);

  const applyParseResult = async (source: string, mode: "auto" | "manual") => {
    const requestId = ++layoutRequestIdRef.current;
    const result = parseDiagram(source);

    if (result.model) {
      setNotice(mode === "manual" ? "Generating diagram..." : "Refreshing live preview...");

      try {
        const nextLayout = await createDiagramLayout(result.model);

        if (layoutRequestIdRef.current !== requestId) {
          return;
        }

        startTransition(() => {
          setDiagramModel(result.model);
          setLayout(nextLayout);
          setErrors([]);
        });

        setNotice(
          mode === "manual"
            ? `Generated ${result.model.entities.length} entities and ${result.model.relationships.length} relationships.`
            : `Live preview updated for ${result.model.entities.length} entities and ${result.model.relationships.length} relationships.`,
        );
      } catch (error) {
        if (layoutRequestIdRef.current !== requestId) {
          return;
        }

        setNotice(error instanceof Error ? error.message : "Layout generation failed.");
      }

      return;
    }

    setErrors(result.errors);
    setNotice(
      layout
        ? "The input has validation issues. The preview is still showing the last valid diagram."
        : "The input has validation issues. Fix them to generate a diagram.",
    );
  };

  useEffect(() => {
    void applyParseResult(deferredInput, "auto");
    // Using the deferred text keeps typing responsive without adding a debounce dependency.
  }, [deferredInput]);

  useEffect(() => {
    saveDraftToStorage(inputValue, zoom);
  }, [inputValue, zoom]);

  const displayedLayout = layout ? recomputeLayoutEdges(layout) : null;

  const handleGenerate = () => {
    void applyParseResult(inputValue, "manual");
  };

  const handleLoadExample = () => {
    setInputValue(EXAMPLE_INPUT);
    setNotice("Example reloaded.");
  };

  const handleSaveDraft = () => {
    const draft = saveDraftToStorage(inputValue, zoom);
    setNotice(
      draft
        ? `Draft saved at ${formatSavedAt(draft.savedAt)}.`
        : "Draft save failed in this browser.",
    );
  };

  const handleClearDraft = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }

    setNotice("Saved draft cleared. Current text is still on screen until you replace it.");
  };

  const handleExportPng = async () => {
    if (!svgRef.current || !displayedLayout) {
      return;
    }

    try {
      await exportPng(svgRef.current, displayedLayout.width, displayedLayout.height);
      setNotice("PNG export finished.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PNG export failed.");
    }
  };

  const handleExportSvg = () => {
    if (!svgRef.current) {
      return;
    }

    exportSvg(svgRef.current);
    setNotice("SVG export finished.");
  };

  const handleNodeMove = (
    nodeKind: DraggableNodeKind,
    nodeId: string,
    nextX: number,
    nextY: number,
  ) => {
    setLayout((currentLayout) => {
      if (!currentLayout) {
        return currentLayout;
      }

      const clampPosition = (
        width: number,
        height: number,
      ) => ({
        x: Math.max(width / 2 + 24, Math.min(currentLayout.width - width / 2 - 24, nextX)),
        y: Math.max(height / 2 + 24, Math.min(currentLayout.height - height / 2 - 24, nextY)),
      });

      if (nodeKind === "entity") {
        return {
          ...currentLayout,
          entities: currentLayout.entities.map((entity) => {
            if (entity.id !== nodeId) {
              return entity;
            }

            const clamped = clampPosition(entity.width, entity.height);
            return {
              ...entity,
              x: clamped.x,
              y: clamped.y,
            };
          }),
        };
      }

      if (nodeKind === "relationship") {
        return {
          ...currentLayout,
          relationships: currentLayout.relationships.map((relationship) => {
            if (relationship.id !== nodeId) {
              return relationship;
            }

            const clamped = clampPosition(relationship.width, relationship.height);
            return {
              ...relationship,
              x: clamped.x,
              y: clamped.y,
            };
          }),
        };
      }

      return {
        ...currentLayout,
        attributes: currentLayout.attributes.map((attribute) => {
          if (attribute.id !== nodeId) {
            return attribute;
          }

          const clamped = clampPosition(attribute.rx * 2, attribute.ry * 2);
          return {
            ...attribute,
            x: clamped.x,
            y: clamped.y,
          };
        }),
      };
    });
  };

  const hasDiagram = diagramModel !== null && displayedLayout !== null;

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">React + TypeScript + SVG</p>
          <h1>Chen Diagram Generator</h1>
          <p className="hero__copy">
            Convert structured text into a clean Chen ER diagram directly in the browser.
            No backend, no drag-and-drop editor, and ready to deploy on Vercel.
          </p>
        </div>
        <div className="hero__meta">
          <span className="status-pill">{hasDiagram ? "Preview ready" : "Waiting for valid input"}</span>
          <span className="status-note">{notice}</span>
        </div>
      </header>

      <Toolbar
        onGenerate={handleGenerate}
        onLoadExample={handleLoadExample}
        onSaveDraft={handleSaveDraft}
        onClearDraft={handleClearDraft}
        onExportPng={handleExportPng}
        onExportSvg={handleExportSvg}
        onZoomIn={() => setZoom((current) => Math.min(2, current + 0.1))}
        onZoomOut={() => setZoom((current) => Math.max(0.6, current - 0.1))}
        onResetZoom={() => setZoom(1)}
        hasDiagram={hasDiagram}
        zoom={zoom}
      />

      <main className="workspace">
        <TextInputPanel value={inputValue} onChange={setInputValue} />

        <section className="panel panel--preview">
          <div className="panel__header">
            <div>
              <p className="eyebrow">SVG Preview</p>
              <h2>Diagram Canvas</h2>
            </div>
            {diagramModel ? (
              <span className="panel__badge">
                {diagramModel.entities.length} entities / {diagramModel.relationships.length} relationships
              </span>
            ) : (
              <span className="panel__badge panel__badge--warning">Needs valid input</span>
            )}
          </div>

          <p className="panel__description">
            Strong entities render as rectangles, weak entities as double rectangles,
            identifying relationships as double diamonds, and relationship constraints
            render on the edges using single or double lines plus arrows. Drag entities,
            relationships, or attributes on the canvas to fine-tune the automatic layout.
          </p>

          {errors.length > 0 ? (
            <div className="error-list">
              <h3>Parse errors</h3>
              <ul>
                {errors.map((error, index) => (
                  <li key={`${error.line}-${index}`}>
                    <strong>Line {error.line}:</strong> {error.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <DiagramCanvas
            layout={displayedLayout}
            errors={errors}
            zoom={zoom}
            svgRef={svgRef}
            onNodeMove={handleNodeMove}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
