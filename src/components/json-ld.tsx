import type { JsonLdObject } from '@/lib/jsonld';
import { serializeJsonLd } from '@/lib/jsonld';

export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
