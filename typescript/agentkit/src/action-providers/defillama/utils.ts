import { ProtocolResponse, PrunedProtocolResponse } from "./types";

/**
 * Represents a data point in a time-series array with a date property
 */
interface TimeSeriesDataPoint {
  [key: string]: unknown;
  date: number;
}

/**
 * Processes a time-series array by sorting by date (newest first) and limiting to maxEntries
 *
 * @param array - The time-series array to process
 * @param maxEntries - Maximum number of entries to keep
 * @returns The processed array (sorted and limited)
 */
const processTimeSeriesArray = (array: unknown[], maxEntries: number): unknown[] => {
  if (array.length <= maxEntries) {
    return array;
  }

  // Sort by date if array items have date property
  if (array.length > 0 && typeof array[0] === "object" && array[0] !== null && "date" in array[0]) {
    array.sort((a, b) => {
      if (
        a &&
        b &&
        typeof a === "object" &&
        typeof b === "object" &&
        "date" in a &&
        "date" in b &&
        typeof (a as TimeSeriesDataPoint).date === "number" &&
        typeof (b as TimeSeriesDataPoint).date === "number"
      ) {
        return (b as TimeSeriesDataPoint).date - (a as TimeSeriesDataPoint).date;
      }
      return 0;
    });
  }

  return array.slice(0, maxEntries);
};

/**
 * Prunes the protocol response by limiting time-series data arrays
 * to show only the most recent entries.
 *
 * @param data - The original protocol data from DefiLlama API
 * @param maxEntries - The maximum number of time-series entries to keep (default: 5)
 * @returns A pruned copy of the protocol data
 */
export const pruneGetProtocolResponse = (
  data: ProtocolResponse | null,
  maxEntries = 5,
): PrunedProtocolResponse | null => {
  if (!data) {
    return null;
  }

  const result: PrunedProtocolResponse = { ...data };

  const timeSeriesArrayPaths = ["tvl", "tokens", "tokensInUsd"];

  const processNestedObject = (obj: unknown, currentPath = ""): unknown => {
    if (!obj || typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      const isTimeSeriesArray = timeSeriesArrayPaths.some(
        path => currentPath === path || currentPath.endsWith(`.${path}`),
      );

      if (isTimeSeriesArray) {
        return processTimeSeriesArray(obj, maxEntries);
      }

      for (let i = 0; i < obj.length; i++) {
        obj[i] = processNestedObject(obj[i], `${currentPath}[${i}]`);
      }
    } else if (obj !== null) {
      // Safe to cast to Record<string, unknown> since we know it's an object and not null
      const record = obj as Record<string, unknown>;

      for (const key of Object.keys(record)) {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        const value = record[key];
        if (value && typeof value === "object") {
          record[key] = processNestedObject(value, newPath);
        }
      }
    }

    return obj;
  };

  // Special handling for chainTvls if it exists
  if (result.chainTvls) {
    for (const chain of Object.keys(result.chainTvls)) {
      const chainData = result.chainTvls[chain];

      for (const timeSeriesKey of timeSeriesArrayPaths) {
        if (chainData[timeSeriesKey] && Array.isArray(chainData[timeSeriesKey])) {
          chainData[timeSeriesKey] = processTimeSeriesArray(chainData[timeSeriesKey], maxEntries);
        }
      }
    }
  }

  processNestedObject(result);

  return result;
};
