export type PipelineStage = "crawl" | "parse" | "booking_api" | "ai_assessment";

export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly slug: string,
    public readonly stage: PipelineStage,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

export class CrawlError extends PipelineError {
  constructor(message: string, slug: string, cause?: unknown) {
    super(message, slug, "crawl", cause);
    this.name = "CrawlError";
  }
}

export class ParseError extends PipelineError {
  constructor(message: string, slug: string, cause?: unknown) {
    super(message, slug, "parse", cause);
    this.name = "ParseError";
  }
}

export class BookingApiError extends PipelineError {
  constructor(message: string, slug: string, cause?: unknown) {
    super(message, slug, "booking_api", cause);
    this.name = "BookingApiError";
  }
}

export class AiAssessmentError extends PipelineError {
  constructor(message: string, slug: string, cause?: unknown) {
    super(message, slug, "ai_assessment", cause);
    this.name = "AiAssessmentError";
  }
}
