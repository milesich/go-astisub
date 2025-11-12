/**
 * Duration utilities for parsing and formatting timestamps
 */

import { Duration } from '../types';

/**
 * Parse a duration string in formats:
 * - "00:00:00.000" (with dot separator)
 * - "00:00:00,000" (with comma separator)
 * - "00:00:00:00" (with colon separator)
 *
 * @param input - Duration string to parse
 * @param millisecondSep - Separator for milliseconds (default: '.')
 * @param numberOfMillisecondDigits - Expected number of millisecond digits (default: 3)
 * @returns Duration in milliseconds
 */
export function parseDuration(
  input: string,
  millisecondSep: string = '.',
  numberOfMillisecondDigits: number = 3
): Duration {
  // Split milliseconds
  const parts = input.split(millisecondSep);
  let milliseconds = 0;
  let timeString: string;

  if (parts.length >= 2) {
    // Get millisecond part
    const msStr = parts[parts.length - 1].trim();

    // Validate millisecond digits
    if (msStr.length > 3) {
      throw new Error(`Invalid number of millisecond digits detected in ${input}`);
    }

    // Parse milliseconds
    milliseconds = parseInt(msStr, 10);
    if (isNaN(milliseconds)) {
      throw new Error(`Failed to parse milliseconds from ${msStr}`);
    }

    // Adjust for different number of digits
    milliseconds *= Math.pow(10, numberOfMillisecondDigits - msStr.length);

    timeString = parts.slice(0, parts.length - 1).join(millisecondSep);
  } else {
    timeString = input;
  }

  // Split hours, minutes, and seconds
  const timeParts = timeString.trim().split(':');
  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (timeParts.length === 2) {
    // MM:SS format
    minutes = parseInt(timeParts[0].trim(), 10);
    seconds = parseInt(timeParts[1].trim(), 10);
  } else if (timeParts.length === 3) {
    // HH:MM:SS format
    hours = parseInt(timeParts[0].trim(), 10);
    minutes = parseInt(timeParts[1].trim(), 10);
    seconds = parseInt(timeParts[2].trim(), 10);
  } else if (timeParts.length === 4) {
    // H:MM:SS:MS format (alternative)
    hours = parseInt(timeParts[0].trim(), 10);
    minutes = parseInt(timeParts[1].trim(), 10);
    seconds = parseInt(timeParts[2].trim(), 10);
    milliseconds = parseInt(timeParts[3].trim(), 10);
  } else {
    throw new Error(`No hours, minutes or seconds detected in ${input}`);
  }

  // Validate parsed values
  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
    throw new Error(`Failed to parse time components from ${input}`);
  }

  // Calculate total milliseconds
  return milliseconds + seconds * 1000 + minutes * 60 * 1000 + hours * 60 * 60 * 1000;
}

/**
 * Format a duration as a string
 *
 * @param duration - Duration in milliseconds
 * @param millisecondSep - Separator for milliseconds (default: '.')
 * @param numberOfMillisecondDigits - Number of millisecond digits to output (default: 3)
 * @returns Formatted duration string (HH:MM:SS.mmm)
 */
export function formatDuration(
  duration: Duration,
  millisecondSep: string = '.',
  numberOfMillisecondDigits: number = 3
): string {
  // Calculate hours
  const hours = Math.floor(duration / (60 * 60 * 1000));
  let remaining = duration % (60 * 60 * 1000);

  // Calculate minutes
  const minutes = Math.floor(remaining / (60 * 1000));
  remaining = duration % (60 * 1000);

  // Calculate seconds
  const seconds = Math.floor(remaining / 1000);
  remaining = duration % 1000;

  // Calculate milliseconds
  const ms = Math.floor(remaining / Math.pow(10, 3 - numberOfMillisecondDigits));

  // Format with leading zeros
  const hoursStr = hours.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  const secondsStr = seconds.toString().padStart(2, '0');
  const msStr = ms.toString().padStart(numberOfMillisecondDigits, '0');

  return `${hoursStr}:${minutesStr}:${secondsStr}${millisecondSep}${msStr}`;
}

/**
 * Parse SRT duration (HH:MM:SS,mmm format)
 */
export function parseSRTDuration(input: string): Duration {
  return parseDuration(input, ',', 3);
}

/**
 * Format SRT duration (HH:MM:SS,mmm format)
 */
export function formatSRTDuration(duration: Duration): string {
  return formatDuration(duration, ',', 3);
}

/**
 * Parse WebVTT duration (HH:MM:SS.mmm format)
 */
export function parseWebVTTDuration(input: string): Duration {
  return parseDuration(input, '.', 3);
}

/**
 * Format WebVTT duration (HH:MM:SS.mmm format)
 */
export function formatWebVTTDuration(duration: Duration): string {
  return formatDuration(duration, '.', 3);
}

/**
 * Parse SSA/ASS duration (H:MM:SS.cc format, where cc is centiseconds)
 */
export function parseSSADuration(input: string): Duration {
  return parseDuration(input, '.', 2);
}

/**
 * Format SSA/ASS duration (H:MM:SS.cc format)
 */
export function formatSSADuration(duration: Duration): string {
  return formatDuration(duration, '.', 2);
}
