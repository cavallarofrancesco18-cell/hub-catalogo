import Script from 'next/script';

type AdBannerProps = {
  slotId: string;
  className?: string;
  enabled?: boolean;
};

export function AdBanner({ slotId, className, enabled = false }: AdBannerProps) {
  if (!enabled) {
    return null;
  }

  return (
    <div className={className}>
      <Script
        id={`adsense-${slotId}`}
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            // Inserire qui lo script Google AdSense globale quando l'account sara approvato.
            // Esempio: (adsbygoogle = window.adsbygoogle || []).push({});
          `,
        }}
      />
      <ins
        className="adsbygoogle block min-h-[120px] rounded-3xl border border-dashed border-slate-300/70 bg-slate-50"
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

export default AdBanner;