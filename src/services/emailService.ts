/**
 * Email service — sends OTP via EmailJS REST API.
 *
 * EmailJS uses pre-defined templates with {{variable}} placeholders.
 * Template variables sent: {{to_email}} (recipient), {{user_name}}, {{otp_code}}.
 *
 * Config fields (from authStore): serviceId, templateId, publicKey, privateKey (optional).
 */

export interface EmailJSConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
  privateKey?: string;
}

/**
 * Send an OTP verification email via EmailJS.
 *
 * @param email    - Recipient email address (passed as {{to_email}})
 * @param otp      - 6-digit verification code (passed as {{otp_code}})
 * @param userName - Display name (passed as {{user_name}}), defaults to email prefix
 * @param config   - EmailJS credentials (serviceId, templateId, publicKey, privateKey?)
 */
export async function sendOTPEmail(
  email: string,
  otp: string,
  userName: string,
  config: EmailJSConfig,
): Promise<void> {
  const body: Record<string, unknown> = {
    service_id: config.serviceId,
    template_id: config.templateId,
    user_id: config.publicKey,
    template_params: {
      to_email: email,
      user_name: userName,
      otp_code: otp,
    },
  };

  if (config.privateKey) {
    body.accessToken = config.privateKey;
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
