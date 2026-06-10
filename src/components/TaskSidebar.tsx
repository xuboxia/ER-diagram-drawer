export interface TaskSidebarItem {
  id: string;
  title: string;
  inputValue: string;
  updatedAt: string;
}

interface TaskSidebarProps {
  tasks: TaskSidebarItem[];
  activeTaskId: string;
  onCreateTask: () => void;
  onSelectTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

function formatTaskTime(updatedAt: string): string {
  const date = new Date(updatedAt);

  if (Number.isNaN(date.getTime())) {
    return "Saved locally";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getTaskPreview(source: string): string {
  const firstLines = source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 2);

  return firstLines.length > 0 ? firstLines.join("  ") : "Empty diagram task";
}

export function TaskSidebar({
  tasks,
  activeTaskId,
  onCreateTask,
  onSelectTask,
  onDeleteTask,
}: TaskSidebarProps) {
  return (
    <aside className="task-sidebar" aria-label="Local diagram tasks">
      <div className="task-sidebar__header">
        <div>
          <p className="eyebrow">Local Tasks</p>
          <h2>Diagrams</h2>
        </div>
        <button className="task-sidebar__new" onClick={onCreateTask} type="button">
          + New
        </button>
      </div>

      <p className="task-sidebar__note">
        Tasks auto-save in this browser, including text, zoom, and manual node positions.
      </p>

      <div className="task-list">
        {tasks.map((task) => {
          const isActive = task.id === activeTaskId;

          return (
            <div className={`task-item${isActive ? " task-item--active" : ""}`} key={task.id}>
              <button
                className="task-item__main"
                onClick={() => onSelectTask(task.id)}
                type="button"
                aria-current={isActive ? "page" : undefined}
              >
                <span className="task-item__title">{task.title}</span>
                <span className="task-item__preview">{getTaskPreview(task.inputValue)}</span>
                <span className="task-item__time">{formatTaskTime(task.updatedAt)}</span>
              </button>

              <button
                className="task-item__delete"
                onClick={() => onDeleteTask(task.id)}
                type="button"
                aria-label={`Delete ${task.title}`}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
