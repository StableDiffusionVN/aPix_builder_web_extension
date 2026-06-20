export function adjacentPreviewIndex(currentIndex, direction, total) {
  if (!Number.isInteger(currentIndex) || !Number.isInteger(total) || total < 1) return -1;
  const nextIndex = currentIndex + direction;
  return nextIndex >= 0 && nextIndex < total ? nextIndex : -1;
}
