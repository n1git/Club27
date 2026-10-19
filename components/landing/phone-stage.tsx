import { Activity, CalendarDays, Dumbbell, Footprints, Heart, House, Lock, MessageCircle, Share2, UserPlus, Users, Waves } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "Beranda" | "Latihan" | "Teman" | "Grup";

const TABS: { label: Tab; icon: typeof House }[] = [
  { label: "Beranda", icon: House },
  { label: "Latihan", icon: Activity },
  { label: "Teman", icon: UserPlus },
  { label: "Grup", icon: Users },
];

const AVATAR = {
  ink: "bg-(--ph-ink) text-(--ph-volt)",
  frame: "bg-(--ph-frame) text-(--ph-ink)",
  volt: "bg-(--ph-volt) text-(--ph-ink)",
  line: "bg-(--ph-paper) text-(--ph-ink) shadow-[inset_0_0_0_1.5px_var(--ph-ink)]",
} as const;

function Avatar({ tone, children, small }: { tone: keyof typeof AVATAR; children: string; small?: boolean }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full font-bold", small ? "size-6 text-[9px]" : "size-[30px] text-[11px]", AVATAR[tone])}>
      {children}
    </span>
  );
}

function Phone({ title, active, className, children }: { title: string; active: Tab; className: string; children: React.ReactNode }) {
  return (
    <div className={cn("absolute left-1/2 -ml-[132px] [transform-origin:50%_0] [transform:translateX(var(--x))_rotate(var(--r))_scale(var(--s))]", className)}>
      <div
        aria-hidden="true"
        className="phone-screen relative flex h-[560px] w-[264px] flex-col overflow-hidden rounded-[40px] border-8 border-[#0e0e0e] bg-(--ph-cream) text-[12.5px] leading-[1.4] shadow-[0_30px_50px_-18px_rgb(14_14_14/0.45)] motion-safe:animate-[float_7s_ease-in-out_infinite]"
        style={{ animationDelay: "var(--d, 0s)" }}
      >
        <span className="absolute left-1/2 top-2 z-10 h-4 w-[62px] -translate-x-1/2 rounded-full bg-[#0e0e0e]" />
        <div className="flex items-center justify-between px-3.5 pb-2 pt-[34px]">
          <h4 className="text-[17px] font-bold">{title}</h4>
          <Avatar tone="volt">RA</Avatar>
        </div>
        <div className="flex flex-1 flex-col gap-[9px] overflow-hidden px-3 pt-1">{children}</div>
        <div className="flex justify-around border-t border-(--ph-line) bg-(--ph-card) px-1.5 pb-3 pt-2 text-[10px] font-semibold text-(--ph-muted)">
          {TABS.map(({ label, icon: Icon }) => (
            <span key={label} className={cn("flex flex-col items-center gap-0.5", label === active && "text-(--ph-ink)")}>
              <Icon className="size-[18px]" strokeWidth={label === active ? 2.4 : 1.75} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Post({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 rounded-[20px] bg-(--ph-paper) p-[11px] shadow-[0_1px_0_var(--ph-line)]">{children}</div>;
}

function Who({ tone, initials, name, meta }: { tone: keyof typeof AVATAR; initials: string; name: string; meta: string }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar tone={tone}>{initials}</Avatar>
      <span>
        <b className="block text-[12.5px] leading-tight">{name}</b>
        <small className="text-[11px] text-(--ph-muted)">{meta}</small>
      </span>
    </div>
  );
}

function Chip({ icon: Icon, children }: { icon: typeof Waves; children: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-[14px] bg-(--ph-tint) px-[9px] py-1.5 text-xs font-bold">
      <Icon className="size-[15px]" strokeWidth={1.75} />
      {children}
    </div>
  );
}

function Event({ title, when, seats, highlight, joined }: { title: string; when: string; seats: string; highlight?: boolean; joined?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-[7px] rounded-[20px] p-[11px]", highlight ? "bg-(--ph-tint)" : "bg-(--ph-paper)")}>
      <b className="text-[13.5px] leading-tight">{title}</b>
      <small className="flex items-center gap-[5px] text-[11.5px] text-(--ph-muted)">
        <CalendarDays className="size-[13px]" strokeWidth={1.75} />
        {when}
      </small>
      <div className="flex items-center justify-between gap-1.5 text-[11.5px] font-bold">
        <span>{seats}</span>
        <span className={cn("inline-flex rounded-full", joined ? "bg-(--ph-ink) px-3.5 py-1.5 text-(--ph-cream)" : "px-3 py-[5px] shadow-[inset_0_0_0_1.5px_var(--ph-ink)]")}>Ikut</span>
      </div>
    </div>
  );
}

function WorkoutLog({ sport, when, amount }: { sport: string; when: string; amount: string }) {
  return (
    <div className="flex items-center justify-between rounded-[14px] bg-(--ph-paper) px-2.5 py-2 font-semibold">
      <span>
        {sport}
        <small className="block text-[11px] font-normal text-(--ph-muted)">{when}</small>
      </span>
      <em className="text-[11px] font-bold not-italic text-(--ph-deep)">{amount}</em>
    </div>
  );
}

const WEEKS = [
  { n: 2, h: 40 },
  { n: 4, h: 100 },
  { n: 3, h: 55 },
  { n: 3, h: 80 },
];

export function PhoneStage() {
  return (
    <div>
      <div
        role="img"
        aria-label="Tiga layar aplikasi: beranda dengan feed teman, catatan latihan dengan target minggu, dan grup dengan event"
        className="relative isolate h-[520px] overflow-hidden rounded-[32px] bg-primary sm:h-[600px] lg:h-[664px] lg:rounded-[40px] before:absolute before:inset-x-0 before:top-[30%] before:h-3.5 before:bg-black/10 after:absolute after:inset-x-0 after:top-[66%] after:h-3.5 after:bg-black/10"
      >
        <Phone title="Grup" active="Grup" className="top-[30px] [--r:-6deg] [--s:0.78] [--x:-128px] [--d:-4.6s] z-[1] sm:top-24 sm:[--s:0.95] sm:[--x:-176px]">
          <div className="flex flex-col gap-2 rounded-[20px] bg-(--ph-paper) p-[11px]">
            <div className="flex items-center gap-2 font-bold">
              <Lock className="size-5" strokeWidth={1.75} />
              Lari Subuh
            </div>
            <div className="flex">
              <span className="-ml-0 [&>span]:border-2 [&>span]:border-(--ph-paper)">
                <Avatar tone="ink" small>DP</Avatar>
              </span>
              <span className="-ml-1.5 [&>span]:border-2 [&>span]:border-(--ph-paper)">
                <Avatar tone="frame" small>AL</Avatar>
              </span>
              <span className="-ml-1.5 [&>span]:border-2 [&>span]:border-(--ph-paper)">
                <Avatar tone="volt" small>NP</Avatar>
              </span>
              <span className="-ml-1.5 [&>span]:border-2 [&>span]:border-(--ph-paper)">
                <Avatar tone="line" small>BS</Avatar>
              </span>
              <span className="-ml-1.5 [&>span]:border-2 [&>span]:border-(--ph-paper)">
                <Avatar tone="frame" small>+5</Avatar>
              </span>
            </div>
          </div>
          <Event highlight joined title="Long run 10 km" when="Min, 25 Okt, 05.30 WIB" seats="14 dari 20 kursi" />
          <Event title="Renang santai" when="Sab, 31 Okt, 07.00 WIB" seats="8 dari 12 kursi" />
          <Event title="Sparring badminton" when="Rab, 4 Nov, 19.00 WIB" seats="6 dari 8 kursi" />
        </Phone>

        <Phone title="Latihan" active="Latihan" className="top-[66px] [--r:6deg] [--s:0.78] [--x:128px] [--d:-2.3s] z-[2] sm:top-[92px] sm:[--s:0.95] sm:[--x:176px]">
          <div className="rounded-[20px] bg-[#0e0e0e] p-[13px] text-[#f2f2ee]">
            <small className="text-[11px] font-semibold text-[#a6a69e]">Sesi minggu ini</small>
            <div className="my-0.5 mb-2 font-display text-[44px] leading-none text-(--ph-volt)">
              3<span className="text-2xl text-[#a6a69e]"> / 4</span>
            </div>
            <div className="flex gap-[5px]">
              {[true, true, true, false].map((on, i) => (
                <i key={i} className={cn("h-[7px] flex-1 rounded-full", on ? "bg-(--ph-volt)" : "bg-[#3a3a35]")} />
              ))}
            </div>
          </div>
          <div className="rounded-[20px] bg-(--ph-paper) px-3 py-[11px]">
            <h5 className="text-[11px] font-semibold text-(--ph-muted)">4 minggu terakhir</h5>
            <div className="mt-1.5 flex h-[70px] items-end gap-2.5">
              {WEEKS.map((w, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-[3px] text-[10px] font-semibold text-(--ph-muted)">
                  <i className={cn("block w-full rounded-t-lg rounded-b", i === WEEKS.length - 1 ? "bg-(--ph-volt)" : "bg-(--ph-frame)")} style={{ height: `${w.h}%` }} />
                  {w.n}
                </div>
              ))}
            </div>
          </div>
          <WorkoutLog sport="Renang" when="Kemarin, 45 menit" amount="1,8 km" />
          <WorkoutLog sport="Lari" when="Kamis, 28 menit" amount="5 km" />
          <div className="mb-2 mt-0.5 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-(--ph-volt) px-4 py-2 text-[12.5px] font-bold">
              <Share2 className="size-[15px]" strokeWidth={1.75} />
              Bagikan latihan
            </span>
          </div>
        </Phone>

        <Phone title="Beranda" active="Beranda" className="top-[30px] [--r:0deg] [--s:0.84] [--x:0px] z-[3] sm:top-[46px] sm:[--s:1]">
          <Post>
            <Who tone="ink" initials="DP" name="Dimas Prakoso" meta="@dimasp, 06.12" />
            <Chip icon={Waves}>Renang, 45 menit, 1,8 km</Chip>
            <div>Set terakhir lumayan berat, tapi selesai.</div>
            <div className="flex gap-3.5 text-[11.5px] font-semibold text-(--ph-muted)">
              <span className="flex items-center gap-1 text-(--ph-ink)">
                <Heart className="size-[15px] fill-current" strokeWidth={1.75} />
                12
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="size-[15px]" strokeWidth={1.75} />3
              </span>
              <span className="flex items-center gap-1">
                <Share2 className="size-[15px]" strokeWidth={1.75} />
                Bagikan
              </span>
            </div>
            <div className="text-[11.5px] text-(--ph-muted)">
              <b className="text-(--ph-ink)">Ayu Lestari</b> Mantap, besok bareng?
            </div>
          </Post>
          <Post>
            <Who tone="frame" initials="NP" name="Nadia Putri" meta="@nadiap, 05.40" />
            <Chip icon={Footprints}>Lari, 28 menit, 5 km</Chip>
            <div className="flex gap-3.5 text-[11.5px] font-semibold text-(--ph-muted)">
              <span className="flex items-center gap-1">
                <Heart className="size-[15px]" strokeWidth={1.75} />7
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="size-[15px]" strokeWidth={1.75} />1
              </span>
            </div>
          </Post>
          <Post>
            <Who tone="volt" initials="AL" name="Ayu Lestari" meta="@ayul, kemarin" />
            <Chip icon={Dumbbell}>Gym, 60 menit</Chip>
          </Post>
        </Phone>
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <b className="rounded-full bg-secondary px-2.5 py-0.5 text-[13px] font-bold text-foreground">Contoh data</b>
        Nama dan angka di layar ini hanya ilustrasi.
      </p>
    </div>
  );
}
