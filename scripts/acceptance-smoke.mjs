#!/usr/bin/env node
/**
 * Local acceptance smoke against a running `npm run dev` server.
 * Usage: node scripts/acceptance-smoke.mjs [baseUrl]
 */
const base = process.argv[2] || "http://localhost:3000";
const jar = `/tmp/tc-accept-cookies-${Date.now()}.txt`;

async function main() {
  const { execSync } = await import("node:child_process");
  const run = (args, opts = {}) =>
    execSync(args, { encoding: "utf8", ...opts });

  const status = JSON.parse(run(`curl -s ${base}/api/owner-status`));
  console.log("ownerExists:", status.ownerExists);

  // Use a unique email if no owner; otherwise sign in with seeded creds won't work.
  // This script assumes an owner already exists: owner@squarethisup.com / testpass123
  // or creates one when registration is open.
  if (!status.ownerExists) {
    const reg = JSON.parse(
      run(
        `curl -s -X POST ${base}/api/register -H 'Content-Type: application/json' -d '${JSON.stringify(
          {
            email: "owner@squarethisup.com",
            password: "testpass123",
            confirmPassword: "testpass123",
            displayName: "Owner",
          },
        )}'`,
      ),
    );
    if (!reg.ok) throw new Error("register failed: " + JSON.stringify(reg));
    console.log("created owner");
  } else {
    const locked = JSON.parse(
      run(
        `curl -s -X POST ${base}/api/register -H 'Content-Type: application/json' -d '${JSON.stringify(
          {
            email: "intruder@example.com",
            password: "testpass123",
            confirmPassword: "testpass123",
          },
        )}'`,
      ),
    );
    if (!locked.error) throw new Error("registration should be locked");
    console.log("registration locked: ok");
  }

  const csrf = JSON.parse(run(`curl -s -c ${jar} ${base}/api/auth/csrf`)).csrfToken;
  run(
    `curl -s -c ${jar} -b ${jar} -X POST ${base}/api/auth/callback/credentials -H 'Content-Type: application/x-www-form-urlencoded' -d 'csrfToken=${csrf}&email=owner%40squarethisup.com&password=testpass123&redirect=false&json=true' -o /tmp/signin-accept.json`,
  );

  const in1 = JSON.parse(run(`curl -s -b ${jar} -X POST ${base}/api/clock/in`));
  const in2 = JSON.parse(run(`curl -s -b ${jar} -X POST ${base}/api/clock/in`));
  if (!in1.ok || in2.created !== false) throw new Error("clock-in idempotency failed");
  console.log("clock-in idempotent: ok");

  const loc = JSON.parse(
    run(
      `curl -s -b ${jar} -X POST ${base}/api/locations -H 'Content-Type: application/json' -d '${JSON.stringify(
        { name: `Job ${Date.now()}`, selectNow: true },
      )}'`,
    ),
  );
  if (!loc.ok) throw new Error("location failed");
  console.log("location change: ok");

  const note = JSON.parse(
    run(
      `curl -s -b ${jar} -X POST ${base}/api/notes -H 'Content-Type: application/json' -d '${JSON.stringify(
        { noteText: "acceptance note", noteCategory: "GENERAL" },
      )}'`,
    ),
  );
  if (!note.ok) throw new Error("note failed");
  console.log("note: ok");

  const today = JSON.parse(run(`curl -s -b ${jar} ${base}/api/today`));
  if (!today.activeShift) throw new Error("expected active shift");
  console.log("today active + timeline events:", today.activeShift.events.length);

  const out1 = JSON.parse(run(`curl -s -b ${jar} -X POST ${base}/api/clock/out`));
  const out2 = JSON.parse(run(`curl -s -b ${jar} -X POST ${base}/api/clock/out`));
  if (!out1.created || out2.created !== false) throw new Error("clock-out idempotency failed");
  console.log("clock-out idempotent: ok");

  const hist = JSON.parse(run(`curl -s -b ${jar} '${base}/api/history?filter=this_week'`));
  if (!hist.byDay?.length) throw new Error("history empty");
  console.log("history days:", hist.byDay.length);

  // Correction: nudge clock-out later by 2 minutes on a completed shift with room
  const day = hist.byDay.find((d) => d.status === "COMPLETED" && d.clockOutAt);
  if (day) {
    const newOut = new Date(new Date(day.clockOutAt).getTime() + 120_000).toISOString();
    const corr = JSON.parse(
      run(
        `curl -s -b ${jar} -X PATCH ${base}/api/shifts/${day.id} -H 'Content-Type: application/json' -d '${JSON.stringify(
          { clockInAt: day.clockInAt, clockOutAt: newOut },
        )}'`,
      ),
    );
    if (!corr.ok) throw new Error("shift correction failed: " + JSON.stringify(corr));
    console.log("shift correction: ok");

    // Invalid: clock out before clock in
    const bad = JSON.parse(
      run(
        `curl -s -b ${jar} -X PATCH ${base}/api/shifts/${day.id} -H 'Content-Type: application/json' -d '${JSON.stringify(
          { clockInAt: day.clockInAt, clockOutAt: new Date(new Date(day.clockInAt).getTime() - 1000).toISOString() },
        )}'`,
      ),
    );
    if (!bad.error) throw new Error("expected invalid correction rejection");
    console.log("invalid correction rejected: ok");
  }

  console.log("\nAcceptance smoke: PASS");
}

main().catch((e) => {
  console.error("Acceptance smoke: FAIL", e);
  process.exit(1);
});
