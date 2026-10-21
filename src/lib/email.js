function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function isEmailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.NEXT_PUBLIC_SITE_URL);
}

export async function sendPasswordResetEmail({ email, token }) {
  if (!isEmailDeliveryConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Password-reset email delivery is not configured.");
    }
    return { delivered: false, reason: "not_configured" };
  }

  const resetUrl = new URL("/reset-password", process.env.NEXT_PUBLIC_SITE_URL);
  resetUrl.searchParams.set("token", token);
  const safeUrl = escapeHtml(resetUrl.toString());

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: "Reset your Optimus password",
      html: `<p>We received a request to reset your Optimus password.</p><p><a href="${safeUrl}">Reset password</a></p><p>This link expires in one hour. If you did not request it, you can ignore this email.</p>`,
      text: `Reset your Optimus password: ${resetUrl.toString()}\n\nThis link expires in one hour.`,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Password-reset email provider returned ${response.status}.`);
  }

  return { delivered: true };
}

export async function sendInvitationEmail({ email, inviteUrl, inviterName }) {
  if (!isEmailDeliveryConfigured()) {
    return { delivered: false, reason: "not_configured" };
  }

  const inviter = inviterName ? escapeHtml(inviterName) : "A teammate";
  const safeUrl = escapeHtml(inviteUrl);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: `${inviterName || "A teammate"} invited you to Optimus`,
      html: `<p>${inviter} invited you to join the Optimus workspace.</p><p><a href="${safeUrl}">Accept the invitation</a></p><p>This link expires in seven days and can be used once.</p>`,
      text: `${inviterName || "A teammate"} invited you to join the Optimus workspace.\n\nAccept the invitation: ${inviteUrl}\n\nThis link expires in seven days and can be used once.`,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Invitation email provider returned ${response.status}.`);
  }

  return { delivered: true };
}
