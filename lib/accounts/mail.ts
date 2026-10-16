import { APP_NAME } from "@/lib/config";

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function invitationEmail(input: { link: string; name: string; inviter: string; where: string; days: number }) {
  return {
    subject: `Undangan bergabung di ${input.where} (${APP_NAME})`,
    text: `Halo ${input.name},\n\n${input.inviter} mengundang Anda bergabung di ${input.where} lewat ${APP_NAME}. Buka tautan ini dalam ${input.days} hari untuk menerima undangan:\n${input.link}\n\nAbaikan email ini jika Anda tidak mengenalnya.`,
    html: `<p>Halo ${escapeHtml(input.name)},</p><p>${escapeHtml(input.inviter)} mengundang Anda bergabung di ${escapeHtml(input.where)} lewat ${APP_NAME}. Buka tautan ini dalam ${input.days} hari untuk menerima undangan:</p><p><a href="${input.link}">${input.link}</a></p><p>Abaikan email ini jika Anda tidak mengenalnya.</p>`,
  };
}

export function passwordResetEmail(input: { link: string; name: string }) {
  return {
    subject: `Atur ulang kata sandi ${APP_NAME}`,
    text: `Halo ${input.name},\n\nBuka tautan ini dalam 1 jam untuk membuat kata sandi baru:\n${input.link}\n\nAbaikan email ini jika Anda tidak memintanya; kata sandi Anda tidak berubah.`,
    html: `<p>Halo ${escapeHtml(input.name)},</p><p>Buka tautan ini dalam 1 jam untuk membuat kata sandi baru:</p><p><a href="${input.link}">${input.link}</a></p><p>Abaikan email ini jika Anda tidak memintanya; kata sandi Anda tidak berubah.</p>`,
  };
}
