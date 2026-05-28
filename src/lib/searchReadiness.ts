// Search Readiness checks — Google AI / AI Overview eligibility signals
// Separate from agent score (CheckResult.id namespace: "sr.*")

export interface SearchReadinessCheck {
  id: string;           // "sr.1", "sr.2", etc. — never collides with agent checks
  name: string;
  category: SearchReadinessCategory;
  priority: 'critical' | 'high' | 'medium' | 'low';
  autoDetectable: boolean;
  description: string;
  why: string;          // why Google AI cares about this signal
  recommendation: string;
}

export interface SearchReadinessResult extends SearchReadinessCheck {
  passed: boolean;
  status: 'pass' | 'fail' | 'partial' | 'unknown';
  message: string;
  details?: string;
  foundAt?: string;
}

export interface SearchReadinessSummary {
  url: string;
  timestamp: string;
  score: number;
  maxScore: number;
  tier: SearchReadinessTier;
  checks: SearchReadinessResult[];
}

export type SearchReadinessCategory =
  | 'Structured Data'
  | 'Content Quality'
  | 'Crawlability'
  | 'Authority Signals'
  | 'Technical Signals';

export interface SearchReadinessTier {
  name: 'Not Indexed' | 'Basic' | 'Eligible' | 'Preferred' | 'Optimized';
  description: string;
  range: string;
}

export function getSearchReadinessTier(score: number, maxScore: number): SearchReadinessTier {
  const pct = (score / maxScore) * 100;
  if (pct <= 20) return { name: 'Not Indexed', description: "Missing core signals — AI overviews cannot reliably cite this page.", range: '0-20%' };
  if (pct <= 40) return { name: 'Basic', description: "Crawlable but thin on structured signals. Rarely cited in AI overviews.", range: '21-40%' };
  if (pct <= 62) return { name: 'Eligible', description: "Has the basics. May appear in AI overviews for low-competition queries.", range: '41-62%' };
  if (pct <= 80) return { name: 'Preferred', description: "Strong signals across the board. Competitive for AI overview citations.", range: '63-80%' };
  return { name: 'Optimized', description: "Maximally citable. Structured, authoritative, and technically clean.", range: '81-100%' };
}

export function calculateSearchReadinessScore(checks: SearchReadinessResult[]): number {
  // Critical checks are worth 2 points; others 1
  return checks.reduce((sum, c) => {
    if (!c.passed) return sum;
    return sum + (c.priority === 'critical' ? 2 : 1);
  }, 0);
}

export function getSearchReadinessMaxScore(checks: SearchReadinessCheck[]): number {
  return checks.reduce((sum, c) => sum + (c.priority === 'critical' ? 2 : 1), 0);
}

// All search readiness check definitions
export const SEARCH_READINESS_CHECKS: SearchReadinessCheck[] = [

  // ── Structured Data ──────────────────────────────────────────────────────
  {
    id: 'sr.1',
    name: 'Schema.org Markup',
    category: 'Structured Data',
    priority: 'critical',
    autoDetectable: true,
    description: 'Page contains valid schema.org JSON-LD or microdata markup.',
    why: 'Google AI uses structured data to understand page type, author, date, and entity context before deciding whether to cite a page.',
    recommendation: 'Add JSON-LD markup. For articles: Article + Author + datePublished. For products: Product + Offer + Review.',
  },
  {
    id: 'sr.2',
    name: 'FAQ Schema',
    category: 'Structured Data',
    priority: 'high',
    autoDetectable: true,
    description: 'Page uses FAQPage or QAPage schema markup.',
    why: 'FAQ schema directly maps to the question-answer format that AI overviews draw from.',
    recommendation: 'Wrap Q&A sections in FAQPage JSON-LD with acceptedAnswer for each question.',
  },
  {
    id: 'sr.3',
    name: 'Article / BlogPosting Schema',
    category: 'Structured Data',
    priority: 'high',
    autoDetectable: true,
    description: 'Content pages use Article, BlogPosting, or NewsArticle schema with datePublished and author.',
    why: 'Freshness and authorship are key AI overview eligibility signals. Schema makes them machine-readable.',
    recommendation: 'Add Article JSON-LD with datePublished, dateModified, and author.name on every content page.',
  },
  {
    id: 'sr.4',
    name: 'Breadcrumb Schema',
    category: 'Structured Data',
    priority: 'medium',
    autoDetectable: true,
    description: 'BreadcrumbList schema is present.',
    why: 'Breadcrumb schema helps Google understand site hierarchy and improves snippet display quality.',
    recommendation: 'Add BreadcrumbList JSON-LD mirroring your navigation path.',
  },

  // ── Content Quality ───────────────────────────────────────────────────────
  {
    id: 'sr.5',
    name: 'Meta Description',
    category: 'Content Quality',
    priority: 'critical',
    autoDetectable: true,
    description: 'Page has a non-empty meta description between 120-160 characters.',
    why: "The meta description is the first prose summary AI models see. Short or missing descriptions reduce citation likelihood.",
    recommendation: 'Write a 140-155 character meta description that summarizes the page in plain language — no keyword stuffing.',
  },
  {
    id: 'sr.6',
    name: 'Open Graph Title & Description',
    category: 'Content Quality',
    priority: 'medium',
    autoDetectable: true,
    description: 'og:title and og:description meta tags are present and non-empty.',
    why: 'AI systems increasingly use Open Graph data as a secondary summary source when meta tags are thin.',
    recommendation: 'Set og:title and og:description on every page. Keep og:description under 200 characters.',
  },
  {
    id: 'sr.7',
    name: 'Canonical URL',
    category: 'Content Quality',
    priority: 'critical',
    autoDetectable: true,
    description: 'A rel=canonical tag is present and points to the authoritative URL.',
    why: 'Duplicate content without canonicalization fragments authority and confuses AI indexers about which page to cite.',
    recommendation: 'Add <link rel="canonical" href="..."> on every page, including the homepage.',
  },
  {
    id: 'sr.8',
    name: 'Content Freshness Signal',
    category: 'Content Quality',
    priority: 'high',
    autoDetectable: true,
    description: 'Page contains a visible or machine-readable publish/update date.',
    why: "AI overviews strongly prefer current sources. Pages without dates are treated as potentially stale.",
    recommendation: 'Include a visible last-updated date and add dateModified to Article schema.',
  },

  // ── Crawlability ──────────────────────────────────────────────────────────
  {
    id: 'sr.9',
    name: 'XML Sitemap',
    category: 'Crawlability',
    priority: 'critical',
    autoDetectable: true,
    description: '/sitemap.xml exists and is accessible.',
    why: 'A sitemap is the primary signal that a site wants to be indexed. Without it, AI crawlers may miss pages.',
    recommendation: 'Generate a sitemap.xml and reference it in robots.txt with `Sitemap: https://yourdomain.com/sitemap.xml`.',
  },
  {
    id: 'sr.10',
    name: 'Robots.txt Google-Extended Policy',
    category: 'Crawlability',
    priority: 'high',
    autoDetectable: true,
    description: 'robots.txt does not block Google-Extended (the AI training crawler).',
    why: 'Blocking Google-Extended signals opt-out of AI training, which may also reduce AI overview eligibility for the content.',
    recommendation: 'Review robots.txt. If you want AI overview eligibility, ensure Google-Extended is allowed or not explicitly blocked.',
  },
  {
    id: 'sr.11',
    name: 'HTTPS',
    category: 'Crawlability',
    priority: 'critical',
    autoDetectable: true,
    description: 'Site is served over HTTPS with a valid certificate.',
    why: 'Google does not index HTTP-only content reliably, and AI overview sources are exclusively HTTPS.',
    recommendation: 'Migrate to HTTPS if not already. Ensure no mixed-content warnings.',
  },
  {
    id: 'sr.12',
    name: 'No Soft 404s on Key Pages',
    category: 'Crawlability',
    priority: 'medium',
    autoDetectable: false,
    description: 'Important pages return proper 200 status, not redirect chains or soft 404s.',
    why: 'Soft 404s confuse crawlers and reduce page authority for AI citation.',
    recommendation: 'Audit redirect chains. Ensure key pages return 200, not 302 → 200.',
  },

  // ── Authority Signals ─────────────────────────────────────────────────────
  {
    id: 'sr.13',
    name: 'Author Information',
    category: 'Authority Signals',
    priority: 'high',
    autoDetectable: true,
    description: 'Content pages identify a human author with name and (optionally) credentials.',
    why: "Google's EEAT (Experience, Expertise, Authoritativeness, Trustworthiness) framework heavily weights named authorship for AI overview eligibility.",
    recommendation: 'Add a visible byline and link to an author bio page. Include author.name in Article schema.',
  },
  {
    id: 'sr.14',
    name: 'About / Contact Pages',
    category: 'Authority Signals',
    priority: 'medium',
    autoDetectable: true,
    description: '/about and/or /contact pages exist.',
    why: 'Presence of About and Contact pages is a basic trust signal that AI systems use to evaluate source reliability.',
    recommendation: 'Ensure /about and /contact exist with substantive content (not placeholder text).',
  },
  {
    id: 'sr.15',
    name: 'Privacy Policy',
    category: 'Authority Signals',
    priority: 'medium',
    autoDetectable: true,
    description: 'A privacy policy page is linked and accessible.',
    why: 'Trust and safety signals are increasingly factored into AI content sourcing decisions.',
    recommendation: 'Link your privacy policy in the footer on every page.',
  },

  // ── Technical Signals ─────────────────────────────────────────────────────
  {
    id: 'sr.16',
    name: 'Semantic HTML Headings',
    category: 'Technical Signals',
    priority: 'high',
    autoDetectable: true,
    description: 'Page uses a logical H1 → H2 → H3 heading hierarchy.',
    why: 'AI models use heading structure to segment and extract answer candidates. Flat or inverted heading hierarchies produce poor extraction.',
    recommendation: 'Use exactly one H1 per page (the title). Use H2 for main sections, H3 for subsections.',
  },
  {
    id: 'sr.17',
    name: 'Page Speed (LCP < 2.5s proxy)',
    category: 'Technical Signals',
    priority: 'medium',
    autoDetectable: false,
    description: 'Page has strong Core Web Vitals signals (LCP, CLS, INP).',
    why: 'Page experience signals correlate with crawl priority. Slow pages are crawled less frequently and cited less.',
    recommendation: 'Use PageSpeed Insights to measure LCP, CLS, and INP. Target LCP < 2.5s.',
  },
  {
    id: 'sr.18',
    name: 'hreflang for Multi-Language Sites',
    category: 'Technical Signals',
    priority: 'low',
    autoDetectable: true,
    description: 'If multiple language versions exist, hreflang tags are set correctly.',
    why: 'Missing hreflang causes AI systems to serve incorrect language versions in AI overviews.',
    recommendation: 'Add hreflang link tags for each language/region variant of every page.',
  },
];

// Subset that can be auto-checked via URL scan (no manual review needed)
export const AUTO_DETECTABLE_SEARCH_CHECKS = SEARCH_READINESS_CHECKS.filter(c => c.autoDetectable);
