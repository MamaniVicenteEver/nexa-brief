/** Layout profiles shared by the editor, preview and publication controls. */
export const IMAGE_FORMATS = [
  { id: "4:5", width: 1080, height: 1350 },
  { id: "3:5", width: 1080, height: 1800 },
  { id: "9:16", width: 1080, height: 1920 },
] as const;

export type ImageFormat = (typeof IMAGE_FORMATS)[number]["id"];
export type ImagePostFormat = ImageFormat;
export const DEFAULT_IMAGE_FORMAT: ImageFormat = "9:16";

export function isImageFormat(value: unknown): value is ImageFormat {
  return IMAGE_FORMATS.some((format) => format.id === value);
}

export function imageFormatProfile(format: ImageFormat) {
  return IMAGE_FORMATS.find((profile) => profile.id === format) ?? IMAGE_FORMATS[2];
}
