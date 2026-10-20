import { CONSENT_LABEL } from "@/lib/consent";
import { ConsentDetails } from "@/components/shared/consent-details";

const link = "font-medium text-accent-foreground underline-offset-4 hover:underline";

export function ConsentCheckbox() {
  const [lead, rest] = CONSENT_LABEL.split("Syarat & Ketentuan");
  const [between, tail] = rest.split("Kebijakan Privasi");
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="acceptTerms" required className="mt-0.5 size-5 shrink-0 accent-accent-foreground" />
        <span>
          {lead}
          <a href="/terms" target="_blank" className={link}>
            Syarat & Ketentuan
          </a>
          {between}
          <a href="/privacy" target="_blank" className={link}>
            Kebijakan Privasi
          </a>
          {tail}.
        </span>
      </label>
      <details className="ml-8 text-sm">
        <summary className="cursor-pointer font-medium text-accent-foreground">Lihat rincian persetujuan</summary>
        <div className="mt-2">
          <ConsentDetails />
        </div>
      </details>
    </div>
  );
}
