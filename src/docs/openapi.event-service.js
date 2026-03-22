const componentRef = (section, name) => ({
  $ref: `#/components/${section}/${name}`,
});

const errorMessageSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
};

const eventStatusSchema = {
  type: "string",
  enum: ["DRAFT", "PUBLISHED", "CANCELLED"],
};

const ticketSummarySchema = {
  type: "object",
  properties: {
    ticketType: { type: "string" },
    price: { type: "number" },
    availableQuantity: {
      type: "number",
      description:
        "Present on single-event detail when inventory is configured.",
    },
  },
};

const eventWritableFieldsSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    venue: { type: "string" },
    city: { type: "string" },
    eventDateTime: { type: "string", format: "date-time" },
    organizerName: { type: "string" },
    category: { type: "string" },
    bannerUrl: {
      type: "string",
      description: "Ignored if `banner` file is uploaded (multipart).",
    },
  },
};

const eventCreateBodySchema = {
  allOf: [
    eventWritableFieldsSchema,
    {
      type: "object",
      required: [
        "title",
        "venue",
        "city",
        "eventDateTime",
        "organizerName",
        "category",
      ],
    },
  ],
};

const bannerPartSchema = {
  type: "object",
  properties: {
    banner: {
      type: "string",
      format: "binary",
      description: "Banner image file (JPEG, PNG, GIF, WebP, max 5MB).",
    },
  },
};

const eventCreateMultipartSchema = {
  allOf: [eventCreateBodySchema, bannerPartSchema],
};

const eventUpdateMultipartSchema = {
  allOf: [eventWritableFieldsSchema, bannerPartSchema],
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

const jsonErrorResponse = (description) => ({
  description,
  content: {
    "application/json": {
      schema: errorMessageSchema,
    },
  },
});

const jsonResponseWithSchema = (description, schema) => ({
  description,
  content: {
    "application/json": {
      schema,
    },
  },
});

const jsonArrayResponse = (description, itemSchema) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "array",
        items: itemSchema,
      },
    },
  },
});

const patchEventSubresource = (summary, description) => ({
  patch: {
    tags: ["Events"],
    summary,
    description,
    security: [{ bearerAuth: [] }],
    parameters: [componentRef("parameters", "eventId")],
    responses: {
      200: componentRef("responses", "EventOne"),
      401: componentRef("responses", "Unauthorized"),
      403: componentRef("responses", "Forbidden"),
      404: componentRef("responses", "NotFound"),
      500: componentRef("responses", "ServerError"),
    },
  },
});

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
  tags: [{ name: "Health" }, { name: "Events" }, { name: "Internal" }],
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
      BadRequest: jsonErrorResponse("Bad request (validation or upload)"),
      Unauthorized: jsonErrorResponse("Missing or invalid JWT"),
      Forbidden: jsonErrorResponse(
        "Forbidden — JWT lacks the required permission for this operation",
      ),
      NotFound: jsonErrorResponse("Resource not found"),
      ServerError: jsonErrorResponse("Server error"),
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
      EventList: jsonArrayResponse("JSON array of events", eventSchema),
      EventOne: jsonResponseWithSchema("Single event document", eventSchema),
      EventCreated: jsonResponseWithSchema("Created", eventSchema),
      InternalEventOne: jsonResponseWithSchema(
        "Event with inventory sidecars",
        internalEventDetailSchema,
      ),
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Liveness / health check",
        responses: {
          200: componentRef("responses", "HealthOk"),
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
          200: componentRef("responses", "EventList"),
          500: componentRef("responses", "ServerError"),
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
          201: componentRef("responses", "EventCreated"),
          400: componentRef("responses", "BadRequest"),
          401: componentRef("responses", "Unauthorized"),
          403: componentRef("responses", "Forbidden"),
          500: componentRef("responses", "ServerError"),
        },
      },
    },
    "/api/v1/events/{eventId}": {
      get: {
        tags: ["Events"],
        summary: "Get event by id (public detail)",
        parameters: [componentRef("parameters", "eventId")],
        responses: {
          200: componentRef("responses", "EventOne"),
          404: componentRef("responses", "NotFound"),
          500: componentRef("responses", "ServerError"),
        },
      },
      put: {
        tags: ["Events"],
        summary: "Update event",
        description: "Requires `UPDATE_EVENT`. Same body options as create.",
        security: [{ bearerAuth: [] }],
        parameters: [componentRef("parameters", "eventId")],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: eventWritableFieldsSchema,
            },
            "multipart/form-data": {
              schema: eventUpdateMultipartSchema,
            },
          },
        },
        responses: {
          200: componentRef("responses", "EventOne"),
          400: componentRef("responses", "BadRequest"),
          401: componentRef("responses", "Unauthorized"),
          403: componentRef("responses", "Forbidden"),
          404: componentRef("responses", "NotFound"),
          500: componentRef("responses", "ServerError"),
        },
      },
    },
    "/api/v1/events/{eventId}/publish": patchEventSubresource(
      "Publish event",
      "Requires `PUBLISH_EVENT`. Sets status to PUBLISHED.",
    ),
    "/api/v1/events/{eventId}/cancel": patchEventSubresource(
      "Cancel event",
      "Requires `UPDATE_EVENT`. Sets status to CANCELLED.",
    ),
    "/api/v1/events/internal/events": {
      get: {
        tags: ["Internal"],
        summary: "List all events (all statuses)",
        description: "Requires `VIEW_EVENTS`.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: componentRef("responses", "EventList"),
          401: componentRef("responses", "Unauthorized"),
          403: componentRef("responses", "Forbidden"),
          500: componentRef("responses", "ServerError"),
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
        parameters: [componentRef("parameters", "eventId")],
        responses: {
          200: componentRef("responses", "InternalEventOne"),
          401: componentRef("responses", "Unauthorized"),
          403: componentRef("responses", "Forbidden"),
          404: componentRef("responses", "NotFound"),
          500: componentRef("responses", "ServerError"),
        },
      },
    },
  },
};
