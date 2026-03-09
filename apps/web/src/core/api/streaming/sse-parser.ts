import type { ParsedSSEEvent } from "./types";

/**
 * SSE Protocol Parser
 *
 * Parses Server-Sent Events according to the W3C specification.
 * Handles chunk boundaries correctly by maintaining an internal buffer.
 *
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
 */
export class SSEParser {
  private buffer = "";
  private currentEvent: Partial<ParsedSSEEvent> = {};
  private currentData: string[] = [];

  /**
   * Parse a chunk of text from the SSE stream.
   * May return zero or more events depending on chunk boundaries.
   *
   * @param chunk - Text chunk from the stream (may contain partial events)
   * @returns Array of complete events parsed from this chunk
   */
  parse(chunk: string): ParsedSSEEvent[] {
    this.buffer += chunk;
    const events: ParsedSSEEvent[] = [];
    const lines = this.splitLines(this.buffer);

    // Process all complete lines (keep last in buffer as it may be incomplete)
    for (let i = 0; i < lines.length - 1; i++) {
      this.processLine(lines[i], events);
    }

    // Keep the last line in buffer as it may be incomplete
    this.buffer = lines[lines.length - 1];
    return events;
  }

  /**
   * Flush any remaining buffered data as a final event.
   * Call this when the stream ends to get the last event.
   *
   * @returns The final event if one was being built, undefined otherwise
   */
  flush(): ParsedSSEEvent | undefined {
    // Process remaining buffer content
    if (this.buffer.trim()) {
      this.processLine(this.buffer, []);
    }

    // Return event if we have any data or event type
    if (this.currentData.length > 0 || this.currentEvent.event) {
      return this.buildEvent();
    }

    return undefined;
  }

  /**
   * Reset the parser state.
   * Call this when reconnecting to start fresh.
   */
  reset(): void {
    this.buffer = "";
    this.currentEvent = {};
    this.currentData = [];
  }

  /**
   * Split text into lines, normalizing line endings.
   * Handles \r\n, \r, and \n line endings.
   */
  private splitLines(text: string): string[] {
    // Normalize \r\n and \r to \n, then split
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return normalized.split("\n");
  }

  /**
   * Process a single line from the SSE stream.
   * Builds events incrementally as lines arrive.
   */
  private processLine(line: string, events: ParsedSSEEvent[]): void {
    const trimmed = line.trim();

    if (trimmed === "") {
      // Blank line = dispatch the current event
      if (this.currentData.length > 0 || this.currentEvent.event) {
        events.push(this.buildEvent());
      }
    } else if (trimmed.startsWith(":")) {
      // Comment line - ignore per spec
      return;
    } else if (trimmed.startsWith("event:")) {
      // Event type field
      this.currentEvent.event = trimmed.slice(6).trim();
    } else if (trimmed.startsWith("data:")) {
      // Data field - accumulate for multi-line data
      this.currentData.push(trimmed.slice(5).trim());
    } else if (trimmed.startsWith("id:")) {
      // Event ID field for Last-Event-ID replay
      this.currentEvent.id = trimmed.slice(3).trim();
    } else if (trimmed.startsWith("retry:")) {
      // Retry field - server's suggested reconnection delay
      const retry = parseInt(trimmed.slice(6).trim(), 10);
      if (!isNaN(retry)) {
        this.currentEvent.retry = retry;
      }
    }
    // Unknown fields are ignored per spec
  }

  /**
   * Build a complete event from the current accumulated state.
   * Resets the current event state after building.
   */
  private buildEvent(): ParsedSSEEvent {
    const event: ParsedSSEEvent = {
      ...this.currentEvent,
      data: this.currentData.join("\n"),
    };
    this.currentEvent = {};
    this.currentData = [];
    return event;
  }
}
