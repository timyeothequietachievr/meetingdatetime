export type City = {
  id: string;
  name: string;
  country: string;
  timeZone: string;
  /** Approximate longitude for east→west column ordering within the same offset */
  longitude: number;
  /** Cities that observe DST at some point in the year */
  observesDst: boolean;
};

/** Curated set matching the common planning lineup (Sydney-first). */
export const CITIES: City[] = [
  {
    id: "sydney",
    name: "Sydney",
    country: "Australia",
    timeZone: "Australia/Sydney",
    longitude: 151.21,
    observesDst: true,
  },
  {
    id: "melbourne",
    name: "Melbourne",
    country: "Australia",
    timeZone: "Australia/Melbourne",
    longitude: 144.96,
    observesDst: true,
  },
  {
    id: "tokyo",
    name: "Tokyo",
    country: "Japan",
    timeZone: "Asia/Tokyo",
    longitude: 139.69,
    observesDst: false,
  },
  {
    id: "seoul",
    name: "Seoul",
    country: "South Korea",
    timeZone: "Asia/Seoul",
    longitude: 126.98,
    observesDst: false,
  },
  {
    id: "singapore",
    name: "Singapore",
    country: "Singapore",
    timeZone: "Asia/Singapore",
    longitude: 103.82,
    observesDst: false,
  },
  {
    id: "hong-kong",
    name: "Hong Kong",
    country: "Hong Kong",
    timeZone: "Asia/Hong_Kong",
    longitude: 114.17,
    observesDst: false,
  },
  {
    id: "mumbai",
    name: "Mumbai",
    country: "India",
    timeZone: "Asia/Kolkata",
    longitude: 72.88,
    observesDst: false,
  },
  {
    id: "dubai",
    name: "Dubai",
    country: "UAE",
    timeZone: "Asia/Dubai",
    longitude: 55.27,
    observesDst: false,
  },
  {
    id: "paris",
    name: "Paris",
    country: "France",
    timeZone: "Europe/Paris",
    longitude: 2.35,
    observesDst: true,
  },
  {
    id: "berlin",
    name: "Berlin",
    country: "Germany",
    timeZone: "Europe/Berlin",
    longitude: 13.41,
    observesDst: true,
  },
  {
    id: "london",
    name: "London",
    country: "United Kingdom",
    timeZone: "Europe/London",
    longitude: -0.13,
    observesDst: true,
  },
  {
    id: "new-york",
    name: "New York",
    country: "USA",
    timeZone: "America/New_York",
    longitude: -74.01,
    observesDst: true,
  },
  {
    id: "austin",
    name: "Austin",
    country: "USA",
    timeZone: "America/Chicago",
    longitude: -97.74,
    observesDst: true,
  },
  {
    id: "denver",
    name: "Denver",
    country: "USA",
    timeZone: "America/Denver",
    longitude: -104.99,
    observesDst: true,
  },
  {
    id: "los-angeles",
    name: "Los Angeles",
    country: "USA",
    timeZone: "America/Los_Angeles",
    longitude: -118.24,
    observesDst: true,
  },
  {
    id: "vancouver",
    name: "Vancouver",
    country: "Canada",
    timeZone: "America/Vancouver",
    longitude: -123.12,
    observesDst: true,
  },
  {
    id: "sao-paulo",
    name: "São Paulo",
    country: "Brazil",
    timeZone: "America/Sao_Paulo",
    longitude: -46.63,
    observesDst: false,
  },
  {
    id: "auckland",
    name: "Auckland",
    country: "New Zealand",
    timeZone: "Pacific/Auckland",
    longitude: 174.76,
    observesDst: true,
  },
];

export const DEFAULT_CITY_IDS = [
  "sydney",
  "tokyo",
  "seoul",
  "singapore",
  "paris",
  "london",
  "new-york",
  "austin",
  "los-angeles",
] as const;

export const DEFAULT_MASTER_CITY_ID = "sydney";

export function getCity(id: string): City | undefined {
  return CITIES.find((city) => city.id === id);
}
