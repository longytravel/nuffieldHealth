import type { ExtractedFact } from "@/lib/types";

// A source's extracted facts with its database ID and URL
export interface ResearchSource {
  source_id: string;
  result_url: string;
  extracted_facts: ExtractedFact[] | null;
}

// A fact plus the source IDs and URLs that corroborate it
export interface FactWithSources {
  element: string;
  fact: string;
  confidence: "high" | "medium" | "low";
  source_ids: string[];
  source_urls: string[];
}

export interface CorroborationResult {
  corroboratedFacts: FactWithSources[];
  singleSourceFacts: FactWithSources[];
}

/**
 * Normalise a fact string for fuzzy matching.
 * Lower-cases, collapses whitespace, and strips trailing punctuation.
 */
function normaliseFact(fact: string): string {
  return fact
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Simple token-overlap similarity. Returns true if the two facts
 * share enough key tokens to be considered the same claim.
 * Uses a Jaccard-like threshold of 0.4 on meaningful words.
 */
function areSimilarFacts(a: string, b: string): boolean {
  const STOP_WORDS = new Set([
    "a", "an", "the", "is", "are", "was", "were", "has", "have", "had",
    "in", "of", "on", "at", "to", "for", "with", "and", "or", "but",
    "he", "she", "they", "their", "his", "her",
  ]);

  function tokens(s: string): Set<string> {
    return new Set(
      normaliseFact(s)
        .split(" ")
        .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
    );
  }

  const ta = tokens(a);
  const tb = tokens(b);

  if (ta.size === 0 || tb.size === 0) return false;

  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap++;
  }

  const union = ta.size + tb.size - overlap;
  const jaccard = overlap / union;

  return jaccard >= 0.4;
}

/**
 * Cross-reference extracted facts across multiple research sources.
 * A fact is corroborated if found in 2+ independent source URLs.
 *
 * Per spec §4.1 Stage 4.
 */
export function corroborateFacts(sources: ResearchSource[]): CorroborationResult {
  // Collect all (fact, sourceId, sourceUrl) tuples per element
  interface FlatFact {
    element: string;
    fact: string;
    confidence: "high" | "medium" | "low";
    source_id: string;
    source_url: string;
  }

  const flat: FlatFact[] = [];

  for (const source of sources) {
    if (!source.extracted_facts) continue;
    for (const f of source.extracted_facts) {
      flat.push({
        element: f.element,
        fact: f.fact,
        confidence: f.confidence as "high" | "medium" | "low",
        source_id: source.source_id,
        source_url: source.result_url,
      });
    }
  }

  // Group by element
  const byElement = new Map<string, FlatFact[]>();
  for (const f of flat) {
    const arr = byElement.get(f.element) ?? [];
    arr.push(f);
    byElement.set(f.element, arr);
  }

  const corroboratedFacts: FactWithSources[] = [];
  const singleSourceFacts: FactWithSources[] = [];

  for (const [element, facts] of byElement) {
    // Cluster facts that are similar across different source URLs
    const visited = new Set<number>();

    for (let i = 0; i < facts.length; i++) {
      if (visited.has(i)) continue;
      visited.add(i);

      const cluster: FlatFact[] = [facts[i]];

      for (let j = i + 1; j < facts.length; j++) {
        if (visited.has(j)) continue;
        // Must be a different source URL to count as independent
        if (
          facts[j].source_url !== facts[i].source_url &&
          areSimilarFacts(facts[i].fact, facts[j].fact)
        ) {
          visited.add(j);
          cluster.push(facts[j]);
        }
      }

      // Pick best confidence level from cluster
      const confidencePriority = { high: 0, medium: 1, low: 2 };
      cluster.sort(
        (a, b) => confidencePriority[a.confidence] - confidencePriority[b.confidence]
      );
      const best = cluster[0];

      // Deduplicate source IDs and URLs
      const source_ids = [...new Set(cluster.map((c) => c.source_id))];
      const source_urls = [...new Set(cluster.map((c) => c.source_url))];

      const entry: FactWithSources = {
        element,
        fact: best.fact,
        confidence: best.confidence,
        source_ids,
        source_urls,
      };

      // Corroborated = 2+ independent source URLs
      if (source_urls.length >= 2) {
        corroboratedFacts.push(entry);
      } else {
        singleSourceFacts.push(entry);
      }
    }
  }

  return { corroboratedFacts, singleSourceFacts };
}
