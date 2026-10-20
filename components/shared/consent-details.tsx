import { CONSENT_ITEMS } from "@/lib/consent";
import { LegalContact } from "@/components/landing/legal-contact";

export function ConsentDetails() {
  return (
    <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-muted-foreground [&_ul]:ml-5 [&_ul]:list-disc">
      {CONSENT_ITEMS.map((item) => (
        <li key={item.title}>
          <span className="font-medium text-foreground">{item.title}.</span> {item.body}
          {item.list ? (
            <ul className="mt-1 flex flex-col gap-0.5">
              {item.list.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {item === CONSENT_ITEMS[CONSENT_ITEMS.length - 1] ? (
            <div className="mt-1 [&_ul]:list-none [&_ul]:ml-0">
              <LegalContact />
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
