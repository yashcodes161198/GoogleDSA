import sharp from "sharp";
import { MAX_MEDIA_BYTES } from "./media-limits";

export async function validateMedia(bytes: Buffer) {
  if (bytes.length === 0 || bytes.length > MAX_MEDIA_BYTES) throw new Error("Choose an image up to 3 MB.");
  const image = sharp(bytes, { animated: true, limitInputPixels: 16_000_000, failOn: "warning" });
  const meta = await image.metadata();
  if (!["gif", "png", "webp"].includes(meta.format ?? "") || !meta.width || !meta.height ||
      meta.width > 2048 || (meta.pageHeight ?? meta.height) > 2048 || (meta.pages ?? 1) > 60 ||
      meta.width * meta.height > 16_000_000) {
    throw new Error("Choose a GIF, PNG or WebP up to 2048 × 2048 pixels and 60 frames.");
  }
  // Decode and re-encode before publishing; metadata-only inspection cannot validate the pixel stream.
  const data = await image.toBuffer();
  if (data.length > MAX_MEDIA_BYTES) throw new Error("The processed image exceeds 3 MB.");
  const extension = meta.format as "gif" | "png" | "webp";
  return { data, extension, contentType: `image/${extension}`, kind: extension === "gif" ? "gif" as const : "sticker" as const };
}
