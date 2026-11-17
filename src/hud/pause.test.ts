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

/** Each label follows the one before it, and its key cap sits between them. */
function rows_in_order(html: string, rows: readonly (readonly [string, string])[]) {
  let at = 0;
  for (const [label, cap] of rows) {
    at = html.indexOf(`>${label}</span>`, at);
    expect(at).toBeGreaterThan(-1);
    const key = html.indexOf(`>${cap}</kbd>`, at);
    expect(key).toBeGreaterThan(at);
    at = key;
  }
}

test("free roam: the title card, seven rows with their keys, the aids and Resume", () => {
  const html = sheet({ kind: "roam", context: "free roam", title: "Island · Harwar", facts: ["Rookie 0/21 ★", "4 flags here"] }, true);
  for (const text of ["Paused · free roam", "Island · Harwar", "Rookie 0/21 ★", "4 flags here", "Assists", "TC", "Lights", "Resume"]) expect(html).toContain(text);
  rows_in_order(html, [["Map", "M"], ["Events", "E"], ["Garage", "G"], ["Online", "O"], ["Home", "H"], ["Settings", "S"], ["Reset car", "R"]]);
  expect(html).not.toContain("Leave event");
});

test("in an event: the run card, five rows with their keys and Resume", () => {
  const html = sheet({ kind: "event", context: "Race", title: "First lap", facts: ["gate 1/12", "0:06.2"] }, false);
  for (const text of ["Menu · Race", "First lap", "gate 1/12", "Resume"]) expect(html).toContain(text);
  rows_in_order(html, [["Restart", "R"], ["Leave event", "Q"], ["Car and parts", "G"], ["Home", "H"], ["Settings", "S"]]);
  expect(html).not.toContain(">Map</span>");
});
