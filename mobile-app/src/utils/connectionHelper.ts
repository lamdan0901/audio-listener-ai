import { API_URL } from "@env";
import { Platform } from "react-native";

/**
 * Helper utility to diagnose connection issues
 */
export interface ConnectionResult {
  success: boolean;
  message: string;
  details?: any;
  rawResponse?: string;
  url?: string;
  isHtmlResponse?: boolean;
  parseError?: string;
}

export const checkConnection = async (): Promise<ConnectionResult> => {
  console.log("Checking connection to backend server...");
  console.log(`API_URL from environment: ${API_URL}`);

  // If API_URL is not set, return error
  if (!API_URL) {
    return {
      success: false,
      message: "API_URL is not set in .env file",
    };
  }

  // Determine the appropriate URL to use
  let effectiveUrl = API_URL;

  // For Android emulator, try using 10.0.2.2 which maps to host's localhost
  if (Platform.OS === "android" && API_URL.includes("192.168.")) {
    const alternativeUrl = API_URL.replace(
      /192\.168\.[0-9]+\.[0-9]+/,
      "10.0.2.2"
    );
    console.log(`On Android, also trying alternative URL: ${alternativeUrl}`);

    // Try both URLs
    const primaryResult = await tryConnection(API_URL);

    if (primaryResult.success) {
      return primaryResult;
    }

    // If primary failed, try the alternative URL
    console.log(
      `Primary connection failed, trying alternative URL: ${alternativeUrl}`
    );
    const alternativeResult = await tryConnection(alternativeUrl);
    return alternativeResult; // Return alternative result whether success or failure
  }

  // For other platforms, just try the configured URL
  return await tryConnection(effectiveUrl);
};

/**
 * Try to connect to a specific URL and return the result
 */
const tryConnection = async (url: string): Promise<ConnectionResult> => {
  try {
    console.log(`Attempting connection to: ${url}`);

    // First try the API endpoint
    try {
      // Use the specific status endpoint
      console.log(`Checking API endpoint: ${url}/api/v1/status`);
      const apiResponse = await fetch(`${url}/api/v1/status`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      // Get the raw response text
      const apiResponseText = await apiResponse.text();
      console.log(
        `Raw response from API endpoint:`,
        apiResponseText.substring(0, 100) +
          (apiResponseText.length > 100 ? "..." : "")
      );

      if (apiResponse.ok) {
        // Try to parse as JSON
        try {
          const data = JSON.parse(apiResponseText);
          return {
            success: true,
            message: "Successfully connected to API endpoint",
            details: data,
            url,
          };
        } catch (parseError) {
          console.log(
            "API endpoint returned non-JSON response, will try root endpoint"
          );
        }
      }
    } catch (apiError) {
      console.log(
        "API endpoint check failed, will try root endpoint:",
        apiError
      );
    }

    // If API endpoint fails, try the root endpoint just to check if server is running
    console.log(`Checking root endpoint: ${url}/`);
    const response = await fetch(`${url}/`, {
      method: "GET",
      headers: {
        Accept: "application/json", // Request JSON response
      },
    });

    // Get the raw response text
    const responseText = await response.text();
    console.log(
      `Raw response from ${url}:`,
      responseText.substring(0, 100) + (responseText.length > 100 ? "..." : "")
    );

    if (!response.ok) {
      return {
        success: false,
        message: `Server responded with status: ${response.status}`,
        details: responseText,
        rawResponse: responseText,
        url,
      };
    }

    // For the root endpoint, we don't expect JSON - we just check if the server is running
    // If we get an HTML response, that's actually good - it means the server is running
    if (
      responseText.includes("<!DOCTYPE html>") ||
      responseText.includes("<html>")
    ) {
      return {
        success: true,
        message: "Server is running (HTML response from root endpoint)",
        rawResponse: responseText.substring(0, 100) + "...",
        url,
        isHtmlResponse: true,
      };
    }

    // If it's not HTML, try to parse as JSON just in case
    try {
      const data = JSON.parse(responseText);
      return {
        success: true,
        message: "Successfully connected to backend server",
        details: data,
        url,
      };
    } catch (parseError) {
      // If it's not JSON either, but the response was OK, we'll still consider it a success
      // The server is running, even if it's not returning the expected format
      return {
        success: true,
        message: "Server is running but returned unexpected content format",
        rawResponse: responseText,
        url,
        parseError: String(parseError),
      };
    }
  } catch (error) {
    console.error(`Connection to ${url} failed:`, error);
    return {
      success: false,
      message: `Connection failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      details: error,
      url,
    };
  }
};
