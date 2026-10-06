"use client";

import { useState, useTransition } from "react";

const chips = [
  { id: "ERRAND", label: "Errand" },
  { id: "SUPPLY_RUN", label: "Supply Run" },
  { id: "GENERAL", label: "General" },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function NoteForm({ open, onClose, onSaved }: Props) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  function save() {
    if (!text.trim()) {
      setError("Enter a note.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteText: text, noteCategory: category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save note.");
        return;
      }
      setText("");
      setCategory(null);
      onSaved();
      onClose();
    });
  }

  return (
    <>
      <button className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Add note">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand">Add Note</h2>
          <button className="btn btn-ghost min-h-10 px-3" onClick={onClose}>
            Close
          </button>
        </div>
        {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
        <div className="mb-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`chip ${category === chip.id ? "active" : ""}`}
              onClick={() =>
                setCategory((c) => (c === chip.id ? null : chip.id))
              }
            >
              {chip.label}
            </button>
          ))}
        </div>
        <textarea
          className="field mb-3 min-h-28 resize-y"
          placeholder="What happened?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <button className="btn btn-primary w-full" disabled={pending} onClick={save}>
          Save note
        </button>
      </div>
    </>
  );
}
