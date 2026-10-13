import { linesToSteps, stepsToLines } from "./poster-spec";
import type { Campaign, CampaignStep, EmailContent, IdeaCard, PosterContent } from "./idea-types";

export const DEFAULT_MEDS_MATRIX: string[][] = [
  ["Rosuvastatin 10mg Tablet", "₱ 18", "₱ 5"],
  ["Febuxostat 40mg Tablet", "₱ 16", "₱ 9"],
  ["Losartan 50mg Tablet", "₱ 11", "₱ 2"],
  ["Atorvastatin 10mg Tablet", "₱ 10", "₱ 3"],
  ["Amlodipine 5mg Tablet", "₱ 8", "₱ 1"],
  ["Mefenamic acid 500mg Tablet", "₱ 6", "₱ 2"],
  ["Essential Phospholipids 300mg Capsule", "₱ 44", "₱ 18"],
];

export const DEFAULT_TABLE_HEADERS = [
  "MEDICINES* (Value Brand)",
  "LEADING RETAILERS** (Average Price)",
  "BEST LIFE VIA FORWARDMG (Price After Subsidy)",
  "SAVINGS (%)",
  "STATUS",
];

export const FORWARDMG_STEPS: CampaignStep[] = [
  {
    title: "Access your account",
    details: "• Go to forwardmg.ph and click Register.\n• Create an account using your Best Life member details, then sign in.",
  },
  {
    title: "Enter your Maxicare Card Number",
    details: "• Under Membership Code, select OTHER, enter your 16-digit Maxicare Card Number, then click Apply.",
  },
  {
    title: "Upload prescription and check out",
    details:
      "• Upload a clear, uncropped photo of your valid prescription (issued within the last six months).\n• Select your preferred payment method.\n• Review and submit your order. (Note: Your checkout page will show the standard total. Don't worry—you won't pay this yet!)",
  },
];

export const FORWARDMG_PROMO_TIP = {
  header: "💡 How does free delivery work?",
  body: "Final Order Details and Total: Within 1 working day, we will verify your order and apply free delivery on orders worth ₱1,000 or more. We will send your final adjusted total along with a secure payment link directly via email.",
};

export const BRAND_CONNECTORS = ["In Partnership With", "Supported By", "Powered By", "N/A"];

export function tableMatrix(cols: number, rows: number, seed?: { headers: string[]; rows: string[][] }) {
  const headers = Array.from({ length: cols }, (_, c) => seed?.headers[c] ?? DEFAULT_TABLE_HEADERS[c] ?? `Column ${c + 1}`);
  const body = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => seed?.rows[r]?.[c] ?? DEFAULT_MEDS_MATRIX[r]?.[c] ?? "Add data here"),
  );
  return { headers, rows: body };
}

function defaultEmail(): EmailContent {
  const table = tableMatrix(3, 7);
  return {
    preheaderEnabled: true,
    preheaderText: "🚨 ENDS SEP 25: Get FREE DELIVERY on medicine orders ₱1,000+ and above in ForwardMG!",
    heroHeadline: "Save more on your daily medicines with your Best Life benefits!",
    announcement: "Exclusive Member Benefit • Free Delivery on Orders ₱1,000+",
    introBody:
      "Hi *|FNAME|*,\n\nManaging your daily maintenance prescriptions shouldn't be stressful or expensive.\n\nWith your Maxicare Best Life program, ordering your prescribed medicines takes just minutes on ForwardMG, delivered right to your door with exclusive member discounts:",
    tableEnabled: false,
    tableIntro: "See the price difference below for our most ordered medicines and compare how much you can save:",
    tableHeaders: table.headers,
    tableRows: table.rows,
    disclaimerEnabled: true,
    disclaimerText:
      "*All orders containing prescription medicines are subject to verification and approval by a licensed pharmacist before dispensing.\n*Based on a market survey of average prices across leading retail drugstores as of August 2026. Best Life prices, subsidies, and stock availability are subject to change without prior notice.",
    cardsHeader: "It doesn't stop there! Your Best Life benefits also include:",
    cards: [
      { icon: "🏷️", title: "50% OFF", subtext: "220+ Value Brands" },
      { icon: "💊", title: "10% OFF", subtext: "80+ Branded Medicines" },
      { icon: "🌿", title: "Subsidized", subtext: "Vitamins and Supplements" },
    ],
    didYouKnowEnabled: false,
    didYouKnowTitle: "💡 Did you know?",
    didYouKnowBody: "Vitamins and non-prescription medicines do not require a prescription! You can order it directly on ForwardMG.",
    guideTitle: "How to order your medicines",
    steps: FORWARDMG_STEPS.map((s) => ({ ...s })),
    promoTipEnabled: true,
    promoTipHeader: FORWARDMG_PROMO_TIP.header,
    promoTipBody: FORWARDMG_PROMO_TIP.body,
    ctaMicrocopy: "Free delivery on orders ₱1,000+ • Dispatched directly to your door",
    secondaryCtaEnabled: false,
    secondaryTitle: "Need an updated doctor's prescription? Book a teleconsult with one of our doctors.",
    secondaryLabel: "Book a teleconsult with one of our doctors",
    secondaryUrl: "https://bestlife.medgrocer.com",
    terms:
      "• Valid exclusively for registered Maxicare Best Life program members.\n• 50% discount applies to selected value brands; 10% discount applies to branded maintenance medicines.\n• Free delivery valid for minimum order value of ₱1,000 on forwardmg.ph.",
    footerText:
      "You are receiving this because you are an enrolled Maxicare Best Life member. *|LIST:ADDRESS|* | *|UNSUB|* | Update Preferences",
  };
}

function posterFromEmail(headline: string, subheading: string, email: EmailContent, footer: string): PosterContent {
  return {
    headline,
    subheading,
    stepsTitle: email.guideTitle,
    stepsText: stepsToLines(
      email.steps.map((s) => ({
        label: s.title,
        detail: s.details
          .split("\n")
          .map((l) => l.replace(/^[•\-*]\s*/, "").trim())
          .filter(Boolean)
          .join(" ")
          .slice(0, 220),
      })),
    ),
    pointsText: email.cards.map((c) => `${c.title}: ${c.subtext}`).join("\n"),
    callout: email.promoTipEnabled ? `${email.promoTipHeader} ${email.promoTipBody}`.slice(0, 400) : "",
    showQr: true,
    footer,
    disclaimer: email.terms
      .split("\n")
      .map((l) => l.replace(/^[•\-*]\s*/, "").trim())
      .filter(Boolean)
      .join(" "),
    illustrationHint: "",
  };
}

/** A starting campaign pre-filled with the ForwardMG / Best Life template. */
export function blankCampaign(): Campaign {
  const email = defaultEmail();
  return {
    title: email.heroHeadline,
    cardType: "Promotional",
    cohort: "All Members",
    brandMode: "co2",
    brandConnector: "In Partnership With",
    brand1: "Maxicare Best Life",
    brand2: "MedGrocer",
    brand3: "Department of Health",
    ctaLabel: "Order Your Medicines on ForwardMG",
    ctaUrl: "https://forwardmg.ph",
    supportLine: "Questions? Reach out to our team at mg-bestlife@maxicare.com.ph",
    email,
    poster: posterFromEmail(email.heroHeadline, "", email, "Questions? Reach out to our team at mg-bestlife@maxicare.com.ph"),
  };
}

/** Builds the campaign from an idea card, applying the same defaults IDEAte's Content Studio used. */
export function campaignFromIdea(idea: IdeaCard): Campaign {
  const base = blankCampaign();
  const email: EmailContent = {
    ...base.email,
    heroHeadline: idea.title || base.email.heroHeadline,
    announcement: idea.patientAnnouncement || base.email.announcement,
    introBody: `Hi *|FNAME|*,\n\n${idea.patientIntro || base.email.introBody.replace(/^Hi \*\|FNAME\|\*,\n\n/, "")}`,
    tableEnabled: idea.cardType === "Promotional" && (idea.title || "").toLowerCase().includes("copay"),
  };
  const intro = (idea.patientIntro || "").split("\n").find((l) => l.trim()) ?? "";
  return {
    ...base,
    title: idea.title,
    cardType: idea.cardType,
    cohort: idea.cohort || base.cohort,
    ctaLabel: idea.cta || base.ctaLabel,
    email,
    poster: posterFromEmail(idea.title || base.poster.headline, intro.replace(/:$/, "").slice(0, 240), email, base.supportLine),
  };
}

export function brandHeaderSpec(c: Campaign): string {
  const b1 = c.brand1.trim();
  const b2 = c.brand2.trim();
  const b3 = c.brand3.trim();
  if (c.brandMode === "co2") return `2-Column Co-Branded Header: Brand 1 (${b1}) | Connector Text: "${c.brandConnector}" | Brand 2 (${b2})`;
  if (c.brandMode === "co3") return `3-Column Co-Branded Header: Brand 1 (${b1}) | Brand 2 (${b2}) | Brand 3 (${b3}) | Connector Text: "${c.brandConnector}"`;
  return `Primary Brand Logo: ${b1}`;
}

export function emailTableSpec(c: Campaign): string {
  const e = c.email;
  if (!e.tableEnabled) return "None (Omit section cleanly)";
  const dataRows = e.tableRows.map((r, i) => `  - [Row ${i + 1}]: ${r.join(" | ")}`);
  const disclaimer = e.disclaimerEnabled ? `\n- Table Legal Disclaimer:\n${e.disclaimerText}` : "";
  return `Include Responsive Table\n- Intro Header: "${e.tableIntro}"\n- Table Headers: [ ${e.tableHeaders.join(" | ")} ]\n- Table Rows:\n${dataRows.join("\n")}${disclaimer}`;
}

/** The email campaign data as the numbered 11-section text the Email Designer understands. */
export function buildEmailBlueprint(c: Campaign): string {
  const e = c.email;
  const optional = (on: boolean, text: string) => (on ? text : "None (omit this section)");
  const cards = e.cards.map((x) => `- ${x.icon} **${x.title}:** ${x.subtext}`).join("\n");
  const steps = e.steps.map((s, i) => `${i + 1}. ${s.title}\n${s.details}`).join("\n");
  return `# Campaign Blueprint: ${c.title}

1. PREHEADER BAR
${optional(e.preheaderEnabled, e.preheaderText)}

2. HEADER LOGO BLOCK
${brandHeaderSpec(c)}

3. HERO BANNER
Headline: ${e.heroHeadline}
Sub-banner: ${e.announcement}

4. PATIENT-FACING INTRO HOOK
${e.introBody}

5. MEDICINE PRICE COMPARISON TABLE MATRIX
${emailTableSpec(c)}

6. MEMBER SAVINGS BENEFIT CARDS
${e.cardsHeader}
${cards}

7. DID YOU KNOW CALLOUT BOX
${optional(e.didYouKnowEnabled, `${e.didYouKnowTitle}\n${e.didYouKnowBody}`)}

8. STEP-BY-STEP ORDERING GUIDE
${e.guideTitle}
${steps}
${e.promoTipEnabled ? `Promo tip: ${e.promoTipHeader} ${e.promoTipBody}` : ""}

9. PRIMARY CALL TO ACTION
[${c.ctaLabel}](${c.ctaUrl})
${e.ctaMicrocopy}

10. DOCTOR TELECONSULT CALLOUT
${optional(e.secondaryCtaEnabled, `${e.secondaryTitle}\n[${e.secondaryLabel}](${e.secondaryUrl})`)}

11. TERMS AND FOOTER
${e.terms}
${c.supportLine}
${e.footerText}
`;
}

/** Directive text that makes the Email Designer build the co-branded header. */
export function buildEmailDirectives(c: Campaign): string {
  return `Header Layout Directive: ${brandHeaderSpec(c)}`;
}

/** Standalone prompt for pasting into any LLM (IDEAte's original "Master HTML Prompt"). */
export function buildStandaloneHtmlPrompt(c: Campaign): string {
  const e = c.email;
  const optional = (on: boolean, text: string) => (on ? text : "None (Omit cleanly)");
  const spec = brandHeaderSpec(c);
  const cardsSpec = [`Header: "${e.cardsHeader}"`, ...e.cards.map((x, i) => `- Card ${i + 1}: Icon: ${x.icon} | Title: "${x.title}" | Subtext: "${x.subtext}"`)];
  const steps = e.steps.map((s, i) => `  - Step ${i + 1}: Title: ${s.title} | Details: ${s.details}`).join("\n");
  const promoTip = optional(e.promoTipEnabled, `Include Promo Tip Box:\n- Header: "${e.promoTipHeader}"\n- Body: "${e.promoTipBody}"`);
  const didYouKnow = optional(e.didYouKnowEnabled, `Include "Did you know?" Callout Box:\n- Header: "${e.didYouKnowTitle}"\n- Body: "${e.didYouKnowBody}"`);
  const secondary = optional(
    e.secondaryCtaEnabled,
    `Include Secondary Doctor Teleconsult CTA:\n- Callout: "${e.secondaryTitle}"\n- Button Label: "${e.secondaryLabel}"\n- Target URL: ${e.secondaryUrl}`,
  );
  return `You are an expert HTML Email Developer. Your task is to generate a fully responsive, cross-client compatible HTML email blast (XHTML 1.0 Transitional) based on the provided content structure and brand styling rules.

---

### 1. BRAND AND DESIGN STYLING RULES (Injected by System)
Use the following styling tokens for all elements. Do NOT invent arbitrary colors or styles outside these specifications.
- Primary Brand Color: {{BRAND_PRIMARY_COLOR}}
- Secondary Brand Color: {{BRAND_SECONDARY_COLOR}}
- Accent and CTA Color: {{BRAND_ACCENT_COLOR}}
- Background Color (Canvas): {{BRAND_CANVAS_BG}}
- Container Background: {{BRAND_CONTAINER_BG}}
- Card Background: {{BRAND_CARD_BG}}
- Primary Text Color: {{BRAND_TEXT_COLOR}}
- Muted Text Color: {{BRAND_MUTED_COLOR}}
- Font Family: {{BRAND_FONT_FAMILY}}
- Container Border Radius: {{BRAND_BORDER_RADIUS}}
- Header Layout Directive: ${spec}

---

### 2. TECHNICAL AND RESPONSIVE CONSTRAINTS
- Use nested <table> structures with border="0", cellpadding="0", and cellspacing="0".
- All text styles must be inlined using the style="..." attribute while maintaining standard email resets in the <head>.
- Main Email Container width: 600px max, centered, responsive (width="100%" on screens under 600px).
- Embedded CSS for mobile screens (@media screen and (max-width: 600px)):
  - Stack multi-column table cells vertically (display: block !important; width: 100% !important;).
  - Convert responsive spacers to display: none !important;.
  - Adjust container padding to fit smaller viewports.

---

### 3. EXACT SECTION HIERARCHY AND CONTENT PLACEMENT
Construct the email in this exact top-to-bottom sequence. If an optional section is marked 'None', cleanly omit it:
1. PREHEADER BAR (Top Alert Banner)
2. HEADER LOGO BLOCK (${spec})
3. HERO BANNER (Full-width header block with Headline and Announcement)
4. PATIENT-FACING INTRO HOOK (Personalized Greeting + Warm, benefit-led message)
5. MEDICINE PRICE COMPARISON TABLE MATRIX (Optional Price difference table + Legal disclaimer)
6. MEMBER SAVINGS BENEFIT CARDS (1, 2, or 3 cards with accent borders)
7. "DID YOU KNOW?" CALLOUT BOX (Optional highlighted tip box)
8. STEP-BY-STEP ORDERING GUIDE (3-Step ForwardMG process + Promo Tip Box)
9. PRIMARY CALL TO ACTION (Main order button + urgency subtext)
10. DOCTOR TELECONSULT CALLOUT AND SECONDARY CTA (Optional prescription assistance box)
11. TERMS AND CONDITIONS, SUPPORT, AND COMPLIANCE FOOTER

---

### 4. VERIFIED CAMPAIGN INPUT DATA

- 1. Preheader Bar: ${e.preheaderEnabled ? e.preheaderText : "None (Omit section cleanly)"}
- 2. Header Logos: ${spec}
- 3. Hero Banner:
  - Main Headline: ${e.heroHeadline}
  - Announcement Bar: ${e.announcement}
- 4. Patient-Facing Intro Hook:
${e.introBody}

- 5. Medicine Price Comparison Table Matrix:
${emailTableSpec(c)}

- 6. Member Savings Benefit Cards:
${cardsSpec.join("\n")}

- 7. "Did You Know?" Callout:
${didYouKnow}

- 8. Step-by-Step Guide:
  - Guide Title: ${e.guideTitle}
${steps}
  - Promo Tip Box: ${promoTip}

- 9. Primary Call to Action:
  - Button Text: ${c.ctaLabel}
  - Target URL: ${c.ctaUrl}
  - Urgency Microcopy: ${e.ctaMicrocopy}

- 10. Secondary CTA:
${secondary}

- 11. Terms, Support, and Footer:
  - Terms:
${e.terms}
  - Support Contact: ${c.supportLine}
  - Footer Compliance Text: ${e.footerText}

---

### OUTPUT GENERATION INSTRUCTION
Generate ONLY the complete, production-ready, raw HTML code inside a single html block. Do not include markdown commentary, explanations, or code blocks outside the HTML itself. Ensure all input variables are safely rendered inside valid XHTML syntax.`;
}

/** The poster content as a brief the Poster Illustrator (or any designer/LLM) can act on. */
export function buildPosterBrief(c: Campaign): string {
  const p = c.poster;
  const lines: string[] = [p.headline.trim()];
  if (p.subheading.trim()) lines.push(p.subheading.trim());
  const brands = [c.brand1, c.brandMode !== "single" ? c.brand2 : "", c.brandMode === "co3" ? c.brand3 : ""].filter((b) => b.trim());
  if (brands.length) {
    lines.push(`Brand: ${brands.join(c.brandMode !== "single" && c.brandConnector !== "N/A" ? ` ${c.brandConnector} ` : " + ")}`);
  }
  const steps = linesToSteps(p.stepsText);
  if (steps.length) {
    if (p.stepsTitle.trim()) lines.push("", `${p.stepsTitle.trim()} (flowchart):`);
    steps.forEach((s, i) => {
      const detail = s.detail ? ` — ${s.detail}` : "";
      const branch = s.decision ? ` (Yes: ${s.decision.yes ?? "continue"}; No: ${s.decision.no ?? "stop"})` : "";
      lines.push(`${i + 1}. ${s.label}${detail}${branch}`);
    });
  }
  const points = p.pointsText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (points.length) lines.push("", "Key points:", ...points.map((l) => `- ${l}`));
  if (p.callout.trim()) lines.push("", `Callout: ${p.callout.trim()}`);
  if (c.ctaLabel.trim()) lines.push("", `Call to action: ${c.ctaLabel.trim()}${c.ctaUrl.trim() ? ` ${c.ctaUrl.trim()}` : ""}${p.showQr && c.ctaUrl.trim() ? " (show a QR code)" : ""}`);
  if (p.footer.trim()) lines.push(`Footer: ${p.footer.trim()}`);
  if (p.disclaimer.trim()) lines.push(`Disclaimer: ${p.disclaimer.trim()}`);
  if (p.illustrationHint.trim()) lines.push("", `Illustration idea: ${p.illustrationHint.trim()}`);
  return lines.join("\n");
}

/** A self-contained prompt to paste into any AI image/design tool. */
export function buildPosterPromptText(c: Campaign): string {
  return `You are a brand designer. Design a clean, modern information poster from the content below. Keep every fact, number and URL exactly as written; do not add claims. Use a clear visual hierarchy: headline, flowchart or steps, key points, then the call to action with a QR code when requested, and a small footer.

${buildPosterBrief(c)}`;
}
