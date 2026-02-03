/**
 * @fileOverview A service to get the country code from an IP address.
 */

/**
 * Fetches the country code for a given IP address using the ip-api.com service.
 * @param ipAddress The IP address to geolocate.
 * @returns A promise that resolves to the two-letter country code (e.g., "US") or null if not found.
 */
export async function iplocation(ipAddress: string): Promise<string | null> {
  try {
    const response = await fetch(`https://ip-api.com/json/${ipAddress}?fields=countryCode`);
    if (!response.ok) {
      console.error(`IP location lookup failed with status: ${response.status}`);
      return null;
    }
    const data = await response.json();
    if (data.countryCode) {
      return data.countryCode;
    }
    return null;
  } catch (error) {
    console.error('Error fetching IP location:', error);
    return null;
  }
}
