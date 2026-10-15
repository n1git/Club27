
const STEPS = [
  {
    title: "Daftarkan organisasi",
    body: "Isi nama klub, akun pemilik, paket, dan periode. Organisasi, akun pemilik, dan klub pertama dibuat sekaligus.",
  },
  {
    title: "Pilih jenis klub dan modul",
    body: "Jenis klub menentukan istilah dan modul awal. Modul yang tidak dipakai bisa dimatikan kapan saja dari Pengaturan.",
  },
  {
    title: "Siapkan lokasi, fasilitas, dan paket",
    body: "Penyiapan klub memandu lokasi, fasilitas dengan saran sesuai jenis klub, dan paket keanggotaan pertama. Setiap langkah boleh dilewati.",
  },
  {
    title: "Tim dan anggota mulai memakai",
    body: "Tambahkan staf dengan perannya, daftarkan anggota, lalu aktifkan akun portal bagi anggota yang ingin melihat datanya sendiri.",
  },
];

export function HowItWorks() {
  return (
    <section id="cara-kerja" aria-labelledby="cara-kerja-judul" className="scroll-mt-20 bg-muted/50 py-16 sm:py-24">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-sm font-semibold text-accent-foreground">Cara kerja</p>
          <h2 id="cara-kerja-judul" className="mt-2 text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Dari pendaftaran sampai klub berjalan.
          </h2>
        </div>
        <ol className="relative flex flex-col gap-10 before:absolute before:bottom-2 before:left-[1.1875rem] before:top-2 before:w-px before:bg-border">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative grid grid-cols-[2.5rem_1fr] gap-5">
              <span aria-hidden className="relative z-10 flex size-10 items-center justify-center rounded-full bg-primary font-heading text-sm font-semibold text-primary-foreground ring-8 ring-muted/50">
                {index + 1}
              </span>
              <div className="pt-1.5">
                <h3 className="font-heading text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-xl text-pretty text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
