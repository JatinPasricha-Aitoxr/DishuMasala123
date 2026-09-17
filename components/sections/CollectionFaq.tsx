import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Accordion";
import { COLLECTION_FAQS, buildSharedCommerceFaqs, type FaqItem } from "@/content/faq";
import { getFreeShippingThresholdPaise } from "@/lib/db/queries/settings";
import { formatINR } from "@/lib/money";

export interface CollectionFaqProps {
  collectionSlug: string;
  collectionTitle: string;
}

/** Collection FAQ — real Q&A (grounded in content/faq.ts, "invent nothing" per CLAUDE.md §8) plus
 * FAQPage JSON-LD (CLAUDE.md §10 lists FAQPage among the required structured-data types). Shipping
 * questions read the live free-shipping threshold from `settings` rather than a hardcoded ₹500. */
export async function CollectionFaq({ collectionSlug, collectionTitle }: CollectionFaqProps) {
  const collectionFaqs = COLLECTION_FAQS[collectionSlug];
  if (!collectionFaqs) return null;

  const freeShippingThresholdPaise = await getFreeShippingThresholdPaise();
  const faqs: FaqItem[] = [...collectionFaqs, ...buildSharedCommerceFaqs(formatINR(freeShippingThresholdPaise))];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <section aria-labelledby="collection-faq-heading" className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-14 lg:py-16">
      <h2 id="collection-faq-heading" className="font-display text-2xl font-semibold text-ink sm:text-3xl">
        Frequently asked questions
      </h2>
      <p className="mt-2 text-sm text-ink-2">Everything you need to know about {collectionTitle}.</p>
      <Accordion type="single" collapsible className="mt-6">
        {faqs.map((faq) => (
          <AccordionItem key={faq.question} value={faq.question}>
            <AccordionTrigger>{faq.question}</AccordionTrigger>
            <AccordionContent>{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}
