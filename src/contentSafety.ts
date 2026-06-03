type StudyMaterialPayload = {
  fileDataUrl: string;
  mimeType: string;
};

type TrainingVideoPayload = {
  videoDataUrl: string;
  mimeType: string;
};

const allowedStudyMaterialMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain"
]);

const allowedTrainingVideoMimeTypes = new Set([
  "video/mp4",
  "video/ogg",
  "video/quicktime",
  "video/webm",
  "video/x-m4v"
]);

export function dataUrlMimeType(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)[;,]/i);
  return match?.[1]?.trim().toLowerCase() ?? "";
}

export function isSafeStudyMaterialFile(material: StudyMaterialPayload) {
  const declaredMimeType = material.mimeType.trim().toLowerCase();
  const actualMimeType = dataUrlMimeType(material.fileDataUrl);
  const mimeType = actualMimeType || declaredMimeType;
  return Boolean(mimeType && allowedStudyMaterialMimeTypes.has(mimeType) && (!declaredMimeType || declaredMimeType === mimeType));
}

export function isSafeTrainingVideoFile(video: TrainingVideoPayload) {
  const declaredMimeType = video.mimeType.trim().toLowerCase();
  const actualMimeType = dataUrlMimeType(video.videoDataUrl);
  const mimeType = actualMimeType || declaredMimeType;
  return Boolean(mimeType && allowedTrainingVideoMimeTypes.has(mimeType) && (!declaredMimeType || declaredMimeType === mimeType));
}
