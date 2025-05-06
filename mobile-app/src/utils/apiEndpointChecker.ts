import { API_URL } from "@env";

/**
 * Checks if the API endpoint is accessible and returns the expected format
 * This is useful for diagnosing connection issues
 *
 * Note: The root endpoint (/) returns HTML, not JSON, so we need to use a specific API endpoint
 */
export const checkApiEndpoint = async (
  endpoint: string = "api/v1/status"
): Promise<{
  success: boolean;
  message: string;
  details?: any;
  rawResponse?: string;
}> => {
  if (!API_URL) {
    return {
      success: false,
      message: "API_URL is not set in .env file",
    };
  }

  try {
    console.log(`Checking API endpoint: ${API_URL}/${endpoint}`);

    // Try to connect to the specified endpoint
    const response = await fetch(`${API_URL}/${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    // Get the raw response text
    const responseText = await response.text();
    console.log(
      `Raw response from ${endpoint}:`,
      responseText.substring(0, 100) + (responseText.length > 100 ? "..." : "")
    );

    if (!response.ok) {
      return {
        success: false,
        message: `Server responded with status: ${response.status}`,
        details: responseText,
        rawResponse: responseText,
      };
    }

    // Try to parse the response as JSON
    let data;
    try {
      data = JSON.parse(responseText);
      return {
        success: true,
        message: "Successfully connected to API endpoint",
        details: data,
      };
    } catch (parseError) {
      return {
        success: false,
        message: `Server responded with non-JSON content: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`,
        details: parseError,
        rawResponse: responseText,
      };
    }
  } catch (error) {
    console.error(`Connection to ${endpoint} failed:`, error);
    return {
      success: false,
      message: `Connection failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      details: error,
    };
  }
};
