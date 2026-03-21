import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockLogHttp = jest.fn();
const mockUploadBufferToCloudinary = jest.fn();
const mockCreate = jest.fn();
const mockFind = jest.fn();
const mockFindOne = jest.fn();
const mockFindOneAndUpdate = jest.fn();

await jest.unstable_mockModule("../src/utils/logger.js", () => ({
  logHttp: mockLogHttp,
}));

await jest.unstable_mockModule("../src/utils/upload.js", () => ({
  uploadBufferToCloudinary: mockUploadBufferToCloudinary,
}));

await jest.unstable_mockModule("../src/models/event.model.js", () => ({
  Event: {
    create: mockCreate,
    find: mockFind,
    findOne: mockFindOne,
    findOneAndUpdate: mockFindOneAndUpdate,
  },
}));

await jest.unstable_mockModule("../src/config/env.js", () => ({
  env: {
    port: 4001,
    mongoUri: undefined,
    nodeEnv: "test",
    serviceName: "event-service",
    jwtSecret: "dev-jwt-secret-change-in-prod",
    inventoryServiceUrl: "",
    cloudinary: {},
  },
}));

await jest.unstable_mockModule("uuid", () => ({
  v4: jest.fn(() => "fixed-uuid"),
}));

const {
  createEvent,
  listEvents,
  listAllEvents,
  getEventById,
  getInternalEvent,
  updateEvent,
  publishEvent,
  cancelEvent,
} = await import("../src/controllers/event.controller.js");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("event.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("listEvents", () => {
    it("returns published events", async () => {
      const lean = jest.fn().mockResolvedValue([{ eventId: "evt_1" }]);
      mockFind.mockReturnValue({ lean });
      const res = mockRes();
      await listEvents({ headers: {} }, res);
      expect(mockFind).toHaveBeenCalledWith({ status: "PUBLISHED" });
      expect(res.json).toHaveBeenCalledWith([
        { eventId: "evt_1", tickets: [] },
      ]);
    });

    it("responds 500 when listing fails", async () => {
      const lean = jest.fn().mockRejectedValue(new Error("db"));
      mockFind.mockReturnValue({ lean });
      const res = mockRes();
      await listEvents({ headers: {} }, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
    });
  });

  describe("listAllEvents", () => {
    it("returns all events", async () => {
      const lean = jest.fn().mockResolvedValue([]);
      mockFind.mockReturnValue({ lean });
      const res = mockRes();
      await listAllEvents({}, res);
      expect(mockFind).toHaveBeenCalledWith({});
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it("responds 500 when listing fails", async () => {
      const lean = jest.fn().mockRejectedValue(new Error("db"));
      mockFind.mockReturnValue({ lean });
      const res = mockRes();
      await listAllEvents({}, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
    });
  });

  describe("getEventById", () => {
    it("returns 404 when missing", async () => {
      const lean = jest.fn().mockResolvedValue(null);
      mockFindOne.mockReturnValue({ lean });
      const res = mockRes();
      await getEventById(
        { params: { eventId: "evt_x" }, headers: {} },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("returns event when found", async () => {
      const doc = { eventId: "evt_x", title: "T" };
      const lean = jest.fn().mockResolvedValue(doc);
      mockFindOne.mockReturnValue({ lean });
      const res = mockRes();
      await getEventById(
        { params: { eventId: "evt_x" }, headers: {} },
        res,
      );
      expect(res.json).toHaveBeenCalledWith({
        ...doc,
        tickets: [],
      });
    });

    it("responds 500 when find fails", async () => {
      const lean = jest.fn().mockRejectedValue(new Error("db"));
      mockFindOne.mockReturnValue({ lean });
      const res = mockRes();
      await getEventById(
        { params: { eventId: "evt_x" }, headers: {} },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
    });
  });

  describe("getInternalEvent", () => {
    it("returns 404 when missing", async () => {
      const lean = jest.fn().mockResolvedValue(null);
      mockFindOne.mockReturnValue({ lean });
      const res = mockRes();
      await getInternalEvent(
        { params: { eventId: "evt_x" }, headers: {} },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("returns event when found", async () => {
      const doc = { eventId: "evt_x" };
      const lean = jest.fn().mockResolvedValue(doc);
      mockFindOne.mockReturnValue({ lean });
      const res = mockRes();
      await getInternalEvent(
        { params: { eventId: "evt_x" }, headers: {} },
        res,
      );
      expect(res.json).toHaveBeenCalledWith({
        ...doc,
        ticketInventory: null,
        availabilitySummary: null,
      });
    });
  });

  describe("createEvent", () => {
    it("creates event without file upload", async () => {
      const created = {
        eventId: "evt_fixed-uuid",
        title: "A",
        description: "d",
        venue: "v",
        city: "c",
        eventDateTime: new Date("2025-01-01"),
        organizerName: "o",
        category: "cat",
      };
      mockCreate.mockResolvedValue(created);
      const req = {
        body: {
          title: "A",
          description: "d",
          venue: "v",
          city: "c",
          eventDateTime: "2025-01-01",
          organizerName: "o",
          category: "cat",
        },
        user: { sub: "user-1" },
      };
      const res = mockRes();
      await createEvent(req, res);
      expect(mockUploadBufferToCloudinary).not.toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(created);
    });

    it("uses Cloudinary URL when file is present", async () => {
      mockUploadBufferToCloudinary.mockResolvedValue("https://cdn.example/b.png");
      const created = { eventId: "evt_fixed-uuid", bannerUrl: "https://cdn.example/b.png" };
      mockCreate.mockResolvedValue(created);
      const file = { buffer: Buffer.from("x"), mimetype: "image/png" };
      const req = {
        file,
        body: {
          title: "A",
          venue: "v",
          city: "c",
          eventDateTime: "2025-01-01",
          organizerName: "o",
          category: "cat",
        },
      };
      const res = mockRes();
      await createEvent(req, res);
      expect(mockUploadBufferToCloudinary).toHaveBeenCalledWith(
        file.buffer,
        file.mimetype,
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("returns 400 on Cloudinary upload error", async () => {
      mockUploadBufferToCloudinary.mockRejectedValue(new Error("Cloudinary failed"));
      const req = {
        file: { buffer: Buffer.from("x"), mimetype: "image/png" },
        body: {
          title: "A",
          venue: "v",
          city: "c",
          eventDateTime: "2025-01-01",
          organizerName: "o",
          category: "cat",
        },
      };
      const res = mockRes();
      await createEvent(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("updateEvent", () => {
    it("returns 404 when event missing", async () => {
      mockFindOneAndUpdate.mockResolvedValue(null);
      const res = mockRes();
      await updateEvent(
        { params: { eventId: "evt_x" }, body: { title: "N" } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("returns updated document", async () => {
      const updated = { eventId: "evt_x", title: "N" };
      mockFindOneAndUpdate.mockResolvedValue(updated);
      const res = mockRes();
      await updateEvent(
        { params: { eventId: "evt_x" }, body: { title: "N" } },
        res,
      );
      expect(res.json).toHaveBeenCalledWith(updated);
    });
  });

  describe("publishEvent", () => {
    it("returns 404 when not found", async () => {
      mockFindOneAndUpdate.mockResolvedValue(null);
      const res = mockRes();
      await publishEvent({ params: { eventId: "evt_x" } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("publishes and returns event", async () => {
      const updated = { eventId: "evt_x", status: "PUBLISHED" };
      mockFindOneAndUpdate.mockResolvedValue(updated);
      const res = mockRes();
      await publishEvent({ params: { eventId: "evt_x" } }, res);
      expect(res.json).toHaveBeenCalledWith(updated);
    });
  });

  describe("cancelEvent", () => {
    it("returns 404 when not found", async () => {
      mockFindOneAndUpdate.mockResolvedValue(null);
      const res = mockRes();
      await cancelEvent({ params: { eventId: "evt_x" } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("cancels and returns event", async () => {
      const updated = { eventId: "evt_x", status: "CANCELLED" };
      mockFindOneAndUpdate.mockResolvedValue(updated);
      const res = mockRes();
      await cancelEvent({ params: { eventId: "evt_x" } }, res);
      expect(res.json).toHaveBeenCalledWith(updated);
    });
  });
});
