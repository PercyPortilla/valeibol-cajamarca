const E164 = /^[+][1-9][0-9]{7,14}$/;

export function buildWhatsAppChatHref(recipientE164: string, message?: string) {
  const normalized = recipientE164.trim();
  if (!E164.test(normalized)) return null;
  const phone = normalized.slice(1);
  const text = message?.trim();
  return text
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${phone}`;
}
