export const MIZUKI_API_URL = "https://mizuki.opencovenant.org/api/mizuki";

/**
 * GitHub owner and repository names, so a path segment cannot redirect the request.
 * Dots are legal in real names, so `.` and `..` match this pattern and are rejected
 * separately by isGithubName.
 */
export const GITHUB_NAME = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Whether a value is usable as a GitHub path segment.
 *
 * @param value - The candidate owner or repository name
 * @returns True when the value is a GitHub name and not a relative path segment
 */
export const isGithubName = (value: string): boolean =>
  GITHUB_NAME.test(value) && value !== "." && value !== "..";

export const REQUEST_TIMEOUT_MS = 20_000;
