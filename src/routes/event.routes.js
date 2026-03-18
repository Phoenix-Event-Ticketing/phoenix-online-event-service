import express from "express";
import {
  createEvent,
  listEvents,
  getEventById,
  updateEvent,
  publishEvent,
  cancelEvent,
  getInternalEvent,
} from "../controllers/event.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";

const PERMISSIONS = {
  VIEW_EVENTS: "VIEW_EVENTS",
  CREATE_EVENT: "CREATE_EVENT",
  UPDATE_EVENT: "UPDATE_EVENT",
  DELETE_EVENT: "DELETE_EVENT",
  PUBLISH_EVENT: "PUBLISH_EVENT",
};

export const router = express.Router();

router.get("/", listEvents);
router.get("/:eventId", getEventById);

router.get(
  "/internal/events/:eventId",
  authenticate,
  authorize([PERMISSIONS.VIEW_EVENTS]),
  getInternalEvent,
);

router.post(
  "/",
  authenticate,
  authorize([PERMISSIONS.CREATE_EVENT]),
  createEvent,
);

router.put(
  "/:eventId",
  authenticate,
  authorize([PERMISSIONS.UPDATE_EVENT]),
  updateEvent,
);

router.patch(
  "/:eventId/publish",
  authenticate,
  authorize([PERMISSIONS.PUBLISH_EVENT]),
  publishEvent,
);

router.patch(
  "/:eventId/cancel",
  authenticate,
  authorize([PERMISSIONS.UPDATE_EVENT]),
  cancelEvent,
);
