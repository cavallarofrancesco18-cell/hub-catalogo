import { localBusinessSchema, organizationSchema } from '@/lib/site';

type StructuredDataProps = {
  includeLocalBusiness?: boolean;
};

export function StructuredData({ includeLocalBusiness = true }: StructuredDataProps) {
  const graph = includeLocalBusiness ? [organizationSchema, localBusinessSchema] : [organizationSchema];

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': graph,
        }),
      }}
    />
  );
}

export default StructuredData;