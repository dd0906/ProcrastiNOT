import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, SyntheticEvent } from "react";
import type { Task } from "../types/planner";
import {
  buildTask,
  taskToInput,
  validateTaskInput,
  type TaskField,
  type TaskInput,
} from "../logic/validation";

interface TaskFormProps {
  existingTask?: Task;
  nextOriginalOrder: number;
  onSave(task: Task): void;
  onCancel(): void;
}

const fieldLabels: Record<TaskField, string> = {
  name: "Task name",
  durationMinutes: "Duration",
  deadlineDate: "Deadline",
  priority: "Priority",
  status: "Completion status",
  preferredWindow: "Preferred time",
};

const taskInputFields: (keyof TaskInput)[] = [
  "name",
  "durationMinutes",
  "deadlineDate",
  "priority",
  "status",
  "preferredStart",
  "preferredEnd",
];

export default function TaskForm({
  existingTask,
  nextOriginalOrder,
  onSave,
  onCancel,
}: TaskFormProps) {
  const [initialInput] = useState(() => taskToInput(existingTask));
  const [input, setInput] = useState<TaskInput>(initialInput);
  const [touched, setTouched] = useState<Partial<Record<TaskField, boolean>>>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const errors = validateTaskInput(input);
  const requiredFields: TaskField[] = ["name", "durationMinutes", "deadlineDate"];
  const requiredFieldsValid = requiredFields.every((field) => !errors[field]);
  const formId = existingTask ? `task-edit-${existingTask.id}` : "task-create";
  const hasUnsavedChanges = taskInputFields.some((field) => input[field] !== initialInput[field]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const activeElement = document.activeElement;
    returnFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      returnFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (!confirmDiscard) nameInputRef.current?.focus();
  }, [confirmDiscard]);

  function update<K extends keyof TaskInput>(key: K, value: TaskInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  function requestClose() {
    if (hasUnsavedChanges) {
      setConfirmDiscard(true);
      return;
    }
    onCancel();
  }

  function handleDialogCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    if (confirmDiscard) {
      setConfirmDiscard(false);
      return;
    }
    requestClose();
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (confirmDiscard) {
      setConfirmDiscard(false);
      return;
    }
    requestClose();
  }

  function renderError(field: TaskField) {
    const message = touched[field] ? errors[field] : undefined;
    return message ? (
      <span className="field-error" id={`${formId}-${field}-error`}>
        {message}
      </span>
    ) : null;
  }

  function markTouched(field: TaskField) {
    if (!dialogRef.current?.open) return;
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({
      name: true,
      durationMinutes: true,
      deadlineDate: true,
      priority: true,
      status: true,
      preferredWindow: true,
    });
    if (Object.keys(errors).length > 0) return;
    onSave(
      buildTask(input, existingTask?.id ?? crypto.randomUUID(), existingTask?.originalOrder ?? nextOriginalOrder),
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="editor-dialog"
      aria-labelledby={`${formId}-title`}
      aria-describedby={confirmDiscard ? `${formId}-discard-description` : undefined}
      aria-modal="true"
      onCancel={handleDialogCancel}
      onKeyDown={handleDialogKeyDown}
    >
      {confirmDiscard ? (
        <div className="discard-confirmation">
          <h4 id={`${formId}-title`}>Discard unsaved task changes?</h4>
          <p id={`${formId}-discard-description`}>Your task edits have not been saved.</p>
          <div className="form-actions">
            <button
              className="secondary-button"
              type="button"
              autoFocus
              onClick={() => setConfirmDiscard(false)}
            >
              Keep editing
            </button>
            <button className="primary-button" type="button" onClick={onCancel}>
              Discard changes
            </button>
          </div>
        </div>
      ) : (
        <form className="editor-form" id={formId} aria-labelledby={`${formId}-title`} onSubmit={submit} noValidate>
          <h4 id={`${formId}-title`}>{existingTask ? `Edit ${existingTask.name}` : "Add a study task"}</h4>
          {existingTask?.status !== "completed" && (
            <aside className="planning-tip">
              <img
                src="/assets/procrastinot-hedgehog-mascot.png"
                alt="Hedgehog, the thoughtful planner"
              />
              <p>
                Give this task a clear next action and realistic duration. This planner schedules whole tasks;
                breaking a task into smaller steps is not available yet.
              </p>
            </aside>
          )}
          <div className="form-grid">
            <label className="form-field form-field--wide" htmlFor={`${formId}-name`}>
              {fieldLabels.name} <span aria-hidden="true">*</span>
              <input
                ref={nameInputRef}
                autoComplete="off"
                id={`${formId}-name`}
                value={input.name}
                aria-invalid={Boolean(touched.name && errors.name)}
                aria-describedby={touched.name && errors.name ? `${formId}-name-error` : undefined}
                onBlur={() => markTouched("name")}
                onChange={(event) => update("name", event.target.value)}
              />
              {renderError("name")}
            </label>
            <label className="form-field" htmlFor={`${formId}-durationMinutes`}>
              Duration in minutes <span aria-hidden="true">*</span>
              <input
                id={`${formId}-durationMinutes`}
                type="number"
                min="1"
                max="480"
                value={input.durationMinutes}
                aria-invalid={Boolean(touched.durationMinutes && errors.durationMinutes)}
                aria-describedby={
                  touched.durationMinutes && errors.durationMinutes ? `${formId}-durationMinutes-error` : undefined
                }
                onBlur={() => markTouched("durationMinutes")}
                onChange={(event) => update("durationMinutes", event.target.value)}
              />
              {renderError("durationMinutes")}
            </label>
            <label className="form-field" htmlFor={`${formId}-deadlineDate`}>
              Deadline <span aria-hidden="true">*</span>
              <input
                id={`${formId}-deadlineDate`}
                type="date"
                value={input.deadlineDate}
                aria-invalid={Boolean(touched.deadlineDate && errors.deadlineDate)}
                aria-describedby={touched.deadlineDate && errors.deadlineDate ? `${formId}-deadlineDate-error` : undefined}
                onBlur={() => markTouched("deadlineDate")}
                onChange={(event) => update("deadlineDate", event.target.value)}
              />
              {renderError("deadlineDate")}
            </label>
            <label className="form-field" htmlFor={`${formId}-priority`}>
              Priority
              <select
                id={`${formId}-priority`}
                value={input.priority}
                onChange={(event) => update("priority", event.target.value)}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className="form-field" htmlFor={`${formId}-status`}>
              {fieldLabels.status}
              <select
                id={`${formId}-status`}
                value={input.status}
                onChange={(event) => update("status", event.target.value)}
              >
                <option value="notStarted">Not completed</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <fieldset className="form-field form-field--wide preferred-field">
              <legend>Preferred study time <span className="optional-label">Optional</span></legend>
              <div className="time-fields">
                <label htmlFor={`${formId}-preferredStart`}>From</label>
                <input
                  id={`${formId}-preferredStart`}
                  type="time"
                  value={input.preferredStart}
                  aria-invalid={Boolean(touched.preferredWindow && errors.preferredWindow)}
                  aria-describedby={touched.preferredWindow && errors.preferredWindow ? `${formId}-preferred-error` : undefined}
                  onBlur={() => markTouched("preferredWindow")}
                  onChange={(event) => update("preferredStart", event.target.value)}
                />
                <label htmlFor={`${formId}-preferredEnd`}>To</label>
                <input
                  id={`${formId}-preferredEnd`}
                  type="time"
                  value={input.preferredEnd}
                  aria-invalid={Boolean(touched.preferredWindow && errors.preferredWindow)}
                  aria-describedby={touched.preferredWindow && errors.preferredWindow ? `${formId}-preferred-error` : undefined}
                  onBlur={() => markTouched("preferredWindow")}
                  onChange={(event) => update("preferredEnd", event.target.value)}
                />
              </div>
              {renderError("preferredWindow")}
            </fieldset>
          </div>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={requestClose}>Cancel</button>
            <button className="primary-button" type="submit" disabled={!requiredFieldsValid}>
              {existingTask ? "Save task" : "Add task"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
