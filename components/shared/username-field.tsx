"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suggestUsername } from "@/lib/validations/username";
import { useActionFormState } from "./action-form";

export function UsernameField({
  emailName,
  error: errorProp,
  defaultValue = "",
}: {
  emailName?: string;
  error?: string;
  defaultValue?: string;
}) {
  const formState = useActionFormState();
  const error = errorProp ?? formState.fieldErrors?.username;
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const touched = useRef(false);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (!emailName) return;
    const email = ref.current?.form?.elements.namedItem(emailName);
    if (!(email instanceof HTMLInputElement)) return;
    const sync = () => {
      if (!touched.current) setValue(email.value.includes("@") ? suggestUsername(email.value) : "");
    };
    email.addEventListener("input", sync);
    return () => email.removeEventListener("input", sync);
  }, [emailName]);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Username</Label>
      <Input
        ref={ref}
        id={id}
        name="username"
        required
        minLength={3}
        maxLength={30}
        pattern="[a-z][a-z0-9._]{2,29}"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => {
          touched.current = true;
          setValue(event.target.value.toLowerCase());
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        {error ?? "3–30 karakter: huruf kecil, angka, titik atau garis bawah, diawali huruf."}
      </p>
    </div>
  );
}
