const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|flac|opus)(\?|#|$)/i;

/** Phân loại output theo tên file / mime: "video" | "audio" | "image". */
export function mediaKindFromName(name = "", mimeType = "") {
  if (mimeType.startsWith("video/") || VIDEO_EXT.test(name)) return "video";
  if (mimeType.startsWith("audio/") || AUDIO_EXT.test(name)) return "audio";
  return "image";
}
