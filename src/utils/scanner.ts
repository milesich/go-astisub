/**
 * Scanner utilities for reading lines from text with proper newline handling
 */

/**
 * Split text into lines, handling \r\n, \n, and \r line endings
 */
export function splitLines(text: string): string[] {
  // Split by any newline combination and filter out empty final line
  const lines = text.split(/\r\n|\r|\n/);

  // If the text ends with a newline, remove the last empty string
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines;
}

/**
 * Scanner class for reading lines from text
 */
export class Scanner {
  private lines: string[];
  private currentIndex: number = 0;

  constructor(text: string) {
    this.lines = splitLines(text);
  }

  /**
   * Check if there are more lines to read
   */
  hasNext(): boolean {
    return this.currentIndex < this.lines.length;
  }

  /**
   * Read the next line
   */
  next(): string | null {
    if (!this.hasNext()) {
      return null;
    }
    return this.lines[this.currentIndex++];
  }

  /**
   * Peek at the next line without consuming it
   */
  peek(): string | null {
    if (!this.hasNext()) {
      return null;
    }
    return this.lines[this.currentIndex];
  }

  /**
   * Get all remaining lines
   */
  remainingLines(): string[] {
    const remaining = this.lines.slice(this.currentIndex);
    this.currentIndex = this.lines.length;
    return remaining;
  }

  /**
   * Reset scanner to beginning
   */
  reset(): void {
    this.currentIndex = 0;
  }

  /**
   * Get current line number (1-indexed)
   */
  lineNumber(): number {
    return this.currentIndex + 1;
  }
}

/**
 * Read lines from a string, yielding non-empty lines
 */
export function* readLines(text: string): Generator<string> {
  const lines = splitLines(text);
  for (const line of lines) {
    yield line;
  }
}

/**
 * Read non-empty lines from a string
 */
export function* readNonEmptyLines(text: string): Generator<string> {
  const lines = splitLines(text);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      yield trimmed;
    }
  }
}
