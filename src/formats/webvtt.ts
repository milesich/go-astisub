/**
 * WebVTT format parser and writer
 * https://www.w3.org/TR/webvtt1/
 */

import { Subtitles, Item, Line, LineItem, StyleAttributes, WebVTTTag, Region } from '../types';
import { parseDuration, formatDuration } from '../utils/duration';
import { escapeHTML, unescapeHTML } from '../utils/html';
import { Scanner, removeBOM } from '../utils';

const WEBVTT_TIME_BOUNDARIES_SEPARATOR = '-->';
const WEBVTT_BLOCK_COMMENT = 'comment';
const WEBVTT_BLOCK_STYLE = 'style';
const WEBVTT_BLOCK_TEXT = 'text';
const WEBVTT_DEFAULT_STYLE_ID = 'astisub-webvtt-default-style-id';
const WEBVTT_TIMESTAMP_MAP_HEADER = 'X-TIMESTAMP-MAP';

/**
 * Parse WebVTT duration
 */
function parseWebVTTDuration(input: string): number {
  return parseDuration(input, '.', 3);
}

/**
 * Format WebVTT duration (HH:MM:SS.mmm)
 */
function formatWebVTTDuration(duration: number): string {
  return formatDuration(duration, '.', 3);
}

/**
 * Parse WebVTT position string (e.g., "50%" or "50%,center")
 */
function parseWebVTTPosition(s: string): { xPosition: string; alignment: string } | undefined {
  if (!s) return undefined;

  const parts = s.split(',');
  if (parts.length === 1) {
    return { xPosition: s.trim(), alignment: '' };
  }

  return {
    xPosition: parts[0].trim(),
    alignment: parts[1].trim(),
  };
}

/**
 * Format WebVTT position to string
 */
function formatWebVTTPosition(pos: { xPosition: string; alignment: string } | undefined): string {
  if (!pos) return '';
  if (pos.alignment) {
    return `${pos.xPosition},${pos.alignment}`;
  }
  return pos.xPosition;
}

/**
 * Parse X-TIMESTAMP-MAP header
 * Format: X-TIMESTAMP-MAP=LOCAL:00:00:00.000,MPEGTS:900000
 */
function parseWebVTTTimestampMap(line: string): { local: number; mpegTS: number } {
  const splits = line.split('=');
  if (splits.length <= 1) {
    throw new Error('Invalid X-TIMESTAMP-MAP, no "=" found');
  }

  let local = 0;
  let mpegTS = 0;

  for (const part of splits[1].split(',')) {
    const [key, value] = part.split(':', 2);
    if (!key || !value) {
      throw new Error(`Invalid X-TIMESTAMP-MAP part: ${part}`);
    }

    switch (key.toLowerCase().trim()) {
      case 'local':
        local = parseWebVTTDuration(value);
        break;
      case 'mpegts':
        mpegTS = parseInt(value, 10);
        if (isNaN(mpegTS)) {
          throw new Error(`Failed to parse MPEGTS value: ${value}`);
        }
        break;
    }
  }

  return { local, mpegTS };
}

/**
 * Format X-TIMESTAMP-MAP header
 */
function formatWebVTTTimestampMap(local: number, mpegTS: number): string {
  return `${WEBVTT_TIMESTAMP_MAP_HEADER}=LOCAL:${formatWebVTTDuration(local)},MPEGTS:${mpegTS}`;
}

/**
 * Parse WebVTT text with tags
 */
function parseWebVTTText(input: string, _styleAttrs: StyleAttributes): Line {
  const line: Line = { items: [] };
  const tagStack: WebVTTTag[] = [];

  // Simple regex-based parser for WebVTT tags
  let lastIndex = 0;
  let voiceName = '';

  // Match all tags in the input
  const tagMatches: Array<{ index: number; match: RegExpMatchArray }> = [];
  let match: RegExpExecArray | null;

  const tagRegex = /<\/*\s*([^\.\s]+)(\.[^\s\/]*)*\s*([^\/]*)\s*\/*>/g;
  while ((match = tagRegex.exec(input)) !== null) {
    tagMatches.push({ index: match.index, match: match });
  }

  // Process text and tags
  for (let i = 0; i <= tagMatches.length; i++) {
    const currentMatch = i < tagMatches.length ? tagMatches[i] : null;
    const endIndex = currentMatch ? currentMatch.index : input.length;

    // Extract text before this tag
    if (endIndex > lastIndex) {
      const text = input.substring(lastIndex, endIndex);
      const lineItems = parseWebVTTTextToken(
        tagStack.length > 0 ? { webvttTags: [...tagStack] } : undefined,
        text
      );
      line.items.push(...lineItems);
    }

    if (!currentMatch) break;

    const fullTag = currentMatch.match[0];
    const tagName = currentMatch.match[1];
    const classes = currentMatch.match[2];
    const annotation = currentMatch.match[3];

    const isClosing = fullTag.startsWith('</');

    if (isClosing) {
      // Pop tag from stack
      if (tagStack.length > 0) {
        tagStack.pop();
      }
    } else {
      // Handle voice tag
      if (tagName === 'v') {
        if (!voiceName) {
          voiceName = annotation?.trim() || '';
          line.voiceName = voiceName;
        }
      } else {
        // Push tag to stack
        const tag: WebVTTTag = {
          name: tagName,
          annotation: annotation?.trim(),
        };

        if (classes) {
          tag.classes = classes
            .split('.')
            .filter((c) => c.length > 0)
            .map((c) => c.trim());
        }

        tagStack.push(tag);
      }
    }

    lastIndex = currentMatch.index + fullTag.length;
  }

  return line;
}

/**
 * Parse WebVTT text token (handles inline timestamps)
 */
function parseWebVTTTextToken(styleAttrs: StyleAttributes | undefined, text: string): LineItem[] {
  const items: LineItem[] = [];

  // Find all inline timestamps
  const timestampMatches: Array<{ index: number; endIndex: number; timestamp: string }> = [];
  let match: RegExpExecArray | null;

  const timestampRegex = /<((?:\d{2,}:)?\d{2}:\d{2}\.\d{3})>/g;
  while ((match = timestampRegex.exec(text)) !== null) {
    timestampMatches.push({
      index: match.index,
      endIndex: match.index + match[0].length,
      timestamp: match[1],
    });
  }

  // No timestamps - return single item
  if (timestampMatches.length === 0) {
    return [
      {
        text: unescapeHTML(text),
        inlineStyle: styleAttrs,
      },
    ];
  }

  // Text before first timestamp
  if (timestampMatches[0].index > 0) {
    const beforeText = text.substring(0, timestampMatches[0].index);
    if (beforeText.trim()) {
      items.push({
        text: unescapeHTML(beforeText),
        inlineStyle: styleAttrs,
      });
    }
  }

  // Process each timestamp and text after it
  for (let i = 0; i < timestampMatches.length; i++) {
    const current = timestampMatches[i];
    const nextIndex = i + 1 < timestampMatches.length ? timestampMatches[i + 1].index : text.length;

    const afterText = text.substring(current.endIndex, nextIndex);
    if (afterText.trim()) {
      try {
        const startAt = parseWebVTTDuration(current.timestamp);
        items.push({
          text: unescapeHTML(afterText),
          inlineStyle: styleAttrs,
          startAt,
        });
      } catch (e) {
        // If timestamp parsing fails, just add text without timestamp
        items.push({
          text: unescapeHTML(afterText),
          inlineStyle: styleAttrs,
        });
      }
    }
  }

  return items;
}

/**
 * Read and parse WebVTT subtitles from a string
 */
export function readFromWebVTT(content: string): Subtitles {
  const subtitles = Subtitles.create();
  const scanner = new Scanner(removeBOM(content));

  let lineNum = 0;
  let blockName = '';
  let comments: string[] = [];
  let index = 0;
  let currentItem: Item | null = null;
  let styleAttrs: StyleAttributes = {};

  // Skip lines until we find WEBVTT header
  while (scanner.hasNext()) {
    const line = scanner.next();
    if (!line) break;
    lineNum++;

    const trimmed = line.trim();
    if (trimmed.startsWith('WEBVTT')) {
      break;
    }
  }

  // Parse content
  while (scanner.hasNext()) {
    let line = scanner.next();
    if (line === null) break;

    const trimmed = line.trim();
    lineNum++;

    // Comment block
    if (trimmed.startsWith('NOTE ')) {
      blockName = WEBVTT_BLOCK_COMMENT;
      comments.push(trimmed.substring(5));
      continue;
    }

    // Empty line
    if (trimmed.length === 0) {
      // Reset block if not in style or handle style end
      if (blockName === WEBVTT_BLOCK_STYLE) {
        // Check if we're done with CSS
        if (
          !styleAttrs.webvttStyles ||
          styleAttrs.webvttStyles.length === 0 ||
          styleAttrs.webvttStyles[styleAttrs.webvttStyles.length - 1].endsWith('}')
        ) {
          blockName = '';
        }
      } else {
        blockName = '';
      }

      // Reset tags
      if (styleAttrs.webvttTags) {
        styleAttrs.webvttTags = [];
      }
      continue;
    }

    // Region
    if (trimmed.startsWith('Region: ')) {
      const region: Region = {
        id: '',
        inlineStyle: {},
      };

      for (const part of trimmed.substring(8).split(/\s+/)) {
        const [key, value] = part.split('=');
        if (!key || !value) continue;

        switch (key.toLowerCase()) {
          case 'id':
            region.id = value;
            break;
          case 'lines':
            region.inlineStyle!.webvttLines = parseInt(value, 10);
            break;
          case 'regionanchor':
            region.inlineStyle!.webvttRegionAnchor = value;
            break;
          case 'scroll':
            region.inlineStyle!.webvttScroll = value;
            break;
          case 'viewportanchor':
            region.inlineStyle!.webvttViewportAnchor = value;
            break;
          case 'width':
            region.inlineStyle!.webvttWidth = value;
            break;
        }
      }

      subtitles.regions.set(region.id, region);
      continue;
    }

    // Style block
    if (trimmed.startsWith('STYLE')) {
      blockName = WEBVTT_BLOCK_STYLE;

      if (!subtitles.styles.has(WEBVTT_DEFAULT_STYLE_ID)) {
        styleAttrs = {};
        subtitles.styles.set(WEBVTT_DEFAULT_STYLE_ID, {
          id: WEBVTT_DEFAULT_STYLE_ID,
          inlineStyle: styleAttrs,
        });
      }
      continue;
    }

    // X-TIMESTAMP-MAP
    if (trimmed.startsWith(WEBVTT_TIMESTAMP_MAP_HEADER)) {
      try {
        const timestampMap = parseWebVTTTimestampMap(trimmed);
        if (!subtitles.metadata) {
          subtitles.metadata = {};
        }
        subtitles.metadata.webvttTimestampMap = timestampMap;
      } catch (e) {
        // Ignore timestamp map parsing errors
      }
      continue;
    }

    // Time boundaries (cue)
    if (trimmed.includes(WEBVTT_TIME_BOUNDARIES_SEPARATOR)) {
      blockName = WEBVTT_BLOCK_TEXT;

      currentItem = {
        startAt: 0,
        endAt: 0,
        lines: [],
        comments: [...comments],
        index,
        inlineStyle: {},
      };

      // Parse time boundaries
      const parts = trimmed.split(WEBVTT_TIME_BOUNDARIES_SEPARATOR);
      const startTime = parts[0].trim();
      const endAndSettings = parts[1].trim().split(/\s+/);
      const endTime = endAndSettings[0];

      try {
        currentItem.startAt = parseWebVTTDuration(startTime);
        currentItem.endAt = parseWebVTTDuration(endTime);
      } catch (e) {
        throw new Error(`Line ${lineNum}: Failed to parse time boundaries: ${e}`);
      }

      // Parse cue settings
      for (let i = 1; i < endAndSettings.length; i++) {
        const setting = endAndSettings[i];
        const [key, value] = setting.split(':');
        if (!key || !value) continue;

        switch (key.toLowerCase()) {
          case 'align':
            currentItem.inlineStyle!.webvttAlign = value;
            break;
          case 'line':
            currentItem.inlineStyle!.webvttLine = value;
            break;
          case 'position':
            currentItem.inlineStyle!.webvttPosition = parseWebVTTPosition(value);
            break;
          case 'region':
            if (subtitles.regions.has(value)) {
              currentItem.region = subtitles.regions.get(value);
            }
            break;
          case 'size':
            currentItem.inlineStyle!.webvttSize = value;
            break;
          case 'vertical':
            currentItem.inlineStyle!.webvttVertical = value;
            break;
        }
      }

      // Reset for next cue
      comments = [];
      index = 0;

      subtitles.items.push(currentItem);
      continue;
    }

    // Text content
    switch (blockName) {
      case WEBVTT_BLOCK_COMMENT:
        comments.push(trimmed);
        break;

      case WEBVTT_BLOCK_STYLE:
        if (!styleAttrs.webvttStyles) {
          styleAttrs.webvttStyles = [];
        }
        styleAttrs.webvttStyles.push(trimmed);
        break;

      case WEBVTT_BLOCK_TEXT:
        if (currentItem) {
          const parsedLine = parseWebVTTText(trimmed, styleAttrs);
          if (parsedLine.items.length > 0) {
            currentItem.lines.push(parsedLine);
          }
        }
        break;

      default:
        // This is likely a cue identifier (index)
        const parsedIndex = parseInt(trimmed, 10);
        if (!isNaN(parsedIndex)) {
          index = parsedIndex;
        }
        break;
    }
  }

  return subtitles;
}

/**
 * Helper to get WebVTT tag start tag
 */
function webvttTagStartTag(tag: WebVTTTag): string {
  if (!tag.name) return '';

  let result = tag.name;
  if (tag.classes && tag.classes.length > 0) {
    result += '.' + tag.classes.join('.');
  }
  if (tag.annotation) {
    result += ' ' + tag.annotation;
  }

  return '<' + result + '>';
}

/**
 * Helper to get WebVTT tag end tag
 */
function webvttTagEndTag(tag: WebVTTTag): string {
  if (!tag.name) return '';
  return '</' + tag.name + '>';
}

/**
 * Convert CSS color code to WebVTT color name
 */
function cssColorToWebVTT(rgb: string): string {
  const colors: Record<string, string> = {
    '#00ffff': 'cyan',
    '#ffff00': 'yellow',
    '#ff0000': 'red',
    '#ff00ff': 'magenta',
    '#00ff00': 'lime',
  };
  return colors[rgb.toLowerCase()] || '';
}

/**
 * Write subtitles to WebVTT format
 */
export function writeToWebVTT(subtitles: Subtitles): string {
  if (subtitles.items.length === 0) {
    throw new Error('No subtitles to write');
  }

  let output = 'WEBVTT';

  // Write X-TIMESTAMP-MAP if present
  if (subtitles.metadata?.webvttTimestampMap) {
    const tm = subtitles.metadata.webvttTimestampMap;
    output += '\n' + formatWebVTTTimestampMap(tm.local, tm.mpegTS);
  }

  output += '\n\n';

  // Write styles
  const styles: string[] = [];
  for (const [, style] of subtitles.styles) {
    if (style.inlineStyle?.webvttStyles) {
      styles.push(...style.inlineStyle.webvttStyles);
    }
  }

  if (styles.length > 0) {
    output += 'STYLE\n' + styles.join('\n') + '\n\n';
  }

  // Write regions
  const regionIds = Array.from(subtitles.regions.keys()).sort();
  for (const id of regionIds) {
    const region = subtitles.regions.get(id)!;
    output += `Region: id=${region.id}`;

    const getStyle = (prop: keyof StyleAttributes) => {
      return region.inlineStyle?.[prop] ?? region.style?.inlineStyle?.[prop];
    };

    const lines = getStyle('webvttLines');
    if (lines) output += ` lines=${lines}`;

    const regionAnchor = getStyle('webvttRegionAnchor');
    if (regionAnchor) output += ` regionanchor=${regionAnchor}`;

    const scroll = getStyle('webvttScroll');
    if (scroll) output += ` scroll=${scroll}`;

    const viewportAnchor = getStyle('webvttViewportAnchor');
    if (viewportAnchor) output += ` viewportanchor=${viewportAnchor}`;

    const width = getStyle('webvttWidth');
    if (width) output += ` width=${width}`;

    output += '\n';
  }

  if (regionIds.length > 0) {
    output += '\n';
  }

  // Write cues
  for (let i = 0; i < subtitles.items.length; i++) {
    const item = subtitles.items[i];

    // Add comments
    if (item.comments && item.comments.length > 0) {
      output += 'NOTE ' + item.comments.join('\n') + '\n\n';
    }

    // Add cue identifier
    output += `${i + 1}\n`;

    // Add time boundaries
    output += `${formatWebVTTDuration(item.startAt)} ${WEBVTT_TIME_BOUNDARIES_SEPARATOR} ${formatWebVTTDuration(item.endAt)}`;

    // Add cue settings
    const getStyle = (prop: keyof StyleAttributes) => {
      return item.inlineStyle?.[prop] ?? item.style?.inlineStyle?.[prop];
    };

    const align = getStyle('webvttAlign');
    if (align) output += ` align:${align}`;

    const line = getStyle('webvttLine');
    if (line) output += ` line:${line}`;

    const position = getStyle('webvttPosition');
    if (position && typeof position === 'object' && 'xPosition' in position) {
      output += ` position:${formatWebVTTPosition(position as { xPosition: string; alignment: string })}`;
    }

    if (item.region) output += ` region:${item.region.id}`;

    const size = getStyle('webvttSize');
    if (size) output += ` size:${size}`;

    const vertical = getStyle('webvttVertical');
    if (vertical) output += ` vertical:${vertical}`;

    output += '\n';

    // Add cue text
    for (const line of item.lines) {
      output += lineToWebVTTString(line) + '\n';
    }

    output += '\n';
  }

  return output.trimEnd() + '\n';
}

/**
 * Convert line to WebVTT string
 */
function lineToWebVTTString(line: Line): string {
  let result = '';

  if (line.voiceName) {
    result += `<v ${line.voiceName}>`;
  }

  for (let i = 0; i < line.items.length; i++) {
    const item = line.items[i];
    const previous = i > 0 ? line.items[i - 1] : undefined;
    const next = i < line.items.length - 1 ? line.items[i + 1] : undefined;

    result += lineItemToWebVTTString(item, previous, next);
  }

  return result;
}

/**
 * Convert line item to WebVTT string
 */
function lineItemToWebVTTString(
  item: LineItem,
  previous?: LineItem,
  next?: LineItem
): string {
  let result = '';

  // Add inline timestamp
  if (item.startAt) {
    result += `<${formatWebVTTDuration(item.startAt)}>`;
  }

  // Check for color
  let color = '';
  let hasColorTags = false;

  if (item.inlineStyle?.webvttTags) {
    for (const tag of item.inlineStyle.webvttTags) {
      if (tag.name === 'c') {
        hasColorTags = true;
        break;
      }
    }
  }

  if (!hasColorTags && item.inlineStyle?.ttmlColor) {
    color = cssColorToWebVTT(item.inlineStyle.ttmlColor);
  }

  // Open color tag
  if (color) {
    result += `<c.${color}>`;
  }

  // Open WebVTT tags
  if (item.inlineStyle?.webvttTags) {
    for (let i = 0; i < item.inlineStyle.webvttTags.length; i++) {
      const tag = item.inlineStyle.webvttTags[i];

      // Skip if same tag in previous item at same depth
      if (
        previous?.inlineStyle?.webvttTags &&
        previous.inlineStyle.webvttTags.length > i &&
        previous.inlineStyle.webvttTags[i].name === tag.name
      ) {
        continue;
      }

      result += webvttTagStartTag(tag);
    }
  }

  // Add text
  result += escapeHTML(item.text);

  // Close WebVTT tags (in reverse order)
  if (item.inlineStyle?.webvttTags) {
    for (let i = item.inlineStyle.webvttTags.length - 1; i >= 0; i--) {
      const tag = item.inlineStyle.webvttTags[i];

      // Skip if same tag in next item at same depth
      if (
        next?.inlineStyle?.webvttTags &&
        next.inlineStyle.webvttTags.length > i &&
        next.inlineStyle.webvttTags[i].name === tag.name
      ) {
        continue;
      }

      result += webvttTagEndTag(tag);
    }
  }

  // Close color tag
  if (color) {
    result += '</c>';
  }

  return result;
}
