import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, SyntheticEvent } from "react";
import type { FixedCommitment } from "../types/planner";
import {
  buildCommitment,
  commitmentToInput,
  validateCommitmentInput,
  type CommitmentField,
  type CommitmentInput,
} from "../logic/validation";

interface CommitmentFormProps {
  existingCommitment?: FixedCommitment;
  onSave(commitment: FixedCommitment): void;
  onCancel(): void;
}

export default function CommitmentForm({
  existingCommitment,
  onSave,
  onCancel,
}: CommitmentFormProps) {
  const [initialInput] = useState(() => commitmentToInput(existingCommitment));
  const [input, setInput] = useState<CommitmentInput>(initialInput);
  const [touched, setTouched] = useState<Partial<Record<CommitmentField, boolean>>>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const errors = validateCommitmentInput(input);
  const formId = existingCommitment ? `commitment-edit-${existingCommitment.id}` : "commitment-create";
  const hasUnsavedChanges = (
    Object.keys(initialInput) as (keyof CommitmentInput)[]
  ).some((field) => input[field] !== initialInput[field]);

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
    if (!confirmDiscard) titleInputRef.current?.focus();
  }, [confirmDiscard]);

  function update<K extends keyof CommitmentInput>(key: K, value: CommitmentInput[K]) {
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ title: true, start: true, end: true, kind: true });
    if (Object.keys(errors).length > 0) return;
    onSave(buildCommitment(input, existingCommitment?.id ?? crypto.randomUUID(), existingCommitment));
  }

  function fieldError(field: CommitmentField) {
    const message = touched[field] ? errors[field] : undefined;
    return message ? (
      <span className="field-error" id={`${formId}-${field}-error`}>{message}</span>
    ) : null;
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
          <h4 id={`${formId}-title`}>Discard unsaved commitment changes?</h4>
          <p id={`${formId}-discard-description`}>Your commitment edits have not been saved.</p>
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
          <h4 id={`${formId}-title`}>{existingCommitment ? `Edit ${existingCommitment.title}` : "Add a fixed commitment"}</h4>
          <div className="form-grid">
            <label className="form-field form-field--wide" htmlFor={`${formId}-label`}>
              Commitment name
              <input
                ref={titleInputRef}
                id={`${formId}-label`}
                value={input.title}
                aria-invalid={Boolean(touched.title && errors.title)}
                aria-describedby={touched.title && errors.title ? `${formId}-title-error` : undefined}
                onBlur={() => {
                  if (dialogRef.current?.open) setTouched((current) => ({ ...current, title: true }));
                }}
                onChange={(event) => update("title", event.target.value)}
              />
              {fieldError("title")}
            </label>
            <label className="form-field" htmlFor={`${formId}-start`}>
              Starts
              <input
                id={`${formId}-start`}
                type="time"
                value={input.start}
                aria-invalid={Boolean(touched.start && errors.start)}
                aria-describedby={touched.start && errors.start ? `${formId}-start-error` : undefined}
                onBlur={() => {
                  if (dialogRef.current?.open) setTouched((current) => ({ ...current, start: true }));
                }}
                onChange={(event) => update("start", event.target.value)}
              />
              {fieldError("start")}
            </label>
            <label className="form-field" htmlFor={`${formId}-end`}>
              Ends
              <input
                id={`${formId}-end`}
                type="time"
                value={input.end}
                aria-invalid={Boolean(touched.end && errors.end)}
                aria-describedby={touched.end && errors.end ? `${formId}-end-error` : undefined}
                onBlur={() => {
                  if (dialogRef.current?.open) setTouched((current) => ({ ...current, end: true }));
                }}
                onChange={(event) => update("end", event.target.value)}
              />
              {fieldError("end")}
            </label>
            <label className="form-field" htmlFor={`${formId}-kind`}>
              Type
              <select
                id={`${formId}-kind`}
                value={input.kind}
                onChange={(event) => update("kind", event.target.value)}
              >
                <option value="class">Class</option>
                <option value="lab">Lab</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={requestClose}>Cancel</button>
            <button
              className="primary-button"
              type="submit"
              disabled={Object.keys(errors).length > 0}
            >
              {existingCommitment ? "Save commitment" : "Add commitment"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
