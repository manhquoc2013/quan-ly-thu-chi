/**
 * Compatibility facade — real implementation lives in `googleDrive.ts`.
 */

export {
  connectGoogleDrive,
  disconnectDrive,
  isDriveConnected as isGoogleDriveConnected,
  syncAppData,
  syncFromDrive,
  syncToDrive,
} from './googleDrive';
