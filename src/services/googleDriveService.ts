/**
 * Google Drive Service — STUBBED.
 *
 * Placeholder for future Google Drive integration.
 * All methods return a rejected-like result with a reason explaining
 * that integration is not yet configured.
 *
 * To wire up: install `googleapis`, provide OAuth2 credentials,
 * and replace stub implementations with real API calls.
 */

// ── State ────────────────────────────────────────────────────────────────────

let _isConnected = false;

/**
 * Check whether the Google Drive service is connected.
 */
export function isGoogleDriveConnected(): boolean {
  return _isConnected;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface DriveResult {
  success: boolean;
  reason: string;
  data?: unknown;
}

// ── Public API ───────────────────────────────────────────────────────────────

export const googleDriveService = {
  /**
   * Stub: Connect to Google Drive.
   * In production, this would initiate an OAuth2 flow.
   */
  async connect(): Promise<DriveResult> {
    return { success: false, reason: 'Google Drive integration not yet configured' };
  },

  /**
   * Stub: Disconnect from Google Drive.
   */
  async disconnect(): Promise<DriveResult> {
    _isConnected = false;
    return { success: false, reason: 'Google Drive integration not yet configured' };
  },

  /**
   * Stub: Sync the local database to Google Drive.
   * In production, this would export the database as a file and upload it.
   */
  async syncDatabase(): Promise<DriveResult> {
    return { success: false, reason: 'Google Drive integration not yet configured' };
  },

  /**
   * Stub: Upload a file to Google Drive.
   * @param file - File-like object with name and content.
   */
  async uploadFile(_file: { name: string; content: Blob | string }): Promise<DriveResult> {
    return { success: false, reason: 'Google Drive integration not yet configured' };
  },

  /**
   * Stub: Download a file from Google Drive by file ID.
   */
  async downloadFile(_fileId: string): Promise<DriveResult> {
    return { success: false, reason: 'Google Drive integration not yet configured' };
  },
};
