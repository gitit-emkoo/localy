import * as ImageManipulator from 'expo-image-manipulator';

/** MVP: 긴 변 1600px 이하, JPEG 재압축 (문서 고정값) */
export async function compressMissionPhoto(
  localUri: string,
  width: number,
  height: number,
): Promise<string> {
  const maxEdge = 1600;
  const longEdge = Math.max(width, height);
  const landscape = width >= height;

  const actions =
    longEdge > maxEdge
      ? landscape
        ? [{ resize: { width: maxEdge } }]
        : [{ resize: { height: maxEdge } }]
      : [];

  const result = await ImageManipulator.manipulateAsync(localUri, actions, {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}
