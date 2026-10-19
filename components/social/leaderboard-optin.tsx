import { setLeaderboardOptin } from "@/lib/actions/leaderboards";
import { ActionButton } from "@/components/shared/action-button";
import type { BoardClub } from "@/lib/data/leaderboards";

export function LeaderboardOptin({ club }: { club: BoardClub }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4 text-sm">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-semibold">{club.clubName}</span>
        <span className="text-muted-foreground">
          {club.optedIn
            ? "Nama dan total latihan Anda tampil di peringkat klub untuk anggota dan admin klub ini."
            : "Anda tidak tampil di peringkat klub. Hanya total (jarak, durasi, sesi) yang akan tampil, bukan catatan latihan."}
        </span>
      </div>
      <ActionButton
        action={setLeaderboardOptin}
        fields={{ clubId: club.clubId, on: club.optedIn ? "0" : "1" }}
        label={club.optedIn ? "Berhenti tampil" : "Tampilkan total saya"}
        variant={club.optedIn ? "outline" : "default"}
      />
    </div>
  );
}
