"use client";

import { useState } from "react";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import type { ActionState } from "@/lib/actions/types";

function Form({
  action,
  username,
  publicProfile,
  publicSearchOk,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  username: string;
  publicProfile: boolean;
  publicSearchOk: boolean;
}) {
  const [enabled, setEnabled] = useState(publicProfile);
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="publicProfile"
          defaultChecked={publicProfile}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-accent-foreground"
        />
        <span className="text-sm">
          <b className="block">Profil publik</b>
          Orang yang belum masuk bisa membuka <span className="font-mono">/{username}</span> dan melihat nama dan @username Anda. Email, telepon, alamat, klub, dan latihan tidak pernah ditampilkan.
        </span>
      </label>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="publicSearchOk"
          defaultChecked={publicSearchOk}
          disabled={!enabled}
          className="mt-0.5 size-5 shrink-0 accent-accent-foreground"
        />
        <span className="text-sm">
          <b className="block">Boleh dicari Google</b>
          Mesin pencari boleh mengindeks halaman publik Anda. Tanpa ini halaman tidak diindeks.
        </span>
      </label>
      <div>
        <ActionSubmitButton>Simpan</ActionSubmitButton>
      </div>
    </ActionForm>
  );
}

export function PublicProfileForm(props: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  username: string;
  publicProfile: boolean;
  publicSearchOk: boolean;
}) {
  return <Form key={`${props.publicProfile}:${props.publicSearchOk}`} {...props} />;
}
