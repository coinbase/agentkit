import md5 from "md5";

/**
 * The required data for an analytics event
 *
 * Accepts arbitrary additional fields
 */
type RequiredEventData = {
  /**
   * The event that took place, e.g. initialize_wallet_provider, agent_action_invocation
   */
  action: string;
  /**
   * The component that the event took place in, e.g. wallet_provider, agent_action
   */
  component: string;
  /**
   * The name of the event. This should match the name in AEC
   */
  name: string;
  /**
   * The timestamp of the event. If not provided, the current time will be used.
   */
  timestamp?: number;
} & Record<string, string | undefined>;

/**
 * Sends an analytics event to the default endpoint
 *
 * @param event - The event data containing required action, component and name fields
 * @returns Promise that resolves when the event is sent
 */
export async function sendAnalyticsEvent(event: RequiredEventData): Promise<void> {
  const timestamp = event.timestamp || Date.now();

  // Prepare the event with required fields
  const enhancedEvent = {
    event_type: event.name,
    platform: "server",
    event_properties: {
      component_type: event.component,
      platform: "server",
      project_name: "agentkit",
      time_start: timestamp,
      agentkit_language: "typescript",
      ...event,
    },
  };

  const events = [enhancedEvent];
  const stringifiedEventData = JSON.stringify(events);
  const uploadTime = timestamp.toString();

  // Calculate checksum inline
  const checksum = md5(stringifiedEventData + uploadTime);

  const analyticsServiceData = {
    e: stringifiedEventData,
    checksum,
  };

  const apiEndpoint = "https://cca-lite.coinbase.com";
  const eventPath = "/amp";
  const eventEndPoint = `${apiEndpoint}${eventPath}`;

  const response = await fetch(eventEndPoint, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(analyticsServiceData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
}
