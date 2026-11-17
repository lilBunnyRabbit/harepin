import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { render } from "svelte/server";
import { DEFAULT_BINDINGS } from "./bindings";
import { pause_keys } from "./pause-keys";
import type { PauseAids, PauseCard } from "./pause-view.svelte";
import PauseSheet from "./PauseSheet.svelte";

const AIDS: PauseAids = { tcs: true, abs: true, assist: false, stability: false, auto: true, lights: false };
const none = () => {};

function sheet(card: PauseCard, solo: boolean): string {
  return render(PauseSheet, { props: { card, aids: AIDS, solo, caps: pause_keys(DEFAULT_BINDINGS, card.kind).caps, onact: none, onflip: none, onresume: none } }).body;
}

/** Each label follows the one before it, beside its key cap. */
function rows_in_order(html: string, rows: readonly (readonly [string, string])[]) {
  let at = 0;
  for (const [label, cap] of rows) {
    const next = html.indexOf(`>${label}</span>`, at);
    expect(next).toBeGreaterThan(at - 1);
    const row = html.slice(html.lastIndexOf("<button", next), html.indexOf("</button>", next));
    expect(row).toContain(`>${cap}</kbd>`);
    at = next + 1;
  }
}

test("free roam: on the frame, the map card, Reset car, the aids, six doors with their keys and one Resume", () => {
  const html = sheet({ kind: "roam", context: "Free roam", title: "Island · Harwar", facts: ["Rookie 0/21 ★", "4 flags here"] }, true);
  for (const text of ["ui-frame", "Free roam", "Paused", "Island · Harwar", "Rookie 0/21 ★", "4 flags here", "Assists", "TC", "Lights", "Go to", "Camera", "Chat"]) expect(html).toContain(text);
  rows_in_order(html, [["Reset car", "R"], ["Home", "H"], ["Events", "E"], ["Garage", "G"], ["Online", "O"], ["Settings", "S"], ["Road map", "M"]]);
  expect(html.match(/>Resume</g)).toHaveLength(1);
  expect(html).not.toContain(">Leave</span>");
});

test("in an event: the run with its clock, Restart and Leave, four doors and Resume", () => {
  const html = sheet({ kind: "event", context: "Race", title: "First lap", facts: ["gate 1/12"], clock: "0:06.2" }, false);
  for (const text of ["Race", "Menu", "First lap", "gate 1/12", "0:06.2", "Resume"]) expect(html).toContain(text);
  rows_in_order(html, [["Restart", "R"], ["Leave", "Q"], ["Car and parts", "G"], ["Home", "H"], ["Settings", "S"], ["Route map", "M"]]);
  expect(html).not.toContain(">Events</span>");
});
