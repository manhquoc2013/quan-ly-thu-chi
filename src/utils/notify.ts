/**
 * App-wide user notifications (sonner).
 */

import { toast } from 'sonner';

export type NotifyOpts = {
  /** Skip toast (e.g. batch ops that show one summary) */
  silent?: boolean;
};

export const notify = {
  success(message: string, opts?: NotifyOpts) {
    if (opts?.silent) return;
    toast.success(message);
  },
  error(message: string, opts?: NotifyOpts) {
    if (opts?.silent) return;
    toast.error(message);
  },
  message(message: string, opts?: NotifyOpts) {
    if (opts?.silent) return;
    toast.message(message);
  },
};
