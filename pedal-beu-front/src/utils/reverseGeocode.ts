import * as Location from "expo-location";

// Addis Ababa reverse-geocode results frequently come back with no `street`
// at all (the device geocoder just doesn't have street-level data there).
// When that happens, Android's geocoder often puts a Plus Code (e.g.
// "3P5J+WF9") in `name` instead of a real place name — technically a valid
// location code, but not something a driver or customer can read at a
// glance. Prefer district/subregion (actual neighborhood names) over
// `name`, and skip `name` entirely when it looks like a Plus Code.
const isPlusCode = (s?: string | null) =>
  !!s && /^[23456789CFGHJMPQRVWX]{4,6}\+[23456789CFGHJMPQRVWX]{2,3}$/i.test(s);

/**
 * Resolves a lat/lng pair to a human-readable address string using the
 * device's geocoder, e.g. "Gulele, Addis Ababa". Returns null if geocoding
 * fails or yields nothing usable — callers should keep their existing
 * fallback text in that case.
 */
export async function reverseGeocodeToAddress(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  if (!latitude || !longitude) return null;
  try {
    const [rg] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!rg) return null;

    const streetPart = [rg.streetNumber, rg.street].filter(Boolean).join(" ");
    const leadPart =
      streetPart ||
      rg.district ||
      rg.subregion ||
      (isPlusCode(rg.name) ? undefined : rg.name);
    const parts = [leadPart, rg.city, rg.region].filter(Boolean);

    return parts.length > 0 ? parts.join(", ") : null;
  } catch {
    return null;
  }
}
