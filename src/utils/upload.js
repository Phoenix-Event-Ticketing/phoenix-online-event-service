import { cloudinary } from "../config/cloudinary.js";
import { env } from "../config/env.js";

const CLOUDINARY_FOLDER = "event-banners";

export async function uploadBufferToCloudinary(
  buffer,
  mimetype = "image/jpeg",
) {
  if (
    !env.cloudinary?.cloudName ||
    !env.cloudinary?.apiKey ||
    !env.cloudinary?.apiSecret
  ) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    );
  }

  const base64 = buffer.toString("base64");
  const dataUri = `data:${mimetype};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: CLOUDINARY_FOLDER,
    resource_type: "image",
  });

  if (!result?.secure_url) throw new Error("No URL returned from Cloudinary");
  return result.secure_url;
}
