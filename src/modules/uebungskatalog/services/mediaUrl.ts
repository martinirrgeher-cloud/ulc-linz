export function buildMediaUrl(fileId: string): string {
  if (!fileId) return "";
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}
export function toPreviewIframeUrl(fileId: string): string {
  if (!fileId) return "";
  return `https://drive.google.com/file/d/${fileId}/preview`;
}
export function buildDriveBlobObjectUrl(fileId: string): string {
  // Fallback: gleiche URL wie buildMediaUrl (Download-Endpoint), Browser wählt passenden Viewer
  return buildMediaUrl(fileId);
}
const mediaUrl = buildMediaUrl;
export default mediaUrl;
