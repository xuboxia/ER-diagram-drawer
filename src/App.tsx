import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { DiagramCanvas } from "./components/DiagramCanvas";
import { StructuredBuilder } from "./components/StructuredBuilder";
import { TaskSidebar } from "./components/TaskSidebar";
import { TextInputPanel } from "./components/TextInputPanel";
import { Toolbar } from "./components/Toolbar";
import { EXAMPLE_INPUT } from "./data/exampleInput";
import { getDefaultStructuredModel } from "./data/structuredPresets";
import type { DiagramLayout, DiagramModel, LayoutPoint, ParseIssue } from "./types/diagram";
import type { InputMode, StructuredDiagramModel } from "./types/structured";
import { exportPng, exportSvg } from "./utils/export";
import { createDiagramLayout, recomputeLayoutEdges } from "./utils/layout";
import { parseDiagram } from "./utils/parser";
import {
  createEmptyStructuredModel,
  normalizeInputMode,
  normalizeStructuredModel,
  structuredModelToSource,
  validateStructuredModel,
} from "./utils/structuredModel";

const LEGACY_DRAFT_STORAGE_KEY = "chen-diagram-generator:draft:v1";
const TASK_STORAGE_KEY = "chen-diagram-generator:tasks:v2";
const MAX_SAVED_TASKS = 28;

interface SavedDraft {
  inputValue: string;
  zoom: number;
  savedAt: string;
}

type DraggableNodeKind = "entity" | "relationship" | "attribute";
type SelfRelationshipLabelOverrides = Record<string, LayoutPoint>;

interface SavedTask {
  id: string;
  title: string;
  inputMode: InputMode;
  inputValue: string;
  structuredModel: StructuredDiagramModel;
  zoom: number;
  layout: DiagramLayout | null;
  selfRelationshipLabelOverrides: SelfRelationshipLabelOverrides;
  createdAt: string;
  updatedAt: string;
}

interface SavedTaskStore {
  activeTaskId: string;
  tasks: SavedTask[];
}

interface HydratedLayoutMarker {
  taskId: string;
  source: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createTaskId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getTaskTitle(source: string, fallback = "Untitled diagram"): string {
  const blockMatch = source.match(
    /^\s*(?:WeakEntity|Entity|IdentifyingRelationship|Relationship):\s*(.+?)\s*$/im,
  );

  if (blockMatch?.[1]?.trim()) {
    return `${blockMatch[1].trim().slice(0, 42)} diagram`;
  }

  const firstUsefulLine = source
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("-"));

  return firstUsefulLine ? firstUsefulLine.slice(0, 48) : fallback;
}

function readSavedDraft(): SavedDraft | null {
  const storage = getBrowserStorage();

  if (!storage) {
    return null;
  }

  try {
    const rawDraft = storage.getItem(LEGACY_DRAFT_STORAGE_KEY);

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

function normalizeLayout(value: unknown): DiagramLayout | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.width !== "number" ||
    typeof value.height !== "number" ||
    !Array.isArray(value.entities) ||
    !Array.isArray(value.relationships) ||
    !Array.isArray(value.attributes) ||
    !Array.isArray(value.edges)
  ) {
    return null;
  }

  return value as unknown as DiagramLayout;
}

function normalizeLabelOverrides(value: unknown): SelfRelationshipLabelOverrides {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<SelfRelationshipLabelOverrides>((overrides, [key, point]) => {
    if (!isRecord(point) || typeof point.x !== "number" || typeof point.y !== "number") {
      return overrides;
    }

    overrides[key] = {
      x: point.x,
      y: point.y,
    };

    return overrides;
  }, {});
}

function getTaskSource(task: Pick<SavedTask, "inputMode" | "inputValue" | "structuredModel">): string {
  return task.inputMode === "structured" ? structuredModelToSource(task.structuredModel) : task.inputValue;
}

function createSavedTask(
  source: string | null = null,
  index = 1,
  inputMode: InputMode = "structured",
  structuredModel: StructuredDiagramModel = getDefaultStructuredModel(),
): SavedTask {
  const timestamp = new Date().toISOString();
  const taskSource = source ?? structuredModelToSource(structuredModel);

  return {
    id: createTaskId(),
    title: getTaskTitle(taskSource, `Diagram ${index}`),
    inputMode,
    inputValue: taskSource,
    structuredModel,
    zoom: 1,
    layout: null,
    selfRelationshipLabelOverrides: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function normalizeSavedTask(value: unknown, index: number): SavedTask | null {
  if (!isRecord(value) || typeof value.inputValue !== "string") {
    return null;
  }

  const now = new Date().toISOString();
  const isLegacyPlainTextTask = value.inputMode === undefined;
  const inputMode = isLegacyPlainTextTask ? "plain-text" : normalizeInputMode(value.inputMode);
  const structuredModel = normalizeStructuredModel(value.structuredModel) ?? getDefaultStructuredModel();
  const taskSource =
    inputMode === "structured" ? structuredModelToSource(structuredModel) : value.inputValue;
  const title =
    typeof value.title === "string" && value.title.trim()
      ? value.title.trim()
      : getTaskTitle(taskSource, `Diagram ${index + 1}`);

  return {
    id: typeof value.id === "string" && value.id ? value.id : createTaskId(),
    title,
    inputMode,
    inputValue: value.inputValue,
    structuredModel,
    zoom: typeof value.zoom === "number" ? value.zoom : 1,
    layout: normalizeLayout(value.layout),
    selfRelationshipLabelOverrides: normalizeLabelOverrides(value.selfRelationshipLabelOverrides),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : typeof value.savedAt === "string"
          ? value.savedAt
          : now,
  };
}

function createInitialTaskStore(): SavedTaskStore {
  const legacyDraft = readSavedDraft();

  if (legacyDraft) {
    const migratedTask = createSavedTask(
      legacyDraft.inputValue,
      1,
      "plain-text",
      getDefaultStructuredModel(),
    );

    return {
      activeTaskId: migratedTask.id,
      tasks: [
        {
          ...migratedTask,
          zoom: legacyDraft.zoom,
          updatedAt: legacyDraft.savedAt,
        },
      ],
    };
  }

  const defaultStructuredModel = getDefaultStructuredModel();
  const initialTask = createSavedTask(
    structuredModelToSource(defaultStructuredModel),
    1,
    "structured",
    defaultStructuredModel,
  );

  return {
    activeTaskId: initialTask.id,
    tasks: [initialTask],
  };
}

function readSavedTaskStore(): SavedTaskStore {
  const storage = getBrowserStorage();

  if (!storage) {
    return createInitialTaskStore();
  }

  try {
    const rawStore = storage.getItem(TASK_STORAGE_KEY);

    if (!rawStore) {
      return createInitialTaskStore();
    }

    const parsedStore = JSON.parse(rawStore) as Partial<SavedTaskStore>;
    const tasks = Array.isArray(parsedStore.tasks)
      ? parsedStore.tasks
          .map((task, index) => normalizeSavedTask(task, index))
          .filter((task): task is SavedTask => task !== null)
          .slice(0, MAX_SAVED_TASKS)
      : [];

    if (tasks.length === 0) {
      return createInitialTaskStore();
    }

    const activeTaskId =
      typeof parsedStore.activeTaskId === "string" &&
      tasks.some((task) => task.id === parsedStore.activeTaskId)
        ? parsedStore.activeTaskId
        : tasks[0].id;

    return {
      activeTaskId,
      tasks,
    };
  } catch {
    return createInitialTaskStore();
  }
}

function getActiveTask(store: SavedTaskStore): SavedTask {
  return store.tasks.find((task) => task.id === store.activeTaskId) ?? store.tasks[0];
}

function snapshotTask(
  task: SavedTask,
  inputValue: string,
  inputMode: InputMode,
  structuredModel: StructuredDiagramModel,
  zoom: number,
  layout: DiagramLayout | null,
  labelOverrides: SelfRelationshipLabelOverrides,
  activeSource: string,
): SavedTask {
  return {
    ...task,
    title: getTaskTitle(activeSource, task.title),
    inputMode,
    inputValue,
    structuredModel,
    zoom,
    layout,
    selfRelationshipLabelOverrides: labelOverrides,
    updatedAt: new Date().toISOString(),
  };
}

function saveTaskStore(store: SavedTaskStore): boolean {
  const storage = getBrowserStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(TASK_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
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

function App() {
  const initialTaskStoreRef = useRef<SavedTaskStore | null>(null);

  if (initialTaskStoreRef.current === null) {
    initialTaskStoreRef.current = readSavedTaskStore();
  }

  const initialTaskStore = initialTaskStoreRef.current;
  const initialActiveTask = getActiveTask(initialTaskStore);
  const [tasks, setTasks] = useState<SavedTask[]>(initialTaskStore.tasks);
  const [activeTaskId, setActiveTaskId] = useState(initialTaskStore.activeTaskId);
  const [inputMode, setInputMode] = useState<InputMode>(initialActiveTask.inputMode);
  const [inputValue, setInputValue] = useState(initialActiveTask.inputValue);
  const [structuredModel, setStructuredModel] = useState<StructuredDiagramModel>(
    initialActiveTask.structuredModel,
  );
  const [diagramModel, setDiagramModel] = useState<DiagramModel | null>(null);
  const [layout, setLayout] = useState<DiagramLayout | null>(initialActiveTask.layout);
  const [errors, setErrors] = useState<ParseIssue[]>([]);
  const [selfRelationshipLabelOverrides, setSelfRelationshipLabelOverrides] =
    useState<SelfRelationshipLabelOverrides>(initialActiveTask.selfRelationshipLabelOverrides);
  const [notice, setNotice] = useState(
    `Task "${initialActiveTask.title}" loaded from local storage. Progress is saved in this browser.`,
  );
  const [zoom, setZoom] = useState(initialActiveTask.zoom);
  const structuredSource = structuredModelToSource(structuredModel);
  const activeSource = inputMode === "structured" ? structuredSource : inputValue;
  const deferredSource = useDeferredValue(activeSource);
  const structuredValidationIssues = validateStructuredModel(structuredModel);
  const svgRef = useRef<SVGSVGElement>(null);
  const layoutRequestIdRef = useRef(0);
  const hydratedLayoutRef = useRef<HydratedLayoutMarker | null>(
    initialActiveTask.layout
      ? {
          taskId: initialActiveTask.id,
          source: getTaskSource(initialActiveTask),
        }
      : null,
  );

  const applyParseResult = async (source: string, mode: "auto" | "manual") => {
    const requestId = ++layoutRequestIdRef.current;
    const result = parseDiagram(source);

    if (result.model) {
      const hydratedLayout = hydratedLayoutRef.current;
      const shouldKeepHydratedLayout =
        mode === "auto" &&
        hydratedLayout !== null &&
        hydratedLayout.taskId === activeTaskId &&
        hydratedLayout.source === source &&
        layout !== null;

      if (shouldKeepHydratedLayout) {
        hydratedLayoutRef.current = null;

        startTransition(() => {
          setDiagramModel(result.model);
          setErrors([]);
        });

        setNotice(
          `Restored "${getTaskTitle(source)}" with its saved node positions and label adjustments.`,
        );
        return;
      }

      hydratedLayoutRef.current = null;
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
          setSelfRelationshipLabelOverrides({});
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
    void applyParseResult(deferredSource, "auto");
    // Using the deferred text keeps typing responsive without adding a debounce dependency.
  }, [deferredSource]);

  useEffect(() => {
    setTasks((currentTasks) => {
      const nextTasks = currentTasks.map((task) =>
        task.id === activeTaskId
          ? snapshotTask(
              task,
              inputValue,
              inputMode,
              structuredModel,
              zoom,
              layout,
              selfRelationshipLabelOverrides,
              activeSource,
            )
          : task,
      );

      saveTaskStore({
        activeTaskId,
        tasks: nextTasks,
      });

      return nextTasks;
    });
  }, [
    activeTaskId,
    activeSource,
    inputMode,
    inputValue,
    layout,
    selfRelationshipLabelOverrides,
    structuredModel,
    zoom,
  ]);

  const displayedLayout = layout
    ? (() => {
        const recomputedLayout = recomputeLayoutEdges(layout);

        return {
          ...recomputedLayout,
          edges: recomputedLayout.edges.map((edge) => {
            const override = edge.labelDragKey
              ? selfRelationshipLabelOverrides[edge.labelDragKey]
              : undefined;

            if (
              !override ||
              !edge.isSelfRelationship ||
              edge.labelX === undefined ||
              edge.labelY === undefined
            ) {
              return edge;
            }

            return {
              ...edge,
              labelX: override.x,
              labelY: override.y,
            };
          }),
        };
      })()
    : null;

  const createCurrentTaskSnapshot = () =>
    tasks.map((task) =>
      task.id === activeTaskId
        ? snapshotTask(
            task,
            inputValue,
            inputMode,
            structuredModel,
            zoom,
            layout,
            selfRelationshipLabelOverrides,
            activeSource,
          )
        : task,
    );

  const handleGenerate = () => {
    void applyParseResult(activeSource, "manual");
  };

  const handleLoadExample = () => {
    if (inputMode === "structured") {
      const defaultModel = getDefaultStructuredModel();
      setStructuredModel(defaultModel);
      setInputValue(structuredModelToSource(defaultModel));
    } else {
      setInputValue(EXAMPLE_INPUT);
    }

    setLayout(null);
    setDiagramModel(null);
    setErrors([]);
    setSelfRelationshipLabelOverrides({});
    hydratedLayoutRef.current = null;
    setNotice("Example reloaded.");
  };

  const handleSaveDraft = () => {
    const timestamp = new Date().toISOString();
    const nextTasks = createCurrentTaskSnapshot().map((task) =>
      task.id === activeTaskId
        ? {
            ...snapshotTask(
              task,
              inputValue,
              inputMode,
              structuredModel,
              zoom,
              layout,
              selfRelationshipLabelOverrides,
              activeSource,
            ),
            updatedAt: timestamp,
          }
        : task,
    );
    const saved = saveTaskStore({
      activeTaskId,
      tasks: nextTasks,
    });

    setTasks(nextTasks);
    setNotice(saved ? `Task saved at ${formatSavedAt(timestamp)}.` : "Task save failed in this browser.");
  };

  const handleClearDraft = () => {
    setInputValue("");
    setStructuredModel(createEmptyStructuredModel());
    setDiagramModel(null);
    setLayout(null);
    setErrors([]);
    setSelfRelationshipLabelOverrides({});
    setZoom(1);
    hydratedLayoutRef.current = null;
    setNotice("Current task cleared. The empty task is saved locally.");
  };

  const handleCreateTask = () => {
    const defaultModel = getDefaultStructuredModel();
    const nextTask = createSavedTask(
      structuredModelToSource(defaultModel),
      tasks.length + 1,
      "structured",
      defaultModel,
    );
    const nextTasks = [nextTask, ...createCurrentTaskSnapshot()].slice(0, MAX_SAVED_TASKS);

    setTasks(nextTasks);
    setActiveTaskId(nextTask.id);
    setInputMode(nextTask.inputMode);
    setInputValue(nextTask.inputValue);
    setStructuredModel(nextTask.structuredModel);
    setDiagramModel(null);
    setLayout(null);
    setErrors([]);
    setSelfRelationshipLabelOverrides({});
    setZoom(nextTask.zoom);
    hydratedLayoutRef.current = null;
    saveTaskStore({
      activeTaskId: nextTask.id,
      tasks: nextTasks,
    });
    setNotice("New local task created. Add entities and relationships to begin.");
  };

  const handleSelectTask = (taskId: string) => {
    const snapshotTasks = createCurrentTaskSnapshot();
    const nextTask = snapshotTasks.find((task) => task.id === taskId);

    if (!nextTask || nextTask.id === activeTaskId) {
      return;
    }

    setActiveTaskId(nextTask.id);
    setInputValue(nextTask.inputValue);
    setInputMode(nextTask.inputMode);
    setStructuredModel(nextTask.structuredModel);
    setDiagramModel(null);
    setLayout(nextTask.layout);
    setErrors([]);
    setSelfRelationshipLabelOverrides(nextTask.selfRelationshipLabelOverrides);
    setZoom(nextTask.zoom);
    hydratedLayoutRef.current = nextTask.layout
      ? {
          taskId: nextTask.id,
          source: getTaskSource(nextTask),
        }
      : null;
    saveTaskStore({
      activeTaskId: nextTask.id,
      tasks: snapshotTasks,
    });
    setTasks(snapshotTasks);
    setNotice(`Switched to "${nextTask.title}".`);
  };

  const handleDeleteTask = (taskId: string) => {
    const snapshotTasks = createCurrentTaskSnapshot();

    if (snapshotTasks.length === 1) {
      handleClearDraft();
      return;
    }

    const nextTasks = snapshotTasks.filter((task) => task.id !== taskId);
    const nextActiveTask =
      taskId === activeTaskId ? nextTasks[0] : snapshotTasks.find((task) => task.id === activeTaskId);

    if (!nextActiveTask) {
      return;
    }

    setTasks(nextTasks);

    if (taskId === activeTaskId) {
      setActiveTaskId(nextActiveTask.id);
      setInputMode(nextActiveTask.inputMode);
      setInputValue(nextActiveTask.inputValue);
      setStructuredModel(nextActiveTask.structuredModel);
      setDiagramModel(null);
      setLayout(nextActiveTask.layout);
      setErrors([]);
      setSelfRelationshipLabelOverrides(nextActiveTask.selfRelationshipLabelOverrides);
      setZoom(nextActiveTask.zoom);
      hydratedLayoutRef.current = nextActiveTask.layout
        ? {
            taskId: nextActiveTask.id,
            source: getTaskSource(nextActiveTask),
          }
        : null;
    }

    saveTaskStore({
      activeTaskId: nextActiveTask.id,
      tasks: nextTasks,
    });
    setNotice("Local task deleted.");
  };

  const handleInputModeChange = (nextMode: InputMode) => {
    if (nextMode === inputMode) {
      return;
    }

    if (nextMode === "plain-text") {
      setInputValue(structuredSource);
    }

    setInputMode(nextMode);
    setDiagramModel(null);
    setLayout(null);
    setErrors([]);
    setSelfRelationshipLabelOverrides({});
    hydratedLayoutRef.current = null;
    setNotice(
      nextMode === "structured"
        ? "Structured Builder enabled. The form now generates the source for preview."
        : "Plain Text enabled. You can edit the generated source manually.",
    );
  };

  const handleStructuredModelChange = (nextStructuredModel: StructuredDiagramModel) => {
    setStructuredModel(nextStructuredModel);
    setLayout(null);
    setDiagramModel(null);
    setErrors([]);
    setSelfRelationshipLabelOverrides({});
    hydratedLayoutRef.current = null;
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

  const handleSelfRelationshipLabelMove = (labelKey: string, nextX: number, nextY: number) => {
    setSelfRelationshipLabelOverrides((current) => ({
      ...current,
      [labelKey]: {
        x: nextX,
        y: nextY,
      },
    }));
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

      const clampPosition = (width: number, height: number) => ({
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
        <TaskSidebar
          tasks={tasks.map((task) => ({
            ...task,
            inputValue: getTaskSource(task),
          }))}
          activeTaskId={activeTaskId}
          onCreateTask={handleCreateTask}
          onSelectTask={handleSelectTask}
          onDeleteTask={handleDeleteTask}
        />

        <div className="input-stack">
          <section className="mode-switch-card">
            <div>
              <p className="eyebrow">Input Mode</p>
              <h2>{inputMode === "structured" ? "Structured Builder" : "Plain Text"}</h2>
              <p>
                Use forms for explicit modelling choices, or switch to source syntax when
                you want full manual control.
              </p>
            </div>
            <div className="mode-switch">
              <button
                className={`mode-switch__button${
                  inputMode === "structured" ? " mode-switch__button--active" : ""
                }`}
                type="button"
                onClick={() => handleInputModeChange("structured")}
              >
                Structured Builder
              </button>
              <button
                className={`mode-switch__button${
                  inputMode === "plain-text" ? " mode-switch__button--active" : ""
                }`}
                type="button"
                onClick={() => handleInputModeChange("plain-text")}
              >
                Plain Text
              </button>
            </div>
          </section>

          {inputMode === "structured" ? (
            <StructuredBuilder
              generatedSource={structuredSource}
              model={structuredModel}
              validationIssues={structuredValidationIssues}
              onChange={handleStructuredModelChange}
            />
          ) : (
            <TextInputPanel value={inputValue} onChange={setInputValue} />
          )}
        </div>

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
            render on the edges using thin or thick lines plus arrows. Drag entities,
            relationships, attributes, and self-relationship role labels to refine the layout.
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
            onSelfRelationshipLabelMove={handleSelfRelationshipLabelMove}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
