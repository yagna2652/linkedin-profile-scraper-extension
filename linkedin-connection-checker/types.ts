/**
 * Types for the LinkedIn connection checker
 */

/**
 * Possible LinkedIn connection statuses
 */
export enum ProfileStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  NOT_CONNECTED = "not_connected",
  UNKNOWN = "unknown"
}

/**
 * Profile information structure
 */
export interface Profile {
  url: string;
  status?: ProfileStatus;
  row: number;
} 