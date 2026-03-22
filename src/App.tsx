import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { DiagramCanvas } from "./components/DiagramCanvas";
import { TextInputPanel } from "./components/TextInputPanel";
import { Toolbar } from "./components/Toolbar";
import { EXAMPLE_INPUT } from "./data/exampleInput";
import type { DiagramLayout, DiagramModel, ParseIssue } from "./types/diagram";
import { exportPng, exportSvg } from "./utils/export";
import { createDiagramLayout } from "./utils/layout";
import { parseDiagram } from "./utils/parser";

const DRAFT_STORAGE_KEY = "chen-diagram-generator:draft:v1";

interface SavedDraft {
  inputValue: string;
  zoom: number;
  savedAt: string;
}

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
    if (!svgRef.current || !layout) {
      return;
    }

    try {
      await exportPng(svgRef.current, layout.width, layout.height);
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

  const hasDiagram = diagramModel !== null && layout !== null;

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
            render on the edges using single or double lines plus arrows.
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

          <DiagramCanvas layout={layout} errors={errors} zoom={zoom} svgRef={svgRef} />
        </section>
      </main>
    </div>
  );
}

export default App;
