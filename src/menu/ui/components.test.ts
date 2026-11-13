import "../../../scripts/fake-dom";
import { describe, expect, test } from "bun:test";
import { createRawSnippet, type Component } from "svelte";
import { render } from "svelte/server";
import Badge from "./Badge.svelte";
import Button from "./Button.svelte";
import Card from "./Card.svelte";
import Chip from "./Chip.svelte";
import ClassBadge from "./ClassBadge.svelte";
import Dialog from "./Dialog.svelte";
import IconButton from "./IconButton.svelte";
import Kbd from "./Kbd.svelte";
import Link from "./Link.svelte";
import NameChip from "./NameChip.svelte";
import PageHead from "./PageHead.svelte";
import Progress from "./Progress.svelte";
import Row from "./Row.svelte";
import RowList from "./RowList.svelte";
import ScrollArea from "./ScrollArea.svelte";
import SectionHead from "./SectionHead.svelte";
import Segmented from "./Segmented.svelte";
import Select from "./Select.svelte";
import Slider from "./Slider.svelte";
import Stepper from "./Stepper.svelte";
import Tabs from "./Tabs.svelte";
import TextField from "./TextField.svelte";
import TierBadge from "./TierBadge.svelte";
import Tile from "./Tile.svelte";
import Toggle from "./Toggle.svelte";

const text = (html: string) => createRawSnippet(() => ({ render: () => `<span>${html}</span>` }));

function html<P extends Record<string, any>>(component: Component<P>, props: NoInfer<P>): string {
  return render(component, { props }).body.replace(/<!--.*?-->/g, "").trim();
}

describe("ui components", () => {
  test("Button carries its variant and size and defaults to type=button", () => {
    const out = html(Button, { variant: "primary", size: "lg", icon: "icon-car", children: text("Drive") });
    expect(out).toContain('type="button"');
    expect(out).toContain('data-variant="primary"');
    expect(out).toContain('data-size="lg"');
    expect(out).toContain('href="#icon-car"');
    expect(out).toContain("Drive");
  });

  test("IconButton is named by its label", () => {
    const out = html(IconButton, { icon: "icon-close", label: "Back to driving", shape: "round" });
    expect(out).toContain('aria-label="Back to driving"');
    expect(out).toContain('data-shape="round"');
  });

  test("Link is an anchor with a URL and a button without one", () => {
    const out = html(Link, { href: "https://example.com", external: true, children: text("Open") });
    expect(out).toMatch(/^<a[^>]+target="_blank"/);
    expect(out).toContain('rel="noopener"');
    expect(out).toContain('href="#icon-external"');
    expect(html(Link, { chevron: true, children: text("All events") })).toMatch(/^<button type="button"/);
  });

  test("Tabs marks the current item and numbers steps", () => {
    const items = [
      { id: "a", label: "One" },
      { id: "b", label: "Two" },
    ];
    const out = html(Tabs, { items, value: "b", variant: "steps", label: "Guide" });
    expect(out.match(/aria-current="true"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-current="true"[^>]*><span class="ui-step[^"]*">2</);
  });

  test("Segmented checks the picked option", () => {
    const out = html(Segmented, { options: [{ value: 1, label: "1 lap" }, { value: 3, label: "3 laps" }], value: 3, label: "Laps" });
    expect(out).toContain('role="radiogroup"');
    expect(out).toMatch(/aria-checked="true"[^>]*>3 laps/);
  });

  test("Segmented disables one option and keeps the rest", () => {
    const out = html(Segmented, { options: [{ value: 1, label: "1" }, { value: 3, label: "3", disabled: true }], value: 1, label: "Laps" });
    expect(out).toMatch(/aria-checked="true"(?![^>]*disabled)[^>]*>1</);
    expect(out).toMatch(/aria-checked="false"[^>]*disabled[^>]*>3</);
  });

  test("Toggle is a switch with its state", () => {
    expect(html(Toggle, { checked: true, label: "Bloom" })).toContain('aria-checked="true"');
    expect(html(Toggle, { checked: false, label: "Bloom" })).toContain('role="switch"');
  });

  test("Slider shows its formatted value", () => {
    const out = html(Slider, { value: 50, min: 0, max: 200, label: "Volume", format: (value: number) => `${value}%` });
    expect(out).toContain("50%");
    expect(out).toContain("--fill: 25%");
  });

  test("Stepper shows the current label and disables the arrow at an end", () => {
    const options = [
      { value: "low", label: "Low" },
      { value: "high", label: "High" },
    ];
    const out = html(Stepper, { options, value: "low", label: "Quality" });
    expect(out).toContain("Low");
    expect(out).toMatch(/aria-label="Previous"[^>]*disabled/);
    expect(out).not.toMatch(/aria-label="Next"[^>]*disabled/);
  });

  test("TextField and Select render their label and help", () => {
    const field = html(TextField, { value: "ABC", label: "Map code", help: "From a share link", mono: true });
    expect(field).toContain('value="ABC"');
    expect(field).toContain("From a share link");
    const select = html(Select, { options: [{ value: "a", label: "Alpha" }], value: "a", label: "Pick" });
    expect(select).toContain('aria-label="Pick"');
    expect(select).toContain("Alpha");
  });

  test("Row is a link, a button or a plain row by its props", () => {
    expect(html(Row, { label: "Bug", href: "https://example.com", external: true })).toMatch(/^<a[^>]+target="_blank"/);
    expect(html(Row, { label: "Keys", onclick: () => {} })).toMatch(/^<button type="button"/);
    const plain = html(Row, { label: "Bloom", help: "Glow on lights", control: text("switch") });
    expect(plain).toMatch(/^<div class="ui-row/);
    expect(plain).toContain("Glow on lights");
    expect(plain).toContain("switch");
    const tagged = html(Row, { label: "lobby", badge: text("lock") });
    expect(tagged).toMatch(/<span class="ui-label[^"]*">lobby<span class="ui-badge[^"]*"><span>lock<\/span>/);
    expect(html(Row, { label: "lobby" })).not.toContain("ui-badge");
  });

  test("RowList is a nav when asked", () => {
    expect(html(RowList, { nav: true, label: "Links", children: text("rows") })).toMatch(/^<nav[^>]+aria-label="Links"/);
  });

  test("Card is a section, or a button with onclick", () => {
    expect(html(Card, { variant: "well", children: text("body") })).toMatch(/^<section[^>]+data-variant="well"/);
    expect(html(Card, { onclick: () => {}, children: text("body") })).toMatch(/^<button type="button"/);
  });

  test("Tile shows its title, meta and selection", () => {
    const out = html(Tile, { title: "Island", meta: "Seed 4", thumb: "menu/island.webp", selected: true });
    expect(out).toContain("Island");
    expect(out).toContain("Seed 4");
    expect(out).toContain('aria-pressed="true"');
    expect(out).toContain('src="menu/island.webp"');
  });

  test("SectionHead renders the eyebrow and a title at its level", () => {
    const out = html(SectionHead, { eyebrow: "Career", title: "Rookie", count: 3, level: 2 });
    expect(out).toContain("Career");
    expect(out).toMatch(/<h2[^>]*>/);
    expect(out).toContain(">3<");
  });

  test("PageHead shows Back only with onback", () => {
    expect(html(PageHead, { title: "Modes" })).not.toContain("Back");
    expect(html(PageHead, { title: "Modes", onback: () => {} })).toContain("Back");
  });

  test("Badge and ClassBadge", () => {
    expect(html(Badge, { tone: "primary", children: text("New") })).toContain('data-tone="primary"');
    const badge = html(ClassBadge, { rating: { pi: 512, class: "b" } });
    expect(badge).toContain('aria-label="Class B, PI 512"');
  });

  test("TierBadge names its tier unless it is decorative", () => {
    const out = html(TierBadge, { tier: 1 });
    expect(out).toContain('role="img"');
    expect(out).toMatch(/aria-label="[^"]+"/);
    expect(out).toContain("--metal:");
    const quiet = html(TierBadge, { tier: 1, decorative: true });
    expect(quiet).toContain('aria-hidden="true"');
    expect(quiet).not.toContain("role=");
  });

  test("Chip toggles carry aria-pressed and status chips a dot", () => {
    expect(html(Chip, { variant: "toggle", pressed: true, children: text("Ghost") })).toContain('aria-pressed="true"');
    expect(html(Chip, { tone: "live", children: text("Room 4") })).toContain('data-tone="live"');
    expect(html(NameChip, { value: "Ana", label: "Your name" })).toContain('value="Ana"');
  });

  test("Progress clamps its fill and marks passed points", () => {
    const out = html(Progress, { value: 12, max: 10, label: "Stars", marks: [5] });
    expect(out).toContain("width: 100%");
    expect(out).toMatch(/class="ui-mark[^"]*ui-passed/);
  });

  test("Progress ghost stops the fill at the lower value and marks a loss", () => {
    const out = html(Progress, { value: 6, ghost: 4, max: 10, label: "Grip" });
    expect(out).toContain("width: 40%");
    expect(out).toContain('data-trend="down"');
    expect(html(Progress, { value: 6, max: 10, label: "Grip" })).not.toContain("ui-ghost");
  });

  test("Dialog renders its title, body and actions", () => {
    const out = html(Dialog, { open: false, title: "Pick a car", subtitle: "Up to B", children: text("cars"), actions: text("Drive") });
    expect(out).toMatch(/<h2[^>]*>Pick a car</);
    expect(out).toContain("Up to B");
    expect(out).toContain("cars");
    expect(out).toContain("Drive");
  });

  test("ScrollArea fades by default and takes its axis", () => {
    const out = html(ScrollArea, { axis: "x", children: text("long") });
    expect(out).toContain('data-axis="x"');
    expect(out).toMatch(/class="[^"]*ui-fade/);
  });

  test("Kbd renders one kbd per key", () => {
    expect(html(Kbd, { keys: ["Ctrl", "Q"] }).match(/<kbd/g)).toHaveLength(2);
  });
});
