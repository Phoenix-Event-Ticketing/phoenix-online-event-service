import { describe, it, expect } from "@jest/globals";
import { Event } from "../src/models/event.model.js";

function baseFields(overrides = {}) {
  return {
    eventId: "evt_schema_1",
    title: "T",
    description: "d",
    venue: "v",
    city: "c",
    eventDateTime: new Date("2025-09-01T12:00:00.000Z"),
    organizerName: "o",
    category: "cat",
    ...overrides,
  };
}

describe("Event model (unit)", () => {
  it("defaults status to DRAFT", () => {
    const doc = new Event(baseFields());
    expect(doc.status).toBe("DRAFT");
  });

  it("fails validation when title is missing", () => {
    const data = baseFields();
    delete data.title;
    const doc = new Event(data);
    const err = doc.validateSync();
    expect(err?.errors?.title).toBeDefined();
  });

  it("fails validation for invalid status", () => {
    const doc = new Event(baseFields({ status: "INVALID" }));
    const err = doc.validateSync();
    expect(err?.errors?.status).toBeDefined();
  });

  it("validates PUBLISHED and CANCELLED", () => {
    expect(
      new Event(baseFields({ status: "PUBLISHED" })).validateSync(),
    ).toBeUndefined();
    expect(
      new Event(baseFields({ status: "CANCELLED" })).validateSync(),
    ).toBeUndefined();
  });
});
