const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
]);

function inferVideoMimeType(file: File) {
  if (VIDEO_MIME_TYPES.has(file.type)) {
    return file.type;
  }

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".mp4")) return "video/mp4";
  if (lowerName.endsWith(".mov") || lowerName.endsWith(".qt")) return "video/quicktime";
  if (lowerName.endsWith(".avi")) return "video/x-msvideo";
  return "video/webm";
}

export function normalizeVideoFile(file: File) {
  const mimeType = inferVideoMimeType(file);

  if (file.type === mimeType) {
    return file;
  }

  return new File([file], file.name, {
    type: mimeType,
    lastModified: file.lastModified,
  });
}
