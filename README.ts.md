# astisub - TypeScript

TypeScript library for manipulating subtitle files across multiple formats.

## Status

This is a TypeScript port of the [go-astisub](https://github.com/asticode/go-astisub) library, focused on SRT and WebVTT formats.

**Currently Implemented:**
- ✅ Core data structures (Subtitles, Item, Line, StyleAttributes, etc.)
- ✅ Utility functions (duration parsing/formatting, HTML handling, line scanning)
- ✅ SRT format parser and writer
- ✅ WebVTT format parser and writer
- ✅ Core operations (add, fragment, unfragment, merge, optimize, order, applyLinearCorrection)

**Supported Formats:**
- **SRT** (SubRip) - Full support with HTML tags and styling
- **WebVTT** - Full support including regions, styles, cue settings, voice tags, and timestamps

## Installation

```bash
npm install astisub
```

Or with yarn:

```bash
yarn add astisub
```

## Features

- **Multiple formats**: SRT and WebVTT with full feature support
- **Operations**: Parsing, writing, syncing, fragmenting, unfragmenting, merging, optimizing, linear correction
- **TypeScript**: Full type safety with TypeScript definitions
- **Cross-platform**: Works in Node.js environments
- **Advanced WebVTT**: Regions, styles, cue settings, voice tags, inline timestamps

## Usage

### Reading Subtitles

```typescript
import { readFromString } from 'astisub';

// Read from SRT string
const srtContent = `1
00:01:00,000 --> 00:02:00,000
Hello World`;

const subtitles = readFromString(srtContent, 'srt');

// Read from WebVTT string
const vttContent = `WEBVTT

1
00:01:00.000 --> 00:02:00.000
Hello World`;

const subtitles2 = readFromString(vttContent, 'webvtt');
```

### Writing Subtitles

```typescript
import { writeToString } from 'astisub';

// Write to SRT string
const srtContent = writeToString(subtitles, 'srt');
console.log(srtContent);

// Write to WebVTT string
const vttContent = writeToString(subtitles, 'webvtt');
console.log(vttContent);
```

### Syncing Subtitles

Add or subtract time from all subtitles (useful for syncing):

```typescript
import { add } from 'astisub';

// Shift all subtitles forward by 2 seconds (2000 milliseconds)
add(subtitles, 2000);

// Shift all subtitles backward by 2 seconds
add(subtitles, -2000);
```

### Fragmenting Subtitles

Split subtitles into fragments of a specific duration:

```typescript
import { fragment } from 'astisub';

// Fragment into 2-second segments
fragment(subtitles, 2000);
```

### Unfragmenting Subtitles

Merge consecutive identical subtitles:

```typescript
import { unfragment } from 'astisub';

unfragment(subtitles);
```

### Merging Subtitles

Combine multiple subtitle sources:

```typescript
import { merge, readFromString } from 'astisub';

const subtitles1 = readFromString(srtContent1, 'srt');
const subtitles2 = readFromString(srtContent2, 'srt');

merge(subtitles1, subtitles2);
```

### Optimizing Subtitles

Remove unused styles and regions:

```typescript
import { optimize } from 'astisub';

optimize(subtitles);
```

### Applying Linear Correction

Apply time-based linear correction to fix sync issues:

```typescript
import { applyLinearCorrection } from 'astisub';

// Map timestamp 1s -> 2s and 5s -> 7s
// All other timestamps will be adjusted proportionally
applyLinearCorrection(
  subtitles,
  1000,  // actual1 (1 second)
  2000,  // desired1 (2 seconds)
  5000,  // actual2 (5 seconds)
  7000   // desired2 (7 seconds)
);
```

### Working with Subtitle Data

```typescript
import { Subtitles } from 'astisub';

const subtitles = Subtitles.create();

// Add subtitle items
subtitles.items.push({
  startAt: 1000,  // 1 second
  endAt: 3000,    // 3 seconds
  lines: [
    {
      items: [
        { text: 'Hello World' }
      ]
    }
  ]
});

// Access subtitle properties
console.log(`Total items: ${subtitles.items.length}`);

for (const item of subtitles.items) {
  console.log(`${item.startAt} --> ${item.endAt}`);
  for (const line of item.lines) {
    const text = line.items.map(i => i.text).join('');
    console.log(text);
  }
}
```

### Duration Utilities

```typescript
import { parseDuration, formatDuration, parseSRTDuration, formatSRTDuration } from 'astisub';

// Parse duration strings
const duration1 = parseDuration('00:01:23.456', '.', 3);  // 83456 milliseconds
const duration2 = parseSRTDuration('00:01:23,456');       // 83456 milliseconds

// Format durations
const formatted1 = formatDuration(83456, '.', 3);    // "00:01:23.456"
const formatted2 = formatSRTDuration(83456);         // "00:01:23,456"
```

### HTML Utilities

```typescript
import { escapeHTML, unescapeHTML, stripHTMLTags } from 'astisub';

const escaped = escapeHTML('Hello <world> & friends');   // "Hello &lt;world&gt; &amp; friends"
const unescaped = unescapeHTML('Hello &lt;world&gt;');   // "Hello <world>"
const stripped = stripHTMLTags('Hello <b>world</b>');    // "Hello world"
```

## API Reference

### Types

- `Subtitles`: Main subtitle container
- `Item`: Individual subtitle entry with time boundaries
- `Line`: Set of formatted line items
- `LineItem`: Formatted text segment
- `StyleAttributes`: Style information for various formats
- `Duration`: Time duration in milliseconds (number)
- `Color`: RGBA color representation
- `Region`: Subtitle region definition
- `Style`: Named style definition

### Operations

- `readFromString(content, format, options?)`: Parse subtitles from string
- `writeToString(subtitles, format)`: Convert subtitles to string
- `add(subtitles, duration)`: Shift all timestamps
- `fragment(subtitles, duration)`: Fragment into segments
- `unfragment(subtitles)`: Merge consecutive identical items
- `merge(subtitles, other)`: Combine subtitle files
- `optimize(subtitles)`: Remove unused styles/regions
- `order(subtitles)`: Sort items by start time
- `removeStyling(subtitles)`: Strip all styling
- `applyLinearCorrection(subtitles, actual1, desired1, actual2, desired2)`: Apply linear time correction
- `getDuration(subtitles)`: Get total duration
- `isEmpty(subtitles)`: Check if empty

### Format Support

Fully supported:
- **SRT** (SubRip): `readFromSRT()`, `writeToSRT()`
  - HTML-like tags: `<b>`, `<i>`, `<u>`, `<font color="...">`
  - Position tags: `{\anX}` for numpad-style positioning

- **WebVTT** (Web Video Text Tracks): `readFromWebVTT()`, `writeToWebVTT()`
  - Regions with positioning and scrolling
  - Styles and CSS
  - Cue settings: align, line, position, size, vertical
  - Voice tags: `<v Speaker Name>`
  - Inline timestamps: `<00:00:10.000>`
  - Formatting tags: `<b>`, `<i>`, `<u>`, `<c>` (with classes)
  - X-TIMESTAMP-MAP for MPEG-TS synchronization

## Building

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run watch

# Run tests
npm test

# Lint
npm run lint

# Format
npm run format
```

## License

MIT (matching the original go-astisub license)

## Credits

This is a TypeScript port of [go-astisub](https://github.com/asticode/go-astisub) by Quentin Renard.
