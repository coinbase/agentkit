import { MessariError, MessariErrorResponse } from "./types";

/**
 * Creates a MessariError from an HTTP response
 *
 * @param response - The fetch Response object
 * @returns A MessariError with response details
 */
export async function createMessariError(response: Response): Promise<MessariError> {
  const error = new Error(
    `Messari API returned ${response.status} ${response.statusText}`,
  ) as MessariError;
  error.status = response.status;
  error.statusText = response.statusText;

  const responseText = await response.text();
  error.responseText = responseText;
  try {
    const errorJson = JSON.parse(responseText) as MessariErrorResponse;
    error.errorResponse = errorJson;
  } catch {
    // If parsing fails, just use the raw text
  }

  return error;
}

/**
 * Formats error details for API errors
 *
 * @param error - The MessariError to format
 * @returns Formatted error message
 */
export function formatMessariApiError(error: MessariError): string {
  if (error.errorResponse?.error) {
    return `Messari API Error: ${error.errorResponse.error}`;
  }

  const errorDetails = {
    status: error.status,
    statusText: error.statusText,
    responseText: error.responseText,
    message: error.message,
  };
  return `Messari API Error: ${JSON.stringify(errorDetails, null, 2)}`;
}

/**
 * Formats generic errors
 *
 * @param error - The error to format
 * @returns Formatted error message
 */
export function formatGenericError(error: unknown): string {
  // Check if this might be a JSON string containing an error message
  if (typeof error === "string") {
    try {
      const parsedError = JSON.parse(error) as MessariErrorResponse;
      if (parsedError.error) {
        return `Messari API Error: ${parsedError.error}`;
      }
    } catch {
      // Not valid JSON, continue with normal handling
    }
  }

  return `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
}
