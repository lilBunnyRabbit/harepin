/// <reference types="bun" />
import { expect, test } from "bun:test";
import { clean_country, country_name, country_of_zone, flag } from "./country";

test("time zones map to the country they are named after, legacy aliases too", () => {
  expect(country_of_zone("Europe/Ljubljana")).toBe("SI");
  expect(country_of_zone("America/Los_Angeles")).toBe("US");
  expect(country_of_zone("Asia/Calcutta")).toBe("IN");
  expect(country_of_zone("Europe/Kiev")).toBe("UA");
  expect(country_of_zone("Etc/UTC")).toBeNull();
  expect(country_of_zone("")).toBeNull();
});

test("peer country codes: only codes some time zone maps to", () => {
  expect(clean_country("SI")).toBe("SI");
  expect(clean_country("si")).toBeNull();
  expect(clean_country("SVN")).toBeNull();
  expect(clean_country("ZZ")).toBeNull();
  expect(clean_country("toString")).toBeNull();
  expect(clean_country(7)).toBeNull();
  expect(clean_country(undefined)).toBeNull();
});

test("flags are regional indicator pairs, names come from the platform", () => {
  expect(flag("SI")).toBe("🇸🇮");
  expect(country_name("SI")).toBe("Slovenia");
});
