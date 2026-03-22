/** OpenAPI 3 document for the Event Service (served by Swagger UI). Models are inline (no `components.schemas`) so Swagger UI does not list a separate Schemas section. */

const errorMessageSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
};

const ticketSummarySchema = {
  type: "object",
  properties: {
    ticketType: { type: "string" },
    price: { type: "number" },
    availableQuantity: {
      type: "number",
      description: "Present on single-event detail when inventory is configured.",
    },
  },
};

const eventStatusSchema = {
  type: "string",
  enum: ["DRAFT", "PUBLISHED", "CANCELLED"],
};

const eventSchema = {
  type: "object",
  properties: {
    _id: { type: "string" },
    eventId: {
      type: "string",
      example: "evt_550e8400-e29b-41d4-a716-446655440000",
    },
    title: { type: "string" },
    description: { type: "string" },
    venue: { type: "string" },
    city: { type: "string" },
    eventDateTime: { type: "string", format: "date-time" },
    organizerName: { type: "string" },
    category: { type: "string" },
    bannerUrl: { type: "string", nullable: true },
    status: eventStatusSchema,
    createdBy: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    tickets: {
      type: "array",
      items: ticketSummarySchema,
      description: "Merged from inventory service when configured.",
    },
  },
};

const eventCreateBodySchema = {
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
    bannerUrl: { type: "string", description: "Ignored if `banner` file is uploaded." },
  },
};

const eventCreateMultipartSchema = {
  allOf: [
    eventCreateBodySchema,
    {
      type: "object",
      properties: {
        banner: {
          type: "string",
          format: "binary",
          description: "Banner image file (JPEG, PNG, GIF, WebP, max 5MB).",
        },
      },
    },
  ],
};

const eventUpdateBodySchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    venue: { type: "string" },
    city: { type: "string" },
    eventDateTime: { type: "string", format: "date-time" },
    organizerName: { type: "string" },
    category: { type: "string" },
    bannerUrl: { type: "string" },
  },
};

const eventUpdateMultipartSchema = {
  allOf: [
    eventUpdateBodySchema,
    {
      type: "object",
      properties: {
        banner: { type: "string", format: "binary" },
      },
    },
  ],
};

const internalEventDetailSchema = {
  allOf: [
    eventSchema,
    {
      type: "object",
      properties: {
        ticketInventory: { type: "object", nullable: true },
        availabilitySummary: { type: "object", nullable: true },
      },
      description: "Raw inventory sidecar payloads when inventory URL is set.",
    },
  ],
};

const errorJsonContent = {
  content: {
    "application/json": {
      schema: errorMessageSchema,
    },
  },
};

export const eventServiceOpenApi = {
  openapi: "3.0.3",
  info: {
    title: "Phoenix Event Service API",
    version: "1.0.0",
    description:
      "REST API for event lifecycle (draft, publish, cancel), public listings, and internal inventory sidecars. " +
      "Protected routes expect a JWT in `Authorization: Bearer <token>` with a `permissions` array claim.",
  },
  servers: [{ url: "/", description: "Same origin as this service" }],
  tags: [
    { name: "Health" },
    { name: "Events" },
    { name: "Internal" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "JWT must include `permissions` (string array), e.g. VIEW_EVENTS, CREATE_EVENT, UPDATE_EVENT, PUBLISH_EVENT.",
      },
    },
    parameters: {
      eventId: {
        name: "eventId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
    },
    responses: {
      BadRequest: {
        description: "Bad request (validation or upload)",
        ...errorJsonContent,
      },
      Unauthorized: {
        description: "Missing or invalid JWT",
        ...errorJsonContent,
      },
      Forbidden: {
        description: "Forbidden — JWT lacks the required permission for this operation",
        ...errorJsonContent,
      },
      NotFound: {
        description: "Resource not found",
        ...errorJsonContent,
      },
      ServerError: {
        description: "Server error",
        ...errorJsonContent,
      },
      HealthOk: {
        description: "Service is up",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                status: { type: "string", example: "ok" },
                service: { type: "string", example: "event-service" },
              },
            },
          },
        },
      },
      EventList: {
        description: "JSON array of events",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: eventSchema,
            },
          },
        },
      },
      EventOne: {
        description: "Single event document",
        content: {
          "application/json": {
            schema: eventSchema,
          },
        },
      },
      EventCreated: {
        description: "Created",
        content: {
          "application/json": {
            schema: eventSchema,
          },
        },
      },
      InternalEventOne: {
        description: "Event with inventory sidecars",
        content: {
          "application/json": {
            schema: internalEventDetailSchema,
          },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Liveness / health check",
        responses: {
          "200": { $ref: "#/components/responses/HealthOk" },
        },
      },
    },
    "/api/v1/events": {
      get: {
        tags: ["Events"],
        summary: "List published events",
        description:
          "Returns events with `status: PUBLISHED`. Ticket summaries are merged from the inventory service when configured.",
        responses: {
          "200": { $ref: "#/components/responses/EventList" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
      post: {
        tags: ["Events"],
        summary: "Create event (draft)",
        description:
          "Requires `CREATE_EVENT`. Send JSON or `multipart/form-data` with optional `banner` image (JPEG, PNG, GIF, WebP, max 5MB).",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: eventCreateBodySchema,
            },
            "multipart/form-data": {
              schema: eventCreateMultipartSchema,
            },
          },
        },
        responses: {
          "201": { $ref: "#/components/responses/EventCreated" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/api/v1/events/{eventId}": {
      get: {
        tags: ["Events"],
        summary: "Get event by id (public detail)",
        parameters: [{ $ref: "#/components/parameters/eventId" }],
        responses: {
          "200": { $ref: "#/components/responses/EventOne" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
      put: {
        tags: ["Events"],
        summary: "Update event",
        description: "Requires `UPDATE_EVENT`. Same body options as create.",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/eventId" }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: eventUpdateBodySchema,
            },
            "multipart/form-data": {
              schema: eventUpdateMultipartSchema,
            },
          },
        },
        responses: {
          "200": { $ref: "#/components/responses/EventOne" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/api/v1/events/{eventId}/publish": {
      patch: {
        tags: ["Events"],
        summary: "Publish event",
        description: "Requires `PUBLISH_EVENT`. Sets status to PUBLISHED.",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/eventId" }],
        responses: {
          "200": { $ref: "#/components/responses/EventOne" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/api/v1/events/{eventId}/cancel": {
      patch: {
        tags: ["Events"],
        summary: "Cancel event",
        description: "Requires `UPDATE_EVENT`. Sets status to CANCELLED.",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/eventId" }],
        responses: {
          "200": { $ref: "#/components/responses/EventOne" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/api/v1/events/internal/events": {
      get: {
        tags: ["Internal"],
        summary: "List all events (all statuses)",
        description: "Requires `VIEW_EVENTS`.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { $ref: "#/components/responses/EventList" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/api/v1/events/internal/events/{eventId}": {
      get: {
        tags: ["Internal"],
        summary: "Get event with inventory sidecars",
        description:
          "Requires `VIEW_EVENTS`. Includes `ticketInventory` and `availabilitySummary` when inventory URL is configured.",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/eventId" }],
        responses: {
          "200": { $ref: "#/components/responses/InternalEventOne" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
  },
};
