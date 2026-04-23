import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.js";
import { Event } from "../models/event.model.js";
import {
  fetchEventAvailability,
  fetchEventInventory,
  LIST_FETCH_TIMEOUT_MS,
  ticketsFromDetailSidecars,
  ticketsFromInventoryListResponse,
} from "../services/inventoryClient.js";
import { logHttp } from "../utils/logger.js";
import { uploadBufferToCloudinary } from "../utils/upload.js";
import { apiError } from "../utils/apiError.js";
import { eventLookupRequests } from "../observability/metrics.js";

const EVENT_WRITABLE_FIELDS = [
  "title",
  "description",
  "venue",
  "city",
  "organizerName",
  "category",
  "bannerUrl",
];

function prepareEventBody(body) {
  const data = {};
  for (const key of EVENT_WRITABLE_FIELDS) {
    if (body[key] !== undefined) {
      data[key] = body[key];
    }
  }
  if (body.eventDateTime != null) {
    const v = body.eventDateTime;
    data.eventDateTime = typeof v === "string" ? new Date(v) : v;
  }
  return data;
}

function isUploadRelatedError(err) {
  return (
    err.message?.includes("Cloudinary") ||
    err.message?.includes("Invalid file type")
  );
}

function respondAfterWriteFailure(req, res, operation, err) {
  const failVerb =
    operation === "create_event" ? "create event" : "update event";
  logHttp({
    level: "error",
    req,
    res,
    operation,
    message: `Failed to ${failVerb}`,
    metadata: { error: err.message },
  });
  return apiError(
    res,
    isUploadRelatedError(err) ? 400 : 500,
    err.message || "Internal server error",
    isUploadRelatedError(err) ? "VALIDATION_FAILED" : "INTERNAL_ERROR",
    req,
  );
}

function respondWithServerError(req, res, operation, err, failureMessage) {
  logHttp({
    level: "error",
    req,
    res,
    operation,
    message: failureMessage,
    metadata: { error: err.message },
  });
  return apiError(res, 500, "Internal server error", "INTERNAL_ERROR", req);
}

async function loadInventorySidecars(eventId, req) {
  if (!env.inventoryServiceUrl) {
    return { ticketInventory: null, availabilitySummary: null };
  }
  const opts = { requestId: req.headers["x-request-id"] };
  opts.traceId = req.headers["x-trace-id"];
  opts.traceparent = req.headers.traceparent;
  const [invRes, avRes] = await Promise.all([
    fetchEventInventory(env.inventoryServiceUrl, eventId, opts),
    fetchEventAvailability(env.inventoryServiceUrl, eventId, opts),
  ]);
  return {
    ticketInventory: invRes.ok ? invRes.data : null,
    availabilitySummary: avRes.ok ? avRes.data : null,
  };
}

async function loadTicketsForEventDetail(eventId, req) {
  const { ticketInventory, availabilitySummary } =
    await loadInventorySidecars(eventId, req);
  return ticketsFromDetailSidecars(ticketInventory, availabilitySummary);
}

async function updateEventStatus(req, res, nextStatus, labels) {
  const { eventId } = req.params;
  const {
    operation,
    startMessage,
    notFoundMessage,
    successMessage,
    failureMessage,
  } = labels;
  try {
    logHttp({
      level: "info",
      req,
      res,
      operation,
      message: startMessage,
      metadata: { eventId },
    });
    const updated = await Event.findOneAndUpdate(
      { eventId },
      { status: nextStatus },
      { new: true },
    );
    if (!updated) {
      logHttp({
        level: "info",
        req,
        res,
        operation,
        message: notFoundMessage,
        metadata: { eventId },
      });
      return apiError(res, 404, "Event not found", "EVENT_NOT_FOUND", req);
    }
    logHttp({
      level: "info",
      req,
      res,
      operation,
      message: successMessage,
      metadata: { eventId },
    });
    return res.json(updated);
  } catch (err) {
    return respondWithServerError(req, res, operation, err, failureMessage);
  }
}

export async function createEvent(req, res) {
  try {
    const eventId = `evt_${uuidv4()}`;
    const body = prepareEventBody(req.body || {});

    let bannerUrl = body.bannerUrl;
    if (req.file) {
      bannerUrl = await uploadBufferToCloudinary(
        req.file.buffer,
        req.file.mimetype,
      );
    }
    const event = await Event.create({
      eventId,
      title: body.title,
      description: body.description,
      venue: body.venue,
      city: body.city,
      eventDateTime: body.eventDateTime,
      organizerName: body.organizerName,
      category: body.category,
      ...(bannerUrl != null && { bannerUrl }),
      createdBy: req.user?.sub,
    });

    logHttp({
      level: "info",
      req,
      res,
      operation: "create_event",
      message: "Event created",
      metadata: { eventId: event.eventId },
    });

    return res.status(201).json(event);
  } catch (err) {
    return respondAfterWriteFailure(req, res, "create_event", err);
  }
}

export async function listEvents(req, res) {
  try {
    logHttp({
      level: "info",
      req,
      res,
      operation: "list_events",
      message: "Listing published events",
    });
    const events = await Event.find({ status: "PUBLISHED" }).lean();
    if (!env.inventoryServiceUrl) {
      return res.json(
        events.map((e) => ({ ...e, tickets: [] })),
      );
    }
    const opts = {
      requestId: req.headers["x-request-id"],
      traceId: req.headers["x-trace-id"],
      traceparent: req.headers.traceparent,
      timeoutMs: LIST_FETCH_TIMEOUT_MS,
    };
    const invResults = await Promise.all(
      events.map((e) =>
        fetchEventInventory(env.inventoryServiceUrl, e.eventId, opts),
      ),
    );
    const enriched = events.map((event, i) => {
      const inv = invResults[i];
      const tickets = inv.ok
        ? ticketsFromInventoryListResponse(inv.data)
        : [];
      return { ...event, tickets };
    });
    return res.json(enriched);
  } catch (err) {
    return respondWithServerError(
      req,
      res,
      "list_events",
      err,
      "Failed to list events",
    );
  }
}

export async function listAllEvents(req, res) {
  try {
    logHttp({
      level: "info",
      req,
      res,
      operation: "list_all_events",
      message: "Listing all events (DRAFT, PUBLISHED, CANCELLED)",
    });
    const events = await Event.find({}).lean();
    return res.json(events);
  } catch (err) {
    return respondWithServerError(
      req,
      res,
      "list_all_events",
      err,
      "Failed to list all events",
    );
  }
}

export async function getEventById(req, res) {
  try {
    const { eventId } = req.params;
    const event = await Event.findOne({ eventId }).lean();
    if (!event) {
      eventLookupRequests.inc({ route: "/events/:eventId", outcome: "not_found" });
      logHttp({
        level: "info",
        req,
        res,
        operation: "get_event_by_id",
        message: "Event not found",
        metadata: { eventId },
      });
      return apiError(res, 404, "Event not found", "EVENT_NOT_FOUND", req);
    }
    eventLookupRequests.inc({ route: "/events/:eventId", outcome: "success" });
    const tickets = await loadTicketsForEventDetail(eventId, req);
    return res.json({ ...event, tickets });
  } catch (err) {
    return respondWithServerError(
      req,
      res,
      "get_event_by_id",
      err,
      "Failed to fetch event",
    );
  }
}

export async function getInternalEvent(req, res) {
  try {
    const { eventId } = req.params;
    const event = await Event.findOne({ eventId }).lean();
    if (!event) {
      eventLookupRequests.inc({ route: "/events/internal/events/:eventId", outcome: "not_found" });
      logHttp({
        level: "info",
        req,
        res,
        operation: "get_internal_event",
        message: "Internal event not found",
        metadata: { eventId },
      });
      return apiError(res, 404, "Event not found", "EVENT_NOT_FOUND", req);
    }
    eventLookupRequests.inc({ route: "/events/internal/events/:eventId", outcome: "success" });
    logHttp({
      level: "info",
      req,
      res,
      operation: "get_internal_event",
      message: "Internal event fetched",
      metadata: { eventId },
    });
    const sidecars = await loadInventorySidecars(eventId, req);
    return res.json({ ...event, ...sidecars });
  } catch (err) {
    return respondWithServerError(
      req,
      res,
      "get_internal_event",
      err,
      "Failed to fetch internal event",
    );
  }
}

export async function updateEvent(req, res) {
  try {
    const { eventId } = req.params;
    logHttp({
      level: "info",
      req,
      res,
      operation: "update_event",
      message: "Updating event",
      metadata: { eventId },
    });

    const body = prepareEventBody(req.body || {});
    if (req.file) {
      body.bannerUrl = await uploadBufferToCloudinary(
        req.file.buffer,
        req.file.mimetype,
      );
    }

    const updated = await Event.findOneAndUpdate({ eventId }, body, {
      new: true,
    });
    if (!updated) {
      logHttp({
        level: "info",
        req,
        res,
        operation: "update_event",
        message: "Event to update not found",
        metadata: { eventId },
      });
      return apiError(res, 404, "Event not found", "EVENT_NOT_FOUND", req);
    }
    return res.json(updated);
  } catch (err) {
    return respondAfterWriteFailure(req, res, "update_event", err);
  }
}

export async function publishEvent(req, res) {
  return updateEventStatus(req, res, "PUBLISHED", {
    operation: "publish_event",
    startMessage: "Publishing event",
    notFoundMessage: "Event to publish not found",
    successMessage: "Event published",
    failureMessage: "Failed to publish event",
  });
}

export async function cancelEvent(req, res) {
  return updateEventStatus(req, res, "CANCELLED", {
    operation: "cancel_event",
    startMessage: "Cancelling event",
    notFoundMessage: "Event to cancel not found",
    successMessage: "Event cancelled",
    failureMessage: "Failed to cancel event",
  });
}
