import { v4 as uuidv4 } from "uuid";
import { Event } from "../models/event.model.js";
import { logHttp } from "../utils/logger.js";
import { uploadBufferToCloudinary } from "../utils/upload.js";

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
    const isUploadError =
      err.message?.includes("Cloudinary") ||
      err.message?.includes("Invalid file type");
    logHttp({
      level: "error",
      req,
      res,
      operation: "create_event",
      message: "Failed to create event",
      metadata: { error: err.message },
    });
    return res
      .status(isUploadError ? 400 : 500)
      .json({ message: err.message || "Internal server error" });
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
    return res.json(events);
  } catch (err) {
    logHttp({
      level: "error",
      req,
      res,
      operation: "list_events",
      message: "Failed to list events",
      metadata: { error: err.message },
    });
    return res.status(500).json({ message: "Internal server error" });
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
    logHttp({
      level: "error",
      req,
      res,
      operation: "list_all_events",
      message: "Failed to list all events",
      metadata: { error: err.message },
    });
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getEventById(req, res) {
  try {
    const { eventId } = req.params;
    const event = await Event.findOne({ eventId }).lean();
    if (!event) {
      logHttp({
        level: "info",
        req,
        res,
        operation: "get_event_by_id",
        message: "Event not found",
        metadata: { eventId },
      });
      return res.status(404).json({ message: "Event not found" });
    }
    return res.json(event);
  } catch (err) {
    logHttp({
      level: "error",
      req,
      res,
      operation: "get_event_by_id",
      message: "Failed to fetch event",
      metadata: { error: err.message },
    });
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getInternalEvent(req, res) {
  try {
    const { eventId } = req.params;
    const event = await Event.findOne({ eventId }).lean();
    if (!event) {
      logHttp({
        level: "info",
        req,
        res,
        operation: "get_internal_event",
        message: "Internal event not found",
        metadata: { eventId },
      });
      return res.status(404).json({ message: "Event not found" });
    }
    logHttp({
      level: "info",
      req,
      res,
      operation: "get_internal_event",
      message: "Internal event fetched",
      metadata: { eventId },
    });
    return res.json(event);
  } catch (err) {
    logHttp({
      level: "error",
      req,
      res,
      operation: "get_internal_event",
      message: "Failed to fetch internal event",
      metadata: { error: err.message },
    });
    return res.status(500).json({ message: "Internal server error" });
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
      return res.status(404).json({ message: "Event not found" });
    }
    return res.json(updated);
  } catch (err) {
    const isUploadError =
      err.message?.includes("Cloudinary") ||
      err.message?.includes("Invalid file type");
    logHttp({
      level: "error",
      req,
      res,
      operation: "update_event",
      message: "Failed to update event",
      metadata: { error: err.message },
    });
    return res
      .status(isUploadError ? 400 : 500)
      .json({ message: err.message || "Internal server error" });
  }
}

export async function publishEvent(req, res) {
  try {
    const { eventId } = req.params;
    logHttp({
      level: "info",
      req,
      res,
      operation: "publish_event",
      message: "Publishing event",
      metadata: { eventId },
    });
    const updated = await Event.findOneAndUpdate(
      { eventId },
      { status: "PUBLISHED" },
      { new: true },
    );
    if (!updated) {
      logHttp({
        level: "info",
        req,
        res,
        operation: "publish_event",
        message: "Event to publish not found",
        metadata: { eventId },
      });
      return res.status(404).json({ message: "Event not found" });
    }
    logHttp({
      level: "info",
      req,
      res,
      operation: "publish_event",
      message: "Event published",
      metadata: { eventId },
    });
    return res.json(updated);
  } catch (err) {
    logHttp({
      level: "error",
      req,
      res,
      operation: "publish_event",
      message: "Failed to publish event",
      metadata: { error: err.message },
    });
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function cancelEvent(req, res) {
  try {
    const { eventId } = req.params;
    logHttp({
      level: "info",
      req,
      res,
      operation: "cancel_event",
      message: "Cancelling event",
      metadata: { eventId },
    });
    const updated = await Event.findOneAndUpdate(
      { eventId },
      { status: "CANCELLED" },
      { new: true },
    );
    if (!updated) {
      logHttp({
        level: "info",
        req,
        res,
        operation: "cancel_event",
        message: "Event to cancel not found",
        metadata: { eventId },
      });
      return res.status(404).json({ message: "Event not found" });
    }
    logHttp({
      level: "info",
      req,
      res,
      operation: "cancel_event",
      message: "Event cancelled",
      metadata: { eventId },
    });
    return res.json(updated);
  } catch (err) {
    logHttp({
      level: "error",
      req,
      res,
      operation: "cancel_event",
      message: "Failed to cancel event",
      metadata: { error: err.message },
    });
    return res.status(500).json({ message: "Internal server error" });
  }
}
