"use client";

import { useEffect, useState } from "react";
import { formatDurationLong } from "@/lib/time";

export function ElapsedTimer({ clockInAt }: { clockInAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const start = new Date(clockInAt).getTime();
  const ms = Math.max(0, now - start);

  return (
    <div className="timer-display text-5xl text-brand sm:text-6xl" aria-live="polite">
      {formatDurationLong(ms)}
    </div>
  );
}
