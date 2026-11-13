import { expect, test } from "bun:test";
import { render } from "svelte/server";
import { ChangeKind } from "../changelog";
import ReleaseNotes from "./ReleaseNotes.svelte";

test("release notes label each change by kind", () => {
  const release = {
    version: "9.9.9",
    date: "2026-11-13",
    title: "Test",
    changes: [
      { kind: ChangeKind.NEW, text: "One" },
      { kind: ChangeKind.FIXED, text: "Two" },
    ],
  };
  const { body } = render(ReleaseNotes, { props: { release, fresh: true } });
  expect(body).toContain("v9.9.9");
  expect(body).toMatch(/data-tone="success"><!---->New</);
  expect(body).toContain(">Fixed<!---->");
  expect(body).toMatch(/data-tone="primary"><!---->New</);
});
