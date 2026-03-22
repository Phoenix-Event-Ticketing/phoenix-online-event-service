const sampleEvent = {
  _id: "507f1f77bcf86cd799439011",
  eventId: "evt_550e8400-e29b-41d4-a716-446655440000",
  title: "Phoenix Tech Meetup",
  description: "Monthly developer networking and lightning talks.",
  venue: "BMICH Convention Hall A",
  city: "Colombo",
  eventDateTime: "2025-06-15T10:00:00.000Z",
  organizerName: "Phoenix Events",
  category: "TECH",
  bannerUrl:
    "https://res.cloudinary.com/demo/image/upload/v1/banners/sample.jpg",
  status: "PUBLISHED",
  createdBy: "auth0|user_abc123",
  createdAt: "2025-03-01T08:00:00.000Z",
  updatedAt: "2025-03-10T12:30:00.000Z",
};

const sampleEventDraft = {
  ...sampleEvent,
  status: "DRAFT",
  bannerUrl: null,
};

const sampleEventCancelled = {
  ...sampleEvent,
  status: "CANCELLED",
};

const schemaEvent = { type: "object", description: "Event document (JSON)" };

function inventorySidecarSchema(description) {
  return {
    type: "object",
    description,
    properties: {
      eventId: { type: "string" },
      items: { type: "array", items: { type: "object" } },
    },
  };
}

const schemaTicketInventoryPayload = inventorySidecarSchema(
  "Passthrough from Ticket Inventory `GET /inventory/event/{eventId}` (`eventId` + `items`).",
);
const schemaAvailabilitySummaryPayload = inventorySidecarSchema(
  "Passthrough from Ticket Inventory `GET /inventory/event/{eventId}/availability`.",
);
const schemaTicketDetail = {
  type: "object",
  properties: {
    ticketType: { type: "string", example: "VIP" },
    price: { type: "number", example: 99.99 },
    availableQuantity: {
      type: "integer",
      example: 42,
      description: "Seats still available for this category (from inventory).",
    },
  },
};
const schemaEventDetail = {
  allOf: [
    schemaEvent,
    {
      type: "object",
      properties: {
        tickets: {
          type: "array",
          description:
            "`ticketType`, `price`, and `availableQuantity` per category. Built from Ticket Inventory (`GET .../availability` preferred, else `GET .../inventory/event/{eventId}`). Empty when `INVENTORY_SERVICE_URL` is unset or both calls fail.",
          items: schemaTicketDetail,
        },
      },
    },
  ],
};
const schemaEventInternalInventory = {
  allOf: [
    schemaEvent,
    {
      type: "object",
      properties: {
        ticketInventory: {
          oneOf: [schemaTicketInventoryPayload, { type: "null" }],
        },
        availabilitySummary: {
          oneOf: [schemaAvailabilitySummaryPayload, { type: "null" }],
        },
      },
    },
  ],
};
const schemaTicketOffer = {
  type: "object",
  properties: {
    ticketType: { type: "string", example: "VIP" },
    price: { type: "number", example: 99.99 },
  },
};
const schemaEventListed = {
  allOf: [
    schemaEvent,
    {
      type: "object",
      properties: {
        tickets: {
          type: "array",
          description:
            "Each published event includes `ticketType` and `price` per category from Ticket Inventory (`GET /inventory/event/{eventId}`). Empty array if `INVENTORY_SERVICE_URL` is unset or the call fails.",
          items: schemaTicketOffer,
        },
      },
    },
  ],
};
const schemaErr = {
  type: "object",
  properties: { message: { type: "string" } },
};

function errJsonContent(message) {
  return {
    "application/json": {
      schema: schemaErr,
      example: { message },
    },
  };
}

const RESP = {
  serverError: {
    description: "Server error",
    content: errJsonContent("Internal server error"),
  },
  invalidFileValidation: {
    description: "Validation or upload error",
    content: errJsonContent("Invalid file type"),
  },
  invalidFileUpload: {
    description: "Upload error",
    content: errJsonContent("Invalid file type"),
  },
  jwtInvalid: {
    description: "Missing or invalid JWT",
    content: errJsonContent("Invalid or expired token"),
  },
  jwtInvalidShort: {
    description: "Unauthorized",
    content: errJsonContent("Invalid or expired token"),
  },
  authHeaderMissing: {
    description: "Unauthorized",
    content: errJsonContent("Missing or invalid Authorization header"),
  },
  authHeaderOnly: {
    content: errJsonContent("Missing or invalid Authorization header"),
  },
  forbiddenPerm: {
    description: "Insufficient permissions",
    content: errJsonContent("Forbidden"),
  },
  forbiddenShort: {
    description: "Forbidden",
    content: errJsonContent("Forbidden"),
  },
  forbiddenOnly: {
    content: errJsonContent("Forbidden"),
  },
  notFound: {
    description: "Not found",
    content: errJsonContent("Event not found"),
  },
  eventNotFound: {
    description: "Event not found",
    content: errJsonContent("Event not found"),
  },
  eventNotFoundOnly: {
    content: errJsonContent("Event not found"),
  },
};

const CREATE_EVENT_REQUIRED = [
  "title",
  "venue",
  "city",
  "eventDateTime",
  "organizerName",
  "category",
];

const createFieldTypes = {
  title: { type: "string" },
  description: { type: "string" },
  venue: { type: "string" },
  city: { type: "string" },
  eventDateTime: { type: "string", format: "date-time" },
  organizerName: { type: "string" },
  category: { type: "string" },
  bannerUrl: { type: "string" },
};

const schemaCreateMultipart = {
  type: "object",
  required: CREATE_EVENT_REQUIRED,
  properties: {
    ...createFieldTypes,
    banner: {
      type: "string",
      format: "binary",
      description:
        "Optional image; stored on Cloudinary, URL saved as `bannerUrl`.",
    },
  },
};

const schemaCreateBody = {
  type: "object",
  required: CREATE_EVENT_REQUIRED,
  properties: {
    title: { ...createFieldTypes.title, example: "New Workshop" },
    description: {
      ...createFieldTypes.description,
      example: "Hands-on session.",
    },
    venue: { ...createFieldTypes.venue, example: "Hall B" },
    city: { ...createFieldTypes.city, example: "Kandy" },
    eventDateTime: {
      ...createFieldTypes.eventDateTime,
      example: "2025-07-01T09:00:00.000Z",
    },
    organizerName: {
      ...createFieldTypes.organizerName,
      example: "Campus Guild",
    },
    category: { ...createFieldTypes.category, example: "WORKSHOP" },
    bannerUrl: {
      ...createFieldTypes.bannerUrl,
      example: "https://example.com/banner.png",
      description: "Optional if uploading a file as `banner` instead.",
    },
  },
};

const updateFieldTypes = {
  title: { type: "string" },
  description: { type: "string" },
  venue: { type: "string" },
  city: { type: "string" },
  eventDateTime: { type: "string", format: "date-time" },
  organizerName: { type: "string" },
  category: { type: "string" },
  bannerUrl: { type: "string" },
};

const schemaUpdateBody = {
  type: "object",
  properties: updateFieldTypes,
};

const schemaUpdateMultipart = {
  type: "object",
  properties: {
    ...updateFieldTypes,
    banner: { type: "string", format: "binary" },
  },
};

const pathParamEventId = {
  name: "eventId",
  in: "path",
  required: true,
  schema: { type: "string", example: sampleEvent.eventId },
};

const sampleTicketsListed = [
  { ticketType: "VIP", price: 150 },
  { ticketType: "STANDARD", price: 45 },
];

const examplePublishedListed = { ...sampleEvent, tickets: sampleTicketsListed };

const sampleTicketsDetail = [
  { ticketType: "VIP", price: 150, availableQuantity: 12 },
  { ticketType: "STANDARD", price: 45, availableQuantity: 200 },
];

const exampleEventDetail = { ...sampleEvent, tickets: sampleTicketsDetail };

function ticketInventoryItem(overrides) {
  return {
    price: 99.99,
    totalQuantity: 100,
    heldQuantity: 0,
    soldQuantity: 0,
    availableQuantity: 100,
    createdAt: "2026-03-21T10:22:19.361Z",
    updatedAt: "2026-03-21T10:22:19.361Z",
    ...overrides,
  };
}

function availabilityItem(overrides) {
  return {
    price: 99.99,
    totalQuantity: 100,
    heldQuantity: 0,
    soldQuantity: 0,
    availableQuantity: 100,
    ...overrides,
  };
}

const internalRowEventId = "evt_2bb039cb-ab37-4cb4-b0d0-1e8310613f37";

const exampleInternalEventWithInventory = {
  ...sampleEvent,
  ticketInventory: {
    eventId: sampleEvent.eventId,
    items: [
      ticketInventoryItem({
        inventoryId: "inv_e43b9b075511",
        eventId: internalRowEventId,
        ticketType: "EARLY_BIRD",
      }),
    ],
  },
  availabilitySummary: {
    eventId: sampleEvent.eventId,
    items: [
      availabilityItem({
        inventoryId: "inv_e43b9b075511",
        ticketType: "EARLY_BIRD",
      }),
      availabilityItem({
        inventoryId: "inv_525cd2ee4019",
        ticketType: "STANDARD",
      }),
      availabilityItem({
        inventoryId: "inv_71183636c8c5",
        ticketType: "VIP",
      }),
    ],
  },
};

export const eventServiceOpenApi = {
  openapi: "3.0.3",
  info: {
    title: "Phoenix Online Event Service API",
    version: "1.0.0",
    description:
      "REST API for event resources under `/api/v1/events`. JWT bearer auth is required for create, update, publish, cancel, and internal list/detail operations.",
  },
  tags: [
    {
      name: "Events (public)",
      description: "Published listings and public event detail",
    },
    {
      name: "Events (authenticated)",
      description: "Mutations and internal views (JWT + permissions)",
    },
  ],
  paths: {
    "/": {
      get: {
        tags: ["Events (public)"],
        summary: "List published events",
        description:
          "Returns all events with `status: PUBLISHED`. Each item includes a `tickets` array (`ticketType`, `price`) loaded from the Ticket Inventory Service when configured.",
        operationId: "listPublishedEvents",
        responses: {
          200: {
            description: "Array of published events",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: schemaEventListed,
                },
                example: [examplePublishedListed],
              },
            },
          },
          500: RESP.serverError,
        },
      },
      post: {
        tags: ["Events (authenticated)"],
        summary: "Create event",
        description:
          "Requires permission `CREATE_EVENT`. Send JSON or `multipart/form-data` with optional file field `banner` for image upload.",
        operationId: "createEvent",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: schemaCreateBody,
            },
            "multipart/form-data": {
              schema: {
                type: "object",
                required: [
                  "title",
                  "venue",
                  "city",
                  "eventDateTime",
                  "organizerName",
                  "category",
                ],
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  venue: { type: "string" },
                  city: { type: "string" },
                  eventDateTime: { type: "string", format: "date-time" },
                  organizerName: { type: "string" },
                  category: { type: "string" },
                  bannerUrl: { type: "string" },
                  banner: {
                    type: "string",
                    format: "binary",
                    description:
                      "Optional image; stored on Cloudinary, URL saved as `bannerUrl`.",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Created event",
            content: {
              "application/json": {
                schema: schemaEvent,
                example: sampleEventDraft,
              },
            },
          },
          400: RESP.invalidFileValidation,
          401: RESP.jwtInvalid,
          403: RESP.forbiddenPerm,
          500: RESP.serverError,
        },
      },
    },
    "/{eventId}": {
      get: {
        tags: ["Events (public)"],
        summary: "Get event by ID",
        description:
          "Loads the event from this service, then adds a `tickets` array by calling the Ticket Inventory Service at `INVENTORY_SERVICE_URL` (default `http://localhost:8080`): `GET /inventory/event/{eventId}/availability` and `GET /inventory/event/{eventId}`. Response includes only the merged `tickets` list (`ticketType`, `price`, `availableQuantity`), not raw inventory payloads. When inventory is disabled or calls fail, `tickets` is `[]`.",
        operationId: "getEventById",
        parameters: [pathParamEventId],
        responses: {
          200: {
            description: "Event found (any status)",
            content: {
              "application/json": {
                schema: schemaEventDetail,
                example: exampleEventDetail,
              },
            },
          },
          404: RESP.notFound,
          500: RESP.serverError,
        },
      },
      put: {
        tags: ["Events (authenticated)"],
        summary: "Update event",
        description:
          "Requires `UPDATE_EVENT`. Partial updates via provided fields only. Optional `banner` file upload.",
        operationId: "updateEvent",
        parameters: [pathParamEventId],
        requestBody: {
          content: {
            "application/json": {
              schema: schemaUpdateBody,
              example: {
                title: "Phoenix Tech Meetup — June",
                venue: "BMICH Hall B",
              },
            },
            "multipart/form-data": {
              schema: schemaUpdateMultipart,
            },
          },
        },
        responses: {
          200: {
            description: "Updated event",
            content: {
              "application/json": {
                schema: schemaEvent,
                example: sampleEvent,
              },
            },
          },
          400: RESP.invalidFileUpload,
          401: RESP.authHeaderMissing,
          403: RESP.forbiddenShort,
          404: RESP.eventNotFound,
          500: RESP.serverError,
        },
      },
    },
    "/{eventId}/publish": {
      patch: {
        tags: ["Events (authenticated)"],
        summary: "Publish event",
        description: "Sets `status` to `PUBLISHED`. Requires `PUBLISH_EVENT`.",
        operationId: "publishEvent",
        parameters: [
          {
            name: "eventId",
            in: "path",
            required: true,
            schema: { type: "string", example: sampleEvent.eventId },
          },
        ],
        responses: {
          200: {
            description: "Published event",
            content: {
              "application/json": {
                schema: schemaEvent,
                example: sampleEvent,
              },
            },
          },
          401: {
            content: {
              "application/json": {
                example: { message: "Invalid or expired token" },
              },
            },
          },
          403: {
            content: {
              "application/json": {
                example: { message: "Forbidden" },
              },
            },
          },
          404: {
            content: {
              "application/json": {
                example: { message: "Event not found" },
              },
            },
          },
          500: {
            content: {
              "application/json": {
                example: { message: "Internal server error" },
              },
            },
          },
        },
      },
    },
    "/{eventId}/cancel": {
      patch: {
        tags: ["Events (authenticated)"],
        summary: "Cancel event",
        description: "Sets `status` to `CANCELLED`. Requires `UPDATE_EVENT`.",
        operationId: "cancelEvent",
        parameters: [pathParamEventId],
        responses: {
          200: {
            description: "Cancelled event",
            content: {
              "application/json": {
                schema: schemaEvent,
                example: sampleEventCancelled,
              },
            },
          },
          401: RESP.jwtInvalidShort,
          403: RESP.forbiddenOnly,
          404: RESP.eventNotFoundOnly,
          500: RESP.serverError,
        },
      },
    },
    "/internal/events": {
      get: {
        tags: ["Events (authenticated)"],
        summary: "List all events (internal)",
        description: "Returns events in every status. Requires `VIEW_EVENTS`.",
        operationId: "listAllEventsInternal",
        responses: {
          200: {
            description: "All events",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: schemaEvent,
                },
                example: [sampleEventDraft, sampleEvent, sampleEventCancelled],
              },
            },
          },
          401: {
            content: {
              "application/json": {
                example: { message: "Missing or invalid Authorization header" },
              },
            },
          },
          403: {
            content: {
              "application/json": {
                example: { message: "Forbidden" },
              },
            },
          },
          500: {
            content: {
              "application/json": {
                example: { message: "Internal server error" },
              },
            },
          },
        },
      },
    },
    "/internal/events/{eventId}": {
      get: {
        tags: ["Events (authenticated)"],
        summary: "Get event by ID (internal)",
        description:
          "Returns the event plus raw Ticket Inventory payloads: `ticketInventory` (`GET /inventory/event/{eventId}`) and `availabilitySummary` (`GET .../availability`). No `tickets` array. Requires `VIEW_EVENTS`.",
        operationId: "getInternalEvent",
        parameters: [pathParamEventId],
        responses: {
          200: {
            description: "Event",
            content: {
              "application/json": {
                schema: schemaEventInternalInventory,
                example: exampleInternalEventWithInventory,
              },
            },
          },
          404: RESP.eventNotFoundOnly,
          401: RESP.jwtInvalidShort,
          403: RESP.forbiddenOnly,
          500: RESP.serverError,
        },
      },
    },
  },
};
