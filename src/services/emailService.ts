/**
 * Email service — sends OTP via EmailJS REST API.
 *
 * Config from env (build-time):
 *   VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY
 * Optional: VITE_EMAILJS_PRIVATE_KEY
 *
 * Template variables: {{to_email}}, {{user_name}}, {{otp_code}}.
 */

export interface EmailJSConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
  privateKey?: string;
}

export function getEmailJSConfig(): EmailJSConfig | null {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim();
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID?.trim();
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim();
  const privateKey = import.meta.env.VITE_EMAILJS_PRIVATE_KEY?.trim();
  if (!serviceId || !templateId || !publicKey) return null;
  return {
    serviceId,
    templateId,
    publicKey,
    privateKey: privateKey || undefined,
  };
}

export function isEmailJSConfigured(): boolean {
  return getEmailJSConfig() !== null;
}

/**
 * Send an OTP verification email via EmailJS.
 */
export async function sendOTPEmail(
  email: string,
  otp: string,
  userName: string,
  config?: EmailJSConfig,
): Promise<void> {
  const resolved = config ?? getEmailJSConfig();
  if (!resolved) {
    throw new Error('EmailJS chưa được cấu hình (thiếu biến môi trường).');
  }

  const body: Record<string, unknown> = {
    service_id: resolved.serviceId,
    template_id: resolved.templateId,
    user_id: resolved.publicKey,
    template_params: {
      to_email: email,
      user_name: userName,
      otp_code: otp,
    },
  };

  if (resolved.privateKey) {
    body.accessToken = resolved.privateKey;
  }

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Không thể gửi email xác thực (HTTP ${response.status}): ${text || response.statusText}`,
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Không thể gửi email')) throw err;
    const message = err instanceof Error ? err.message : 'Đã xảy ra lỗi mạng — vui lòng thử lại.';
    throw new Error(`Không thể gửi email: ${message}`);
  }
}
