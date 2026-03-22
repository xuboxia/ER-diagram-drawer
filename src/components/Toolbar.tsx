interface ToolbarProps {
  onGenerate: () => void;
  onLoadExample: () => void;
  onSaveDraft: () => void;
  onClearDraft: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  hasDiagram: boolean;
  zoom: number;
}

export function Toolbar({
  onGenerate,
  onLoadExample,
  onSaveDraft,
  onClearDraft,
  onExportPng,
  onExportSvg,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  hasDiagram,
  zoom,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar__group">
        <button className="button button--primary" onClick={onGenerate}>
          Generate Diagram
        </button>
        <button className="button button--secondary" onClick={onLoadExample}>
          Load Example
        </button>
        <button className="button button--secondary" onClick={onSaveDraft}>
          Save Draft
        </button>
        <button className="button button--ghost" onClick={onClearDraft}>
          Clear Draft
        </button>
      </div>

      <div className="toolbar__group">
        <button className="button button--ghost" onClick={onZoomOut} disabled={!hasDiagram}>
          -
        </button>
        <button className="button button--zoom" onClick={onResetZoom} disabled={!hasDiagram}>
          {Math.round(zoom * 100)}%
        </button>
        <button className="button button--ghost" onClick={onZoomIn} disabled={!hasDiagram}>
          +
        </button>
      </div>

      <div className="toolbar__group">
        <button className="button button--secondary" onClick={onExportSvg} disabled={!hasDiagram}>
          Export SVG
        </button>
        <button className="button button--secondary" onClick={onExportPng} disabled={!hasDiagram}>
          Export PNG
        </button>
      </div>
    </div>
  );
}
