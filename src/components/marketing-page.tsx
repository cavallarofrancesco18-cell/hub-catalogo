import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

import { AdBanner } from '@/components/ad-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type MarketingPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  primaryCta?: {
    href: string;
    label: string;
  };
  secondaryCta?: {
    href: string;
    label: string;
  };
  children: ReactNode;
};

export function MarketingPage({
  eyebrow,
  title,
  description,
  highlights,
  primaryCta,
  secondaryCta,
  children,
}: MarketingPageProps) {
  return (
    <div className="bg-[linear-gradient(180deg,rgba(241,245,249,0.95)_0%,rgba(255,255,255,1)_24%,rgba(248,250,252,0.9)_100%)]">
      <section className="relative overflow-hidden border-b border-border/60 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.18),transparent_30%),linear-gradient(135deg,#0f172a_0%,#111827_56%,#1e3a8a_100%)] text-white">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(-55deg,rgba(255,255,255,0.04)_0px,rgba(255,255,255,0.04)_9px,transparent_9px,transparent_22px)] opacity-40" />
        <div className="container relative px-4 py-20 sm:px-6 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.85fr)] lg:items-end">
            <div className="max-w-3xl space-y-6">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-200">{eyebrow}</p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">{title}</h1>
              <p className="max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">{description}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {highlights.map(item => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
                    <span className="text-sm leading-6 text-slate-100">{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                {primaryCta ? (
                  <Button asChild size="lg" className="rounded-full bg-white px-6 text-slate-950 hover:bg-slate-100">
                    <Link href={primaryCta.href}>
                      {primaryCta.label}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
                {secondaryCta ? (
                  <Button asChild size="lg" variant="outline" className="rounded-full border-white/30 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white">
                    <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
                  </Button>
                ) : null}
              </div>
            </div>
            <Card className="border-white/10 bg-white/10 text-white shadow-[0_20px_70px_-30px_rgba(15,23,42,0.7)] backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-xl">AutoTrade HUB</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-slate-100/88">
                <p>Un hub digitale pensato per trasformare la ricerca di un veicolo usato in un percorso chiaro, tracciabile e professionale.</p>
                <p>Ogni pagina pubblica e ogni informazione legale sono state strutturate per rafforzare trasparenza, affidabilità editoriale e qualità complessiva del dominio.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="container px-4 py-8 sm:px-6">
        <AdBanner slotLabel="Leaderboard informativa / Google AdSense" className="min-h-[140px]" />
      </section>

      <section className="container px-4 pb-16 sm:px-6 lg:pb-24">{children}</section>
    </div>
  );
}

type InfoGridProps = {
  items: Array<{
    title: string;
    description: string;
  }>;
  columns?: 2 | 3;
};

export function InfoGrid({ items, columns = 3 }: InfoGridProps) {
  return (
    <div className={cn('grid gap-5', columns === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3')}>
      {items.map(item => (
        <Card key={item.title} className="h-full rounded-3xl border-border/60 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.3)]">
          <CardHeader>
            <CardTitle className="text-xl text-foreground">{item.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-7 text-muted-foreground">{item.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type SectionBlockProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function SectionBlock({ title, description, children }: SectionBlockProps) {
  return (
    <section className="space-y-6 py-8 lg:py-10">
      <div className="max-w-3xl space-y-3">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h2>
        {description ? <p className="text-base leading-8 text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
