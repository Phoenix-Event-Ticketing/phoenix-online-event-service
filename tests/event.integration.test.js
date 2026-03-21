import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import jwt from "jsonwebtoken";
import request from "supertest";
import { env } from "../src/config/env.js";

/** In-memory stand-in for Mongoose — no MongoDB process */
const store = new Map();

const Event = {
  async create(doc) {
    const row = { ...doc, status: doc.status ?? "DRAFT" };
    store.set(doc.eventId, row);
    return row;
  },
  find(query = {}) {
    return {
      lean: async () => {
        let rows = [...store.values()];
        if (Object.prototype.hasOwnProperty.call(query, "status")) {
          rows = rows.filter((r) => r.status === query.status);
        }
        return rows.map((r) => ({ ...r }));
      },
    };
  },
  findOne(query) {
    return {
      lean: async () => {
        const r = store.get(query.eventId);
        return r ? { ...r } : null;
      },
    };
  },
  async findOneAndUpdate(query, update) {
    const id = query.eventId;
    const cur = store.get(id);
    if (!cur) return null;
    const next = { ...cur, ...update };
    store.set(id, next);
    return next;
  },
};

await jest.unstable_mockModule("../src/models/event.model.js", () => ({ Event }));

const { createApp } = await import("../src/app.js");

const PERMISSIONS = {
  VIEW_EVENTS: "VIEW_EVENTS",
  CREATE_EVENT: "CREATE_EVENT",
  UPDATE_EVENT: "UPDATE_EVENT",
  PUBLISH_EVENT: "PUBLISH_EVENT",
};

function authHeader(permissions) {
  const token = jwt.sign(
    { sub: "integration-test-user", permissions },
    env.jwtSecret,
    { expiresIn: "1h" },
  );
  return { Authorization: `Bearer ${token}` };
}

const basePayload = () => ({
  title: "Summer Fest",
  description: "Outdoor music",
  venue: "Arena",
  city: "Colombo",
  eventDateTime: "2025-08-15T18:00:00.000Z",
  organizerName: "Org Inc",
  category: "music",
});

const app = createApp();

describe("events API (integration)", () => {
  beforeEach(() => {
    store.clear();
  });

  it("GET /api/v1/events returns empty list when no published events", async () => {
    const res = await request(app).get("/api/v1/events").expect(200);
    expect(res.body).toEqual([]);
  });

  it("POST /api/v1/events returns 401 without Authorization", async () => {
    await request(app)
      .post("/api/v1/events")
      .send(basePayload())
      .expect(401);
  });

  it("POST /api/v1/events returns 403 when token lacks CREATE_EVENT", async () => {
    await request(app)
      .post("/api/v1/events")
      .set(authHeader([PERMISSIONS.VIEW_EVENTS]))
      .send(basePayload())
      .expect(403);
  });

  it("creates a draft event and exposes it by id; public list stays empty until publish", async () => {
    const createRes = await request(app)
      .post("/api/v1/events")
      .set(authHeader([PERMISSIONS.CREATE_EVENT]))
      .send(basePayload())
      .expect(201);

    const { eventId } = createRes.body;
    expect(eventId).toMatch(/^evt_/);
    expect(createRes.body.status).toBe("DRAFT");

    const listRes = await request(app).get("/api/v1/events").expect(200);
    expect(listRes.body).toEqual([]);

    const getRes = await request(app)
      .get(`/api/v1/events/${eventId}`)
      .expect(200);
    expect(getRes.body.eventId).toBe(eventId);
    expect(getRes.body.title).toBe("Summer Fest");
  });

  it("publishing makes the event visible on the public list", async () => {
    const { body: created } = await request(app)
      .post("/api/v1/events")
      .set(authHeader([PERMISSIONS.CREATE_EVENT]))
      .send(basePayload())
      .expect(201);

    await request(app)
      .patch(`/api/v1/events/${created.eventId}/publish`)
      .set(authHeader([PERMISSIONS.PUBLISH_EVENT]))
      .expect(200);

    const listRes = await request(app).get("/api/v1/events").expect(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].eventId).toBe(created.eventId);
    expect(listRes.body[0].status).toBe("PUBLISHED");
  });

  it("internal list returns all events when authorized", async () => {
    await request(app)
      .post("/api/v1/events")
      .set(authHeader([PERMISSIONS.CREATE_EVENT]))
      .send(basePayload())
      .expect(201);

    const internal = await request(app)
      .get("/api/v1/events/internal/events")
      .set(authHeader([PERMISSIONS.VIEW_EVENTS]))
      .expect(200);

    expect(internal.body).toHaveLength(1);
    expect(internal.body[0].status).toBe("DRAFT");
  });

  it("updates an event with UPDATE_EVENT permission", async () => {
    const { body: created } = await request(app)
      .post("/api/v1/events")
      .set(authHeader([PERMISSIONS.CREATE_EVENT]))
      .send(basePayload())
      .expect(201);

    const updated = await request(app)
      .put(`/api/v1/events/${created.eventId}`)
      .set(authHeader([PERMISSIONS.UPDATE_EVENT]))
      .send({ title: "Renamed Fest" })
      .expect(200);

    expect(updated.body.title).toBe("Renamed Fest");
  });

  it("cancelling removes the event from the public published list", async () => {
    const { body: created } = await request(app)
      .post("/api/v1/events")
      .set(authHeader([PERMISSIONS.CREATE_EVENT]))
      .send(basePayload())
      .expect(201);

    await request(app)
      .patch(`/api/v1/events/${created.eventId}/publish`)
      .set(authHeader([PERMISSIONS.PUBLISH_EVENT]))
      .expect(200);

    await request(app)
      .get("/api/v1/events")
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveLength(1);
      });

    await request(app)
      .patch(`/api/v1/events/${created.eventId}/cancel`)
      .set(authHeader([PERMISSIONS.UPDATE_EVENT]))
      .expect(200);

    const listRes = await request(app).get("/api/v1/events").expect(200);
    expect(listRes.body).toEqual([]);
  });

  it("GET /api/v1/events/:eventId returns 404 when missing", async () => {
    await request(app).get("/api/v1/events/evt_nonexistent").expect(404);
  });
});
