"use client";

import { useEffect, useState, useTransition } from "react";

type Location = {
  id: string;
  name: string;
  address: string | null;
  note: string | null;
  lastUsedAt: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  currentLocationId?: string | null;
  previousLocation?: { id: string; name: string } | null;
};

export function LocationPicker({
  open,
  onClose,
  onChanged,
  currentLocationId,
  previousLocation,
}: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/locations?${params}`)
      .then((r) => r.json())
      .then((data) => setLocations(data.locations ?? []))
      .catch(() => setError("Could not load locations."));
  }, [open, q]);

  if (!open) return null;

  function select(locationId: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/location-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not change location.");
        return;
      }
      onChanged();
      onClose();
    });
  }

  function createAndSelect() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address: address || null,
          note: note || null,
          selectNow: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save location.");
        return;
      }
      onChanged();
      onClose();
    });
  }

  const ordered = [...locations].sort((a, b) => {
    if (a.id === currentLocationId) return -1;
    if (b.id === currentLocationId) return 1;
    return 0;
  });

  return (
    <>
      <button className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Change location">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand">Change Location</h2>
          <button className="btn btn-ghost min-h-10 px-3" onClick={onClose}>
            Close
          </button>
        </div>

        {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}

        {!showNew ? (
          <>
            <input
              className="field mb-3"
              placeholder="Search locations"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <div className="mb-3 space-y-2">
              {previousLocation && previousLocation.id !== currentLocationId ? (
                <button
                  className="btn btn-gold w-full"
                  disabled={pending}
                  onClick={() => select(previousLocation.id)}
                >
                  Back to {previousLocation.name}
                </button>
              ) : null}
              <button
                className="btn btn-secondary w-full"
                disabled={pending}
                onClick={() => select(null)}
              >
                Clear (Unassigned)
              </button>
            </div>

            <ul className="mb-3 space-y-2">
              {ordered.map((loc) => (
                <li key={loc.id}>
                  <button
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-left"
                    disabled={pending || loc.id === currentLocationId}
                    onClick={() => select(loc.id)}
                  >
                    <div className="font-semibold text-ink">
                      {loc.name}
                      {loc.id === currentLocationId ? (
                        <span className="ml-2 text-xs font-bold text-brand">Current</span>
                      ) : null}
                    </div>
                    {loc.address ? (
                      <div className="mt-0.5 text-xs text-muted">{loc.address}</div>
                    ) : null}
                  </button>
                </li>
              ))}
              {ordered.length === 0 ? (
                <li className="text-sm text-muted">No saved locations yet.</li>
              ) : null}
            </ul>

            <button className="btn btn-primary w-full" onClick={() => setShowNew(true)}>
              Add New Location
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-semibold">
              Name
              <input
                className="field mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Smith House"
                autoFocus
              />
            </label>
            <label className="block text-sm font-semibold">
              Address <span className="font-normal text-muted">(optional)</span>
              <input
                className="field mt-1"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              Note <span className="font-normal text-muted">(optional)</span>
              <input
                className="field mt-1"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1" onClick={() => setShowNew(false)}>
                Back
              </button>
              <button
                className="btn btn-primary flex-1"
                disabled={pending}
                onClick={createAndSelect}
              >
                Save & select
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
