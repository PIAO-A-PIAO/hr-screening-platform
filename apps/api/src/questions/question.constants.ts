export const QUESTION_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const QUESTION_THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;

export const QUESTION_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
]);

export const QUESTION_THUMBNAIL_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
