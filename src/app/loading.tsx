import { BrandedLoader } from '@/components/branded-loader';

export default function Loading() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_38%),radial-gradient(circle_at_bottom_right,_hsl(var(--primary)/0.08),_transparent_26%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--background)))]" />
      <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/6 blur-3xl" />
      <div className="relative z-10 w-full max-w-md">
        <BrandedLoader className="max-w-full" label="Sto caricando la pagina..." imageClassName="h-14 max-w-[180px]" />
      </div>
    </div>
  );
}