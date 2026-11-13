import { expect, test } from "bun:test";
import { render } from "svelte/server";
import Badge from "../ui/Badge.svelte";
import Card from "../ui/Card.svelte";
import Tabs from "../ui/Tabs.svelte";
import { createRawSnippet } from "svelte";

const items = [
  { id: "a", label: "One" },
  { id: "b", label: "Two" },
  { id: "c", label: "Three" },
];
const text = (html: string) => createRawSnippet(() => ({ render: () => `<span>${html}</span>` }));

test("steps mark the passed steps done and wrap labels when compact", () => {
  const { body } = render(Tabs, { props: { items, value: "b", variant: "steps", label: "Steps", done: true, compact: true } });
  expect(body.match(/ui-passed/g)).toHaveLength(1);
  expect(body).toContain("#icon-check");
  expect(body.match(/ui-tab-label/g)).toHaveLength(3);
});

test("steps stay numbered without the new props", () => {
  const { body } = render(Tabs, { props: { items, value: "b", variant: "steps", label: "Steps" } });
  expect(body).not.toContain("ui-passed");
  expect(body).not.toContain("ui-tab-label");
});

test("a selected card button reports aria-pressed", () => {
  const picked = render(Card, { props: { selected: true, onclick: () => {}, children: text("x") } }).body;
  const plain = render(Card, { props: { onclick: () => {}, children: text("x") } }).body;
  expect(picked).toContain('aria-pressed="true"');
  expect(plain).not.toContain("aria-pressed");
});

test("badge has a warning tone", () => {
  expect(render(Badge, { props: { tone: "warning", children: text("Fixed") } }).body).toContain('data-tone="warning"');
});

test("fill and compact wrap labels for every variant", () => {
  const { body } = render(Tabs, { props: { items, value: "a", label: "Tabs", fill: true } });
  expect(body).toContain("ui-fill");
  expect(body.match(/ui-tab-label/g)).toHaveLength(3);
});
