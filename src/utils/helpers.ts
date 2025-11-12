/**
 * General helper utilities
 */

/**
 * Byte Order Mark for UTF-8
 */
export const BOM = '\uFEFF';
export const BOM_BYTES = new Uint8Array([0xef, 0xbb, 0xbf]);

/**
 * Check if a string starts with BOM
 */
export function hasBOM(text: string): boolean {
  return text.charCodeAt(0) === 0xfeff;
}

/**
 * Remove BOM from the beginning of a string
 */
export function removeBOM(text: string): string {
  if (hasBOM(text)) {
    return text.substring(1);
  }
  return text;
}

/**
 * Add BOM to the beginning of a string
 */
export function addBOM(text: string): string {
  if (!hasBOM(text)) {
    return BOM + text;
  }
  return text;
}

/**
 * Pad a string with a character
 */
export function padString(
  str: string,
  char: string,
  length: number,
  direction: 'left' | 'right' = 'left'
): string {
  if (str.length >= length) {
    return str;
  }

  const padding = char.repeat(length - str.length);
  return direction === 'left' ? padding + str : str + padding;
}

/**
 * Check if a string is empty or only whitespace
 */
export function isBlank(str: string): boolean {
  return str.trim().length === 0;
}

/**
 * Check if a string is not empty
 */
export function isNotBlank(str: string): boolean {
  return !isBlank(str);
}

/**
 * Parse integer safely
 */
export function parseIntSafe(str: string, defaultValue: number = 0): number {
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse float safely
 */
export function parseFloatSafe(str: string, defaultValue: number = 0): number {
  const parsed = parseFloat(str);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    return '';
  }
  return filename.substring(lastDot).toLowerCase();
}

/**
 * Detect subtitle format from file extension
 */
export function detectFormat(filename: string): string | null {
  const ext = getFileExtension(filename);
  switch (ext) {
    case '.srt':
      return 'srt';
    case '.vtt':
      return 'webvtt';
    case '.ttml':
    case '.dfxp':
      return 'ttml';
    case '.ssa':
    case '.ass':
      return 'ssa';
    case '.stl':
      return 'stl';
    case '.ts':
      return 'teletext';
    default:
      return null;
  }
}
