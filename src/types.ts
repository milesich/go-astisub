/**
 * Core data structures for subtitle manipulation
 */

/**
 * Duration in milliseconds
 */
export type Duration = number;

/**
 * Justification enum for text alignment
 */
export enum Justification {
  Unchanged = 1,
  Left = 2,
  Centered = 3,
  Right = 4,
}

/**
 * Color represents an RGBA color
 */
export class Color {
  alpha: number = 0;
  blue: number = 0;
  green: number = 0;
  red: number = 0;

  constructor(r: number = 0, g: number = 0, b: number = 0, a: number = 0) {
    this.red = r;
    this.green = g;
    this.blue = b;
    this.alpha = a;
  }

  /**
   * Create a color from SSA string format
   */
  static fromSSAString(s: string, base: number = 10): Color {
    const i = parseInt(s, base);
    return new Color(
      i & 0xff,
      (i >> 8) & 0xff,
      (i >> 16) & 0xff,
      (i >> 24) & 0xff
    );
  }

  /**
   * Convert color to SSA string format
   */
  toSSAString(): string {
    const value =
      (this.alpha << 24) | (this.blue << 16) | (this.green << 8) | this.red;
    return value.toString(16).padStart(8, '0');
  }

  /**
   * Convert color to TTML string format (RGB hex)
   */
  toTTMLString(): string {
    const value = (this.red << 16) | (this.green << 8) | this.blue;
    return value.toString(16).padStart(6, '0');
  }
}

// Predefined colors
export const ColorBlack = new Color(0, 0, 0);
export const ColorBlue = new Color(0, 0, 255);
export const ColorCyan = new Color(0, 255, 255);
export const ColorGray = new Color(128, 128, 128);
export const ColorGreen = new Color(0, 128, 0);
export const ColorLime = new Color(0, 255, 0);
export const ColorMagenta = new Color(255, 0, 255);
export const ColorMaroon = new Color(128, 0, 0);
export const ColorNavy = new Color(0, 0, 128);
export const ColorOlive = new Color(128, 128, 0);
export const ColorPurple = new Color(128, 0, 128);
export const ColorRed = new Color(255, 0, 0);
export const ColorSilver = new Color(192, 192, 192);
export const ColorTeal = new Color(0, 128, 128);
export const ColorYellow = new Color(255, 255, 0);
export const ColorWhite = new Color(255, 255, 255);

/**
 * STL position information
 */
export interface STLPosition {
  verticalPosition: number;
  maxRows: number;
  rows: number;
}

/**
 * WebVTT position information
 */
export interface WebVTTPosition {
  xPosition: string;
  alignment: string;
}

/**
 * WebVTT tag for styled text
 */
export interface WebVTTTag {
  name: string;
  annotation?: string;
  classes?: string[];
}

/**
 * WebVTT timestamp map for MPEG-TS synchronization
 */
export interface WebVTTTimestampMap {
  local: Duration;
  mpegTS: number;
}

/**
 * Style attributes for various subtitle formats
 */
export interface StyleAttributes {
  // SRT-specific
  srtBold?: boolean;
  srtColor?: string;
  srtItalics?: boolean;
  srtPosition?: number; // 1-9 numpad layout
  srtUnderline?: boolean;

  // SSA-specific
  ssaAlignment?: number;
  ssaAlphaLevel?: number;
  ssaAngle?: number; // degrees
  ssaBackColour?: Color;
  ssaBold?: boolean;
  ssaBorderStyle?: number;
  ssaEffect?: string;
  ssaEncoding?: number;
  ssaFontName?: string;
  ssaFontSize?: number;
  ssaItalic?: boolean;
  ssaLayer?: number;
  ssaMarginLeft?: number; // pixels
  ssaMarginRight?: number; // pixels
  ssaMarginVertical?: number; // pixels
  ssaMarked?: boolean;
  ssaOutline?: number; // pixels
  ssaOutlineColour?: Color;
  ssaPrimaryColour?: Color;
  ssaScaleX?: number; // %
  ssaScaleY?: number; // %
  ssaSecondaryColour?: Color;
  ssaShadow?: number; // pixels
  ssaSpacing?: number; // pixels
  ssaStrikeout?: boolean;
  ssaUnderline?: boolean;

  // STL-specific
  stlBoxing?: boolean;
  stlItalics?: boolean;
  stlJustification?: Justification;
  stlPosition?: STLPosition;
  stlUnderline?: boolean;

  // Teletext-specific
  teletextColor?: Color;
  teletextDoubleHeight?: boolean;
  teletextDoubleSize?: boolean;
  teletextDoubleWidth?: boolean;
  teletextSpacesAfter?: number;
  teletextSpacesBefore?: number;

  // TTML-specific
  ttmlBackgroundColor?: string;
  ttmlColor?: string;
  ttmlDirection?: string;
  ttmlDisplay?: string;
  ttmlDisplayAlign?: string;
  ttmlExtent?: string;
  ttmlFontFamily?: string;
  ttmlFontSize?: string;
  ttmlFontStyle?: string;
  ttmlFontWeight?: string;
  ttmlLineHeight?: string;
  ttmlOpacity?: string;
  ttmlOrigin?: string;
  ttmlOverflow?: string;
  ttmlPadding?: string;
  ttmlShowBackground?: string;
  ttmlTextAlign?: string;
  ttmlTextDecoration?: string;
  ttmlTextOutline?: string;
  ttmlUnicodeBidi?: string;
  ttmlVisibility?: string;
  ttmlWrapOption?: string;
  ttmlWritingMode?: string;
  ttmlZIndex?: number;

  // WebVTT-specific
  webvttAlign?: string;
  webvttBold?: boolean;
  webvttItalics?: boolean;
  webvttLine?: string;
  webvttLines?: number;
  webvttPosition?: WebVTTPosition;
  webvttRegionAnchor?: string;
  webvttScroll?: string;
  webvttSize?: string;
  webvttStyles?: string[];
  webvttTags?: WebVTTTag[];
  webvttUnderline?: boolean;
  webvttVertical?: string;
  webvttViewportAnchor?: string;
  webvttWidth?: string;
}

/**
 * Style definition
 */
export interface Style {
  id: string;
  inlineStyle?: StyleAttributes;
  style?: Style;
}

/**
 * Region definition for subtitle positioning
 */
export interface Region {
  id: string;
  inlineStyle?: StyleAttributes;
  style?: Style;
}

/**
 * Line item represents a formatted text segment
 */
export interface LineItem {
  inlineStyle?: StyleAttributes;
  startAt?: Duration;
  style?: Style;
  text: string;
}

/**
 * Line represents a set of formatted line items
 */
export interface Line {
  items: LineItem[];
  voiceName?: string;
}

/**
 * Item represents a subtitle entry with time boundaries
 */
export interface Item {
  comments?: string[];
  index?: number;
  endAt: Duration;
  inlineStyle?: StyleAttributes;
  lines: Line[];
  region?: Region;
  startAt: Duration;
  style?: Style;
}

/**
 * Metadata for subtitle files
 */
export interface Metadata {
  comments?: string[];
  framerate?: number;
  language?: string;

  // SSA-specific
  ssaCollisions?: string;
  ssaOriginalEditing?: string;
  ssaOriginalScript?: string;
  ssaOriginalTiming?: string;
  ssaOriginalTranslation?: string;
  ssaPlayDepth?: number;
  ssaPlayResX?: number;
  ssaPlayResY?: number;
  ssaScriptType?: string;
  ssaSynchPoint?: string;
  ssaTimer?: string;
  ssaUpdateDetails?: string;
  ssaUpdateProgramTitle?: string;
  ssaWrapStyle?: string;

  // STL-specific
  stlCodePageNumber?: string;
  stlCountryOfOrigin?: string;
  stlCreationDate?: Date;
  stlDisplayStandardCode?: string;
  stlDiskFormatCode?: string;
  stlDiskSequenceNumber?: string;
  stlLanguageCode?: string;
  stlMaximumNumberOfDisplayableCharactersInAnyRow?: string;
  stlMaximumNumberOfDisplayableRows?: string;
  stlOriginalEpisodeTitle?: string;
  stlOriginalProgramTitle?: string;
  stlPublisher?: string;
  stlRevisionDate?: Date;
  stlRevisionNumber?: string;
  stlSubtitleListReferenceCode?: string;
  stlTimecodeStartOfProgramme?: Duration;
  stlTimeCodeStatus?: string;
  stlTotalNumberOfDisks?: string;
  stlTotalNumberOfSubtitles?: string;
  stlTotalNumberOfTeletextSubtitles?: string;
  stlTranslatedEpisodeTitle?: string;
  stlTranslatedProgramTitle?: string;
  stlTranslatorContactDetails?: string;
  stlTranslatorName?: string;

  // General
  title?: string;

  // TTML-specific
  ttmlCopyright?: string;

  // WebVTT-specific
  webvttTimestampMap?: WebVTTTimestampMap;
}

/**
 * Options for reading/writing subtitles
 */
export interface Options {
  filename?: string;
  teletext?: TeletextOptions;
  stl?: STLOptions;
}

/**
 * Teletext-specific options
 */
export interface TeletextOptions {
  page?: number;
}

/**
 * STL-specific options
 */
export interface STLOptions {
  // Add STL-specific options as needed
}

/**
 * Subtitles represents a complete subtitle file
 */
export class Subtitles {
  items: Item[] = [];
  metadata?: Metadata;
  regions: Map<string, Region> = new Map();
  styles: Map<string, Style> = new Map();

  constructor() {
    this.items = [];
    this.regions = new Map();
    this.styles = new Map();
  }

  /**
   * Create new empty subtitles
   */
  static create(): Subtitles {
    return new Subtitles();
  }
}

/**
 * Custom errors
 */
export class SubtitleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubtitleError';
  }
}

export class InvalidExtensionError extends SubtitleError {
  constructor() {
    super('Invalid file extension');
    this.name = 'InvalidExtensionError';
  }
}

export class NoSubtitlesToWriteError extends SubtitleError {
  constructor() {
    super('No subtitles to write');
    this.name = 'NoSubtitlesToWriteError';
  }
}
