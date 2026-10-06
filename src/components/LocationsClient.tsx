"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

type Location = {
  id: string;
  name: string;
  address: string | null;
  note: string | null;
  archived: boolean;
  lastUsedAt: string | null;
};

export function LocationsClient() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<Location | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const res = await fetch("/api/locations?archived=1", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Could not load locations.");
      return;
    }
    setLocations(json.locations ?? []);
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function create() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address: address || null, note: note || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not save.");
        return;
      }
      setName("");
      setAddress("");
      setNote("");
      await load();
    });
  }

  function saveEdit() {
    if (!editing) return;
    startTransition(async () => {
      const res = await fetch(`/api/locations/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing.name,
          address: editing.address,
          note: editing.note,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not update.");
        return;
      }
      setEditing(null);
      await load();
    });
  }

  function toggleArchive(loc: Location) {
    startTransition(async () => {
      const res = await fetch(`/api/locations/${loc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !loc.archived }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not update.");
        return;
      }
      await load();
    });
  }

  const active = locations.filter((l) => !l.archived);
  const archived = locations.filter((l) => l.archived);

  return (
    <div className="space-y-4 pb-4 pt-2">
      <section className="panel">
        <h1 className="mb-3 text-xl font-bold text-brand">Locations</h1>
        {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
        <div className="space-y-2">
          <input
            className="field"
            placeholder="Location / job name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="field"
            placeholder="Address (optional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <input
            className="field"
            placeholder="Short note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn btn-primary w-full" disabled={pending} onClick={create}>
            Add location
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          Active
        </h2>
        <ul className="space-y-3">
          {active.map((loc) => (
            <li key={loc.id} className="rounded-xl border border-black/8 p-3">
              {editing?.id === loc.id ? (
                <div className="space-y-2">
                  <input
                    className="field"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                  <input
                    className="field"
                    value={editing.address ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, address: e.target.value || null })
                    }
                    placeholder="Address"
                  />
                  <input
                    className="field"
                    value={editing.note ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, note: e.target.value || null })
                    }
                    placeholder="Note"
                  />
                  <div className="flex gap-2">
                    <button className="btn btn-secondary flex-1" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                    <button className="btn btn-primary flex-1" disabled={pending} onClick={saveEdit}>
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-semibold">{loc.name}</p>
                  {loc.address ? <p className="text-sm text-muted">{loc.address}</p> : null}
                  {loc.note ? <p className="text-sm text-muted">{loc.note}</p> : null}
                  <div className="mt-2 flex gap-2">
                    <button className="btn btn-secondary flex-1 min-h-11" onClick={() => setEditing(loc)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost flex-1 min-h-11"
                      disabled={pending}
                      onClick={() => toggleArchive(loc)}
                    >
                      Archive
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
          {active.length === 0 ? (
            <li className="text-sm text-muted">No active locations yet.</li>
          ) : null}
        </ul>
      </section>

      {archived.length > 0 ? (
        <section className="panel">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
            Archived
          </h2>
          <ul className="space-y-3">
            {archived.map((loc) => (
              <li key={loc.id} className="rounded-xl border border-dashed border-black/15 p-3">
                <p className="font-semibold text-muted">{loc.name}</p>
                <button
                  className="btn btn-secondary mt-2 w-full min-h-11"
                  disabled={pending}
                  onClick={() => toggleArchive(loc)}
                >
                  Reopen
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
