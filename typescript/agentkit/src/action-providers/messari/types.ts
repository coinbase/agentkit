/**
 * Configuration options for the MessariActionProvider.
 */
export interface MessariActionProviderConfig {
  /**
   * Messari API Key
   */
  apiKey?: string;
}

/**
 * Message format in Messari API responses
 */
export interface MessariMessage {
  content: string;
  role: string;
}

/**
 * Response format from Messari API
 */
export interface MessariAPIResponse {
  data: {
    messages: MessariMessage[];
  };
}

/**
 * Error response format from Messari API
 */
export interface MessariErrorResponse {
  error?: string;
  data?: null | unknown;
}

/**
 * Extended Error interface for Messari API errors
 */
export interface MessariError extends Error {
  status?: number;
  statusText?: string;
  responseText?: string;
  errorResponse?: MessariErrorResponse;
}
