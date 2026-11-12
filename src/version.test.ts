/// <reference types="bun" />
import { expect, test } from "bun:test";
import pkg from "../package.json";
import { CHANGELOG } from "./changelog";
import { compare_versions, newer_releases, parse_version_file, releases_since } from "./version";

test("versions compare per part, numerically", () => {
  expect(compare_versions("0.2.0", "0.10.0")).toBeLessThan(0);
  expect(compare_versions("1.0.0", "0.99.99")).toBeGreaterThan(0);
  expect(compare_versions("0.2.1", "0.2.1")).toBe(0);
  expect(compare_versions("junk", "0.0.1")).toBeLessThan(0);
});

test("the changelog tops out at package.json, newest first, one entry per version", () => {
  expect(CHANGELOG[0].version).toBe(pkg.version);
  for (let i = 1; i < CHANGELOG.length; i++) expect(compare_versions(CHANGELOG[i - 1].version, CHANGELOG[i].version)).toBeGreaterThan(0);
  for (const release of CHANGELOG) {
    expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(release.changes.length).toBeGreaterThan(0);
  }
});

test("newer releases are the ones past the running version", () => {
  const notes = [
    { version: "0.2.0", date: "2026-11-08", title: "a", changes: [] },
    { version: "0.3.0", date: "2026-11-09", title: "b", changes: [] },
    { version: "0.2.1", date: "2026-11-09", title: "c", changes: [] },
  ];
  expect(newer_releases(notes, "0.2.0").map((r) => r.version)).toEqual(["0.3.0", "0.2.1"]);
});

test("releases since the last seen version stop at the running one", () => {
  const log = ["0.4.0", "0.3.1", "0.3.0", "0.2.0"].map((version) => ({ version, date: "2026-11-09", title: version, changes: [] }));
  expect(releases_since(log, "0.2.0", "0.3.1").map((r) => r.version)).toEqual(["0.3.1", "0.3.0"]);
  expect(releases_since(log, null, "0.3.1")).toEqual([]);
  expect(releases_since(log, "0.3.1", "0.3.1")).toEqual([]);
  expect(releases_since(log, "0.4.0", "0.3.1")).toEqual([]);
});

test("version.json is checked, not trusted", () => {
  const good = { version: "0.2.1", commit: "abc1234", built: 1, notes: [{ ...CHANGELOG[0], version: "0.2.1" }] };
  expect(parse_version_file(good)?.notes[0].changes.length).toBe(CHANGELOG[0].changes.length);
  expect(parse_version_file(JSON.parse(JSON.stringify(good)))).toEqual(parse_version_file(good));
  for (const bad of [null, "0.2.1", { ...good, version: "v1" }, { ...good, built: "1" }, { ...good, commit: 7 }]) {
    expect(parse_version_file(bad)).toBeNull();
  }
  const odd = { ...good, notes: [{ version: "x" }, { ...CHANGELOG[0], changes: [{ kind: "huh", text: "?" }] }] };
  expect(parse_version_file(odd)?.notes).toEqual([{ ...CHANGELOG[0], changes: [] }]);
  expect(parse_version_file({ ...good, notes: undefined })?.notes).toEqual([]);
});
