/**
 * Core subtitle operations
 */

import {
  Subtitles,
  Item,
  Line,
  Duration,
  InvalidExtensionError,
  NoSubtitlesToWriteError,
  Options,
} from './types';
import { readFromSRT, writeToSRT } from './formats/srt';
import { detectFormat } from './utils';
import * as fs from 'fs';

/**
 * Helper to convert Item to string for comparison
 */
export function itemToString(item: Item): string {
  return item.lines.map((line) => lineToString(line)).join(' - ');
}

/**
 * Helper to convert Line to string
 */
export function lineToString(line: Line): string {
  return line.items.map((item) => item.text).join('');
}

/**
 * Add a duration to all subtitle timestamps (sync operation)
 * Duration can be negative to shift backwards
 */
export function add(subtitles: Subtitles, duration: Duration): void {
  for (let i = 0; i < subtitles.items.length; i++) {
    const item = subtitles.items[i];
    item.endAt += duration;
    item.startAt += duration;

    // Remove items that are completely before time 0
    if (item.endAt <= 0 && item.startAt <= 0) {
      subtitles.items.splice(i, 1);
      i--;
    } else if (item.startAt < 0) {
      // Clamp start time to 0
      item.startAt = 0;
    }
  }
}

/**
 * Get the total duration of the subtitles
 */
export function getDuration(subtitles: Subtitles): Duration {
  if (subtitles.items.length === 0) {
    return 0;
  }
  return subtitles.items[subtitles.items.length - 1].endAt;
}

/**
 * Force the subtitles to a specific duration
 * If duration is longer, optionally add a dummy item
 * If duration is shorter, remove items past the duration
 */
export function forceDuration(
  subtitles: Subtitles,
  duration: Duration,
  addDummyItem: boolean = false
): void {
  const currentDuration = getDuration(subtitles);

  if (currentDuration === duration) {
    return;
  }

  // Requested duration is shorter than current
  if (currentDuration > duration) {
    let lastIndex = -1;

    for (let i = 0; i < subtitles.items.length; i++) {
      const item = subtitles.items[i];

      // Start time is past duration, mark for removal
      if (item.startAt >= duration) {
        lastIndex = i;
        break;
      } else if (item.endAt > duration) {
        // Clip the end time
        item.endAt = duration;
      }
    }

    // Remove items past the duration
    if (lastIndex !== -1) {
      subtitles.items = subtitles.items.slice(0, lastIndex);
    }
  }

  // Add dummy item if needed
  if (addDummyItem && getDuration(subtitles) < duration) {
    subtitles.items.push({
      startAt: duration - 1,
      endAt: duration,
      lines: [{ items: [{ text: '...' }] }],
    });
  }
}

/**
 * Fragment subtitles at regular intervals
 * Useful for creating segments of a specific duration
 */
export function fragment(subtitles: Subtitles, fragmentDuration: Duration): void {
  if (subtitles.items.length === 0) {
    return;
  }

  let fragmentStart = 0;
  let fragmentEnd = fragmentDuration;
  const lastItemEnd = subtitles.items[subtitles.items.length - 1].endAt;

  while (fragmentStart < lastItemEnd) {
    for (let i = 0; i < subtitles.items.length; i++) {
      const item = subtitles.items[i];

      // Check if subtitle spans fragment boundary
      let newItem: Item | null = null;

      // Subtitle contains fragment start
      if (item.startAt < fragmentStart && item.endAt > fragmentStart) {
        newItem = { ...item, endAt: fragmentStart };
        item.startAt = fragmentStart;
      }
      // Subtitle contains fragment end
      else if (item.startAt < fragmentEnd && item.endAt > fragmentEnd) {
        newItem = { ...item, endAt: fragmentEnd };
        item.startAt = fragmentEnd;
      }

      // Insert new item if created
      if (newItem) {
        subtitles.items.splice(i, 0, newItem);
        i++; // Skip the newly inserted item
      }
    }

    fragmentStart += fragmentDuration;
    fragmentEnd += fragmentDuration;
  }

  // Order items by start time
  order(subtitles);
}

/**
 * Check if subtitles are empty
 */
export function isEmpty(subtitles: Subtitles): boolean {
  return subtitles.items.length === 0;
}

/**
 * Merge another subtitle file into this one
 */
export function merge(subtitles: Subtitles, other: Subtitles): void {
  // Append items
  subtitles.items.push(...other.items);
  order(subtitles);

  // Add regions
  for (const [id, region] of other.regions) {
    if (!subtitles.regions.has(id)) {
      subtitles.regions.set(id, region);
    }
  }

  // Add styles
  for (const [id, style] of other.styles) {
    if (!subtitles.styles.has(id)) {
      subtitles.styles.set(id, style);
    }
  }
}

/**
 * Optimize subtitles by removing unused regions and styles
 */
export function optimize(subtitles: Subtitles): void {
  if (subtitles.items.length === 0) {
    return;
  }

  removeUnusedRegionsAndStyles(subtitles);
}

/**
 * Remove unused regions and styles
 */
function removeUnusedRegionsAndStyles(subtitles: Subtitles): void {
  const usedRegions = new Set<string>();
  const usedStyles = new Set<string>();

  // Collect used regions and styles
  for (const item of subtitles.items) {
    if (item.region) {
      usedRegions.add(item.region.id);
    }
    if (item.style) {
      usedStyles.add(item.style.id);
    }

    for (const line of item.lines) {
      for (const lineItem of line.items) {
        if (lineItem.style) {
          usedStyles.add(lineItem.style.id);
        }
      }
    }
  }

  // Add styles used by regions
  for (const [id, region] of subtitles.regions) {
    if (usedRegions.has(id)) {
      if (region.style) {
        usedStyles.add(region.style.id);
      }
    } else {
      subtitles.regions.delete(id);
    }
  }

  // Remove unused styles
  for (const [id] of subtitles.styles) {
    if (!usedStyles.has(id)) {
      subtitles.styles.delete(id);
    }
  }
}

/**
 * Order items by start time (stable sort)
 */
export function order(subtitles: Subtitles): void {
  if (subtitles.items.length <= 1) {
    return;
  }

  subtitles.items.sort((a, b) => a.startAt - b.startAt);
}

/**
 * Remove all styling from subtitles
 */
export function removeStyling(subtitles: Subtitles): void {
  subtitles.regions.clear();
  subtitles.styles.clear();

  for (const item of subtitles.items) {
    item.region = undefined;
    item.style = undefined;
    item.inlineStyle = undefined;

    for (const line of item.lines) {
      for (const lineItem of line.items) {
        lineItem.inlineStyle = undefined;
        lineItem.style = undefined;
      }
    }
  }
}

/**
 * Unfragment subtitles by merging consecutive identical items
 */
export function unfragment(subtitles: Subtitles): void {
  if (subtitles.items.length <= 1) {
    return;
  }

  // Order first
  order(subtitles);

  // Loop through items and merge identical consecutive ones
  for (let i = 0; i < subtitles.items.length - 1; i++) {
    const currentItem = subtitles.items[i];
    const currentStr = itemToString(currentItem);

    for (let j = i + 1; j < subtitles.items.length; j++) {
      const nextItem = subtitles.items[j];
      const nextStr = itemToString(nextItem);

      // Items are the same and overlapping/adjacent
      if (currentStr === nextStr && currentItem.endAt >= nextItem.startAt) {
        // Extend the current item if the next one is longer
        if (currentItem.endAt < nextItem.endAt) {
          currentItem.endAt = nextItem.endAt;
        }
        // Remove the next item
        subtitles.items.splice(j, 1);
        j--;
      } else if (currentItem.endAt < nextItem.startAt) {
        // Gap between items, stop looking
        break;
      }
    }
  }
}

/**
 * Apply linear correction to subtitle timestamps
 * Maps actual1 -> desired1 and actual2 -> desired2 using linear interpolation
 */
export function applyLinearCorrection(
  subtitles: Subtitles,
  actual1: Duration,
  desired1: Duration,
  actual2: Duration,
  desired2: Duration
): void {
  // Calculate linear transformation parameters: y = ax + b
  const a = (desired2 - desired1) / (actual2 - actual1);
  const b = desired1 - a * actual1;

  // Apply to all items
  for (const item of subtitles.items) {
    item.startAt = Math.floor(a * item.startAt + b);
    item.endAt = Math.floor(a * item.endAt + b);
  }
}

/**
 * Read subtitles from a file
 */
export function openFile(filename: string, _options?: Options): Subtitles {
  const content = fs.readFileSync(filename, 'utf-8');
  const format = detectFormat(filename);

  if (!format) {
    throw new InvalidExtensionError();
  }

  return readFromString(content, format);
}

/**
 * Read subtitles from a string with specified format
 */
export function readFromString(
  content: string,
  format: string,
  _options?: Options
): Subtitles {
  switch (format.toLowerCase()) {
    case 'srt':
      return readFromSRT(content);
    // TODO: Add other formats
    // case 'webvtt':
    // case 'vtt':
    //   return readFromWebVTT(content);
    // case 'ttml':
    //   return readFromTTML(content);
    // case 'ssa':
    // case 'ass':
    //   return readFromSSA(content);
    default:
      throw new InvalidExtensionError();
  }
}

/**
 * Write subtitles to a file
 */
export function writeFile(subtitles: Subtitles, filename: string): void {
  const format = detectFormat(filename);

  if (!format) {
    throw new InvalidExtensionError();
  }

  const content = writeToString(subtitles, format);
  fs.writeFileSync(filename, content, 'utf-8');
}

/**
 * Write subtitles to a string with specified format
 */
export function writeToString(subtitles: Subtitles, format: string): string {
  if (subtitles.items.length === 0) {
    throw new NoSubtitlesToWriteError();
  }

  switch (format.toLowerCase()) {
    case 'srt':
      return writeToSRT(subtitles);
    // TODO: Add other formats
    // case 'webvtt':
    // case 'vtt':
    //   return writeToWebVTT(subtitles);
    // case 'ttml':
    //   return writeToTTML(subtitles);
    // case 'ssa':
    // case 'ass':
    //   return writeToSSA(subtitles);
    default:
      throw new InvalidExtensionError();
  }
}
