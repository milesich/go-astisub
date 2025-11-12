/**
 * SubRip (.srt) format parser and writer
 */

import { Subtitles, Item, Line, LineItem, StyleAttributes } from '../types';
import { parseDuration, formatDuration } from '../utils/duration';
import { escapeHTML, unescapeHTML } from '../utils/html';
import { Scanner, removeBOM } from '../utils';

const SRT_TIME_BOUNDARIES_SEPARATOR = '-->';

/**
 * Parse SRT duration - tries multiple separator formats
 */
function parseSRTDuration(input: string): number {
  const separators = [',', '.', ':'];
  for (const sep of separators) {
    try {
      return parseDuration(input, sep, 3);
    } catch (e) {
      // Try next separator
      continue;
    }
  }
  throw new Error(`Failed to parse SRT duration: ${input}`);
}

/**
 * Format SRT duration (HH:MM:SS,mmm)
 */
function formatSRTDuration(duration: number): string {
  return formatDuration(duration, ',', 3);
}

/**
 * Parse SRT text with HTML-like tags
 */
function parseSRTText(input: string, styleAttrs: StyleAttributes): Line {
  const line: Line = { items: [] };

  // Handle empty lines
  if (input.trim() === '') {
    line.items.push({ text: '' });
    return line;
  }

  // Parse HTML tags using a simple regex approach
  // SRT supports: <b>, <i>, <u>, <font color="...">
  let currentStyle: StyleAttributes = { ...styleAttrs };

  // Simple HTML tag parser
  const tagRegex = /<\/?([a-z]+)(?:\s+([^>]+))?>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(input)) !== null) {
    // Add text before this tag
    if (match.index > lastIndex) {
      const text = input.substring(lastIndex, match.index);
      if (text.trim()) {
        const itemStyle =
          currentStyle.srtBold ||
          currentStyle.srtItalics ||
          currentStyle.srtUnderline ||
          currentStyle.srtColor
            ? { ...currentStyle }
            : undefined;

        line.items.push({
          text: unescapeHTML(text),
          inlineStyle: itemStyle,
        });
      }
    }

    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const attributes = match[2];
    const isClosing = fullTag.startsWith('</');

    // Update style based on tag
    if (isClosing) {
      switch (tagName) {
        case 'b':
          currentStyle.srtBold = false;
          break;
        case 'i':
          currentStyle.srtItalics = false;
          break;
        case 'u':
          currentStyle.srtUnderline = false;
          break;
        case 'font':
          currentStyle.srtColor = undefined;
          break;
      }
    } else {
      switch (tagName) {
        case 'b':
          currentStyle.srtBold = true;
          break;
        case 'i':
          currentStyle.srtItalics = true;
          break;
        case 'u':
          currentStyle.srtUnderline = true;
          break;
        case 'font':
          if (attributes) {
            const colorMatch = attributes.match(/color\s*=\s*["']([^"']+)["']/i);
            if (colorMatch) {
              currentStyle.srtColor = colorMatch[1];
            }
          }
          break;
      }
    }

    lastIndex = tagRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < input.length) {
    const text = input.substring(lastIndex);
    if (text.trim()) {
      const itemStyle =
        currentStyle.srtBold ||
        currentStyle.srtItalics ||
        currentStyle.srtUnderline ||
        currentStyle.srtColor
          ? { ...currentStyle }
          : undefined;

      line.items.push({
        text: unescapeHTML(text),
        inlineStyle: itemStyle,
      });
    }
  }

  return line;
}

/**
 * Read and parse SRT subtitles from a string
 */
export function readFromSRT(content: string): Subtitles {
  const subtitles = Subtitles.create();
  const scanner = new Scanner(removeBOM(content));

  let lineNum = 0;
  let currentItem: Item = {
    startAt: 0,
    endAt: 0,
    lines: [],
  };
  let styleAttrs: StyleAttributes = {};

  while (scanner.hasNext()) {
    let line = scanner.next();
    if (line === null) break;

    line = line.trim();
    lineNum++;

    // Check if line contains time boundaries
    if (line.includes(SRT_TIME_BOUNDARIES_SEPARATOR)) {
      // Reset style attributes
      styleAttrs = {};

      // Remove last item of previous subtitle (the index line)
      let index = '';
      if (currentItem.lines.length > 0) {
        const lastLine = currentItem.lines[currentItem.lines.length - 1];
        index = lastLine.items.map((item) => item.text).join('');
        if (index !== '') {
          currentItem.lines = currentItem.lines.slice(0, -1);
        }
      }

      // Remove trailing empty lines
      while (currentItem.lines.length > 0) {
        const lastLine = currentItem.lines[currentItem.lines.length - 1];
        if (lastLine.items.length === 0 || lastLine.items.every((item) => !item.text)) {
          currentItem.lines.pop();
        } else {
          break;
        }
      }

      // Save previous item if it has content
      if (currentItem.lines.length > 0 || currentItem.startAt > 0) {
        subtitles.items.push(currentItem);
      }

      // Create new item
      currentItem = {
        startAt: 0,
        endAt: 0,
        lines: [],
      };

      // Parse index
      if (index !== '') {
        const indexNum = parseInt(index, 10);
        if (!isNaN(indexNum)) {
          currentItem.index = indexNum;
        }
      }

      // Extract time boundaries
      const parts = line.split(SRT_TIME_BOUNDARIES_SEPARATOR);
      if (parts.length < 2) {
        throw new Error(
          `Line ${lineNum}: time boundaries has only ${parts.length} element(s)`
        );
      }

      // Parse start time
      const startTime = parts[0].trim();
      try {
        currentItem.startAt = parseSRTDuration(startTime);
      } catch (e) {
        throw new Error(`Line ${lineNum}: failed to parse start time ${startTime}: ${e}`);
      }

      // Parse end time (remove extra stuff like positions)
      const endParts = parts[1].trim().split(/\s+/);
      const endTime = endParts[0];
      try {
        currentItem.endAt = parseSRTDuration(endTime);
      } catch (e) {
        throw new Error(`Line ${lineNum}: failed to parse end time ${endTime}: ${e}`);
      }
    } else {
      // Add text line
      const parsedLine = parseSRTText(line, styleAttrs);
      if (parsedLine.items.length > 0) {
        currentItem.lines.push(parsedLine);
      }
    }
  }

  // Add last item if it has content
  if (currentItem.lines.length > 0 || currentItem.startAt > 0) {
    // Remove trailing empty lines
    while (currentItem.lines.length > 0) {
      const lastLine = currentItem.lines[currentItem.lines.length - 1];
      if (lastLine.items.length === 0 || lastLine.items.every((item) => !item.text)) {
        currentItem.lines.pop();
      } else {
        break;
      }
    }
    subtitles.items.push(currentItem);
  }

  return subtitles;
}

/**
 * Convert line to SRT format bytes
 */
function lineToSRTString(line: Line): string {
  return line.items.map((item) => lineItemToSRTString(item)).join('') + '\n';
}

/**
 * Convert line item to SRT format string with proper tags
 */
function lineItemToSRTString(item: LineItem): string {
  let result = '';

  // Get style attributes
  const color = item.inlineStyle?.srtColor;
  const bold = item.inlineStyle?.srtBold;
  const italic = item.inlineStyle?.srtItalics;
  const underline = item.inlineStyle?.srtUnderline;
  const position = item.inlineStyle?.srtPosition;

  // Open tags
  if (color) {
    result += `<font color="${color}">`;
  }
  if (bold) {
    result += '<b>';
  }
  if (italic) {
    result += '<i>';
  }
  if (underline) {
    result += '<u>';
  }
  if (position) {
    result += `{\\an${position}}`;
  }

  // Add text
  result += escapeHTML(item.text);

  // Close tags (in reverse order)
  if (underline) {
    result += '</u>';
  }
  if (italic) {
    result += '</i>';
  }
  if (bold) {
    result += '</b>';
  }
  if (color) {
    result += '</font>';
  }

  return result;
}

/**
 * Write subtitles to SRT format
 */
export function writeToSRT(subtitles: Subtitles): string {
  if (subtitles.items.length === 0) {
    throw new Error('No subtitles to write');
  }

  let output = '\uFEFF'; // BOM

  // Loop through items
  for (let i = 0; i < subtitles.items.length; i++) {
    const item = subtitles.items[i];

    // Add index (1-based)
    output += `${i + 1}\n`;

    // Add time boundaries
    output += `${formatSRTDuration(item.startAt)} ${SRT_TIME_BOUNDARIES_SEPARATOR} ${formatSRTDuration(item.endAt)}\n`;

    // Add lines
    for (const line of item.lines) {
      output += lineToSRTString(line);
    }

    // Add separator (empty line between items)
    output += '\n';
  }

  // Remove last newline
  return output.trimEnd() + '\n';
}
