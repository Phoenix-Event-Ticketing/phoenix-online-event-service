import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

describe("inventoryClient", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  it("fetches inventory JSON and maps list/detail ticket helpers", async () => {
    const {
      fetchEventInventory,
      fetchEventAvailability,
      ticketsFromInventoryListResponse,
      ticketsFromDetailSidecars,
    } = await import("../src/services/inventoryClient.js");

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ ticketType: "VIP", price: "10" }] }),
    });

    await expect(fetchEventInventory("", "evt_1")).resolves.toEqual({
      ok: false,
    });
    await expect(fetchEventInventory(undefined, "evt_1")).resolves.toEqual({
      ok: false,
    });

    const inv = await fetchEventInventory("http://inv", "evt a", {
      requestId: "r1",
    });
    expect(inv.ok).toBe(true);
    expect(inv.data.items[0].ticketType).toBe("VIP");

    const av = await fetchEventAvailability("http://inv", "evt_1");
    expect(av.ok).toBe(true);

    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const bad = await fetchEventInventory("http://inv", "evt_1");
    expect(bad.ok).toBe(false);

    global.fetch = jest.fn().mockRejectedValue(new Error("net"));
    const err = await fetchEventInventory("http://inv", "evt_1");
    expect(err.ok).toBe(false);

    expect(ticketsFromInventoryListResponse({ items: "bad" })).toEqual([]);
    expect(
      ticketsFromInventoryListResponse({
        items: [{ ticketType: "A", price: "5" }, { price: 1 }],
      }),
    ).toEqual([{ ticketType: "A", price: 5 }]);

    expect(
      ticketsFromDetailSidecars(
        { items: [{ ticketType: "B", price: 1, availableQuantity: "2" }] },
        null,
      ),
    ).toEqual([{ ticketType: "B", price: 1, availableQuantity: 2 }]);

    expect(
      ticketsFromDetailSidecars(null, {
        items: [{ ticketType: "C", price: 2, availableQuantity: 3 }],
      }),
    ).toEqual([{ ticketType: "C", price: 2, availableQuantity: 3 }]);

    expect(ticketsFromDetailSidecars(null, null)).toEqual([]);
  });
});

describe("uploadBufferToCloudinary", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("throws when Cloudinary env is incomplete", async () => {
    await jest.unstable_mockModule("../src/config/env.js", () => ({
      env: { cloudinary: {} },
    }));
    await jest.unstable_mockModule("../src/config/cloudinary.js", () => ({
      cloudinary: { uploader: { upload: jest.fn() } },
    }));
    const { uploadBufferToCloudinary } = await import("../src/utils/upload.js");
    await expect(uploadBufferToCloudinary(Buffer.from("x"))).rejects.toThrow(
      "Cloudinary is not configured",
    );
  });

  it("uploads and returns secure_url", async () => {
    const upload = jest
      .fn()
      .mockResolvedValue({ secure_url: "https://cdn.example/b.png" });
    await jest.unstable_mockModule("../src/config/env.js", () => ({
      env: {
        cloudinary: { cloudName: "n", apiKey: "k", apiSecret: "s" },
      },
    }));
    await jest.unstable_mockModule("../src/config/cloudinary.js", () => ({
      cloudinary: { uploader: { upload } },
    }));
    const { uploadBufferToCloudinary } = await import("../src/utils/upload.js");
    await expect(
      uploadBufferToCloudinary(Buffer.from("ab"), "image/png"),
    ).resolves.toBe("https://cdn.example/b.png");
    expect(upload).toHaveBeenCalled();
  });

  it("throws when upload returns no secure_url", async () => {
    const upload = jest.fn().mockResolvedValue({});
    await jest.unstable_mockModule("../src/config/env.js", () => ({
      env: {
        cloudinary: { cloudName: "n", apiKey: "k", apiSecret: "s" },
      },
    }));
    await jest.unstable_mockModule("../src/config/cloudinary.js", () => ({
      cloudinary: { uploader: { upload } },
    }));
    const { uploadBufferToCloudinary } = await import("../src/utils/upload.js");
    await expect(uploadBufferToCloudinary(Buffer.from("x"))).rejects.toThrow(
      "No URL returned from Cloudinary",
    );
  });
});

describe("uploadBannerOptional", () => {
  const mockSingle = jest.fn();
  let capturedOptions;
  const mockMulterFactory = jest.fn((options) => {
    capturedOptions = options;
    return { single: mockSingle };
  });
  mockMulterFactory.memoryStorage = jest.fn(() => ({}));

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    await jest.unstable_mockModule("multer", () => ({
      default: mockMulterFactory,
    }));
  });

  it("exercises fileFilter and skips multipart", async () => {
    const { uploadBannerOptional } =
      await import("../src/middleware/uploadBanner.js");
    const cb = jest.fn();
    capturedOptions.fileFilter({}, { mimetype: "image/png" }, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
    capturedOptions.fileFilter({}, { mimetype: "application/pdf" }, cb);
    expect(cb.mock.calls[1][0]).toBeInstanceOf(Error);

    const req = { is: jest.fn().mockReturnValue(false) };
    const next = jest.fn();
    uploadBannerOptional(req, {}, next);
    expect(next).toHaveBeenCalled();
  });

  it("runs multer for multipart and forwards errors", async () => {
    const { uploadBannerOptional } =
      await import("../src/middleware/uploadBanner.js");
    mockSingle.mockImplementation(() => (q, s, done) => done());
    const nextOk = jest.fn();
    uploadBannerOptional({ is: () => true }, {}, nextOk);
    expect(nextOk).toHaveBeenCalledWith();

    const err = new Error("bad");
    mockSingle.mockImplementation(() => (q, s, done) => done(err));
    const nextErr = jest.fn();
    uploadBannerOptional({ is: () => true }, {}, nextErr);
    expect(nextErr).toHaveBeenCalledWith(err);
  });
});
