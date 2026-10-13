# Brand Engine

One workspace that takes a campaign from idea to finished design: plan it on a calendar, write the content once, then produce
Mailchimp-ready MJML emails and print-ready posters in your brand's colors, fonts, logos and illustrations. It replaces the old standalone
IDEAte app (Idea Base, AI Generator, Calendar Pipeline) and the earlier Brand & MJML Email Engine.

Stack: Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Lucide icons, Zustand persisted in IndexedDB, server-side `mjml`,
`@google/genai`, `html-to-image` + `jspdf` + `qrcode` for poster export, and `resend` / SendGrid / Mandrill for test sends.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional, see below
npm run dev                  # http://localhost:4310
```

## Navigation

| Section | Tab | What it does |
| --- | --- | --- |
| **Plan** | Calendar | Month grid of scheduled campaigns. Click a day to view, mark complete, move, remove, add a campaign, or open it in Idea Studio. Exports CSV and iCal. Scheduled items become "Past Date (Released)" after their date. |
| | Design Repository | Saved emails and posters. Open a poster to keep editing; inspect an email to edit its HTML. |
| **Create** | Idea Generator | AI campaign ideas from the Idea Base (Hybrid / Idea Base Match / Pure Random), by cohort, tone and focus. Inspect an idea, copy it, and schedule it. |
| | Idea Studio | The full campaign form: shared basics (title, brand header, CTA) plus Email content and Poster content. Reach it from an idea, a calendar item, or the tab. Autosaves to the linked calendar item. Designs sent from here and then saved are attached to that calendar item and listed in its day view. |
| | Design Studio | **Email Designer** (blueprint to MJML) and **Poster Illustrator** (brief to editable poster, PNG / PDF export). |
| **Library** | Idea Base | Scratch notes and uploaded documents (PDF, PNG/JPG, HTML, TXT up to 25 MB; AI analysis reads PDFs up to 2.5 MB and shrinks larger images first) with AI analysis, filters, and an active toggle. |
| | Brand Books | Per brand: colors and font, logos, illustrations, uploaded fonts, PDFs, CDN URLs. Every asset is tagged Email Design, Poster Illustration, or both. |

From Idea Studio, **Copy prompt** offers an Email Designer prompt or a Poster Illustrator prompt for any outside AI tool, and **Send to Design Studio** fills the
Email Designer blueprint or the Poster Illustrator brief.

## Poster Illustrator

- Write a brief in your own words or pick a suggested format (step-by-step flowchart, campaign announcement, checklist, facts and numbers).
- Gemini returns a structured layout that is rendered in the browser in your brand colors. Without a Gemini key a built-in offline layout reads the structure straight out of the brief.
- Size can be changed before and after generating: A4, A3, A2, Letter, Instagram post and story, Facebook post, or custom width, height and unit; the layout re-flows. Print sizes carry a bleed (3 mm by default).
- Illustrations: your Poster Illustration library is used first. If nothing fits, AI draws one. In Settings → Poster illustrations pick Gemini (same key as everything else) or FLUX via fal.ai (a separate fal.ai key; the Gemini key still powers layouts, revisions, ideas, emails and analysis). Keys stay in your browser and are never included in workspace exports and saves it back to the brand book.
- Fonts: upload `.ttf`, `.otf`, `.woff` or `.woff2` files in Brand Books. If the requested font isn't uploaded, the closest similar system font is used.
- Export: PNG, direct PDF (with bleed and crop marks), or Vector PDF through the print dialog (live text and embedded fonts).
- Limits to know about: exported PDFs are RGB, not CMYK (ask your printer to convert, or use the Vector PDF route and convert there). The direct PDF embeds a high-resolution image, with vector crop marks. Very large sizes at 300 DPI are capped at about 24 megapixels by the browser.

## Moving data from the old IDEAte app

In the old app open the browser console and run `copy(localStorage.getItem('bestLifePipelineDBv4'))`, then use **Import from IDEAte** in Idea Base or Calendar and paste the result
(or choose a saved file). Existing items are never overwritten. The Gemini key and model can be copied across if you choose.

## Features added in v2

- **Light / Dark theme** - toggle next to the sidebar brand header, persisted in the Zustand store. Light mode follows the `ideate_content_pipeline_v4` palette (canvas `#F8FAFC`, navy sidebar `#0F172A` / hover `#1E293B`, borders `#E2E8F0`; badges emerald `#10B981` promo, purple `#6366F1` non-promo, amber `#F59E0B` seasonal).
- **11-section blueprint catalog** (`lib/blocks.ts`) with `<!-- SECTION: NAME -->` / `<!-- END SECTION: NAME -->` markers, legacy marker mapping (e.g. `VALUE GRID`), heuristic classification of un-marked MJML, and custom sections rendered as generic content blocks.
- **Revise Sections modal** (`components/ReviseSectionsModal.tsx`) with a Prompt Description view and an interactive Block Builder (reorder, show/hide, inline text / button / image-URL editing, add blocks, Apply Changes recompiles).
- **Brand tokens** - `{{BRAND_PRIMARY_COLOR}}`, `{{BRAND_SECONDARY_COLOR}}`, `{{BRAND_ACCENT_COLOR}}`, `{{BRAND_CANVAS_BG}}`, `{{BRAND_CONTAINER_BG}}`, `{{BRAND_FONT_FAMILY}}` (and text / muted / border / button-text variants) are resolved server-side from the brand book's tokens, hints in directives, or defaults before compiling. Co-branded headers are grouped in `<mj-group>`.
- **Reference screenshots** - attach up to 3 PNG/JPG images under Custom Directives; they are sent to Gemini as inline base64 image parts, and can optionally be saved to the active brand book.
- **Repair engine** (`lib/mjml-repair.ts`) also balances `<table>/<tr>/<td>/<th>` inside `<mj-table>` and wraps stray `<mj-column>` / `<mj-group>` / content in valid parents.

Run the tests with `npm test`.

## API routes

| Route | Purpose |
| --- | --- |
| `POST /api/generate-blast` | Builds the prompt from blueprint + brand assets + directives, calls Gemini server-side, repairs MJML, compiles with `mjml`, returns `{ mjml, html, warnings }`. Also handles section revisions. |
| `POST /api/transpile-mjml` | Repairs (unclosed `<mj-preview>`, `<mj-font>`, `<mj-image>`, stray closers, markdown fences, misplaced head tags) and compiles edited MJML. |
| `POST /api/send-test-email` | Sends the HTML via Resend (SDK), SendGrid or Mandrill from the server. Merge tags are replaced with sample values. |
| `POST /api/generate-poster` | Returns a validated poster layout (JSON spec) from a brief, brand tokens, size and asset summaries; also handles AI revisions. Offline fallback without a key. |
| `POST /api/generate-illustration` | Draws one poster illustration with Gemini or FLUX (fal.ai) and returns a data URL. |
| `POST /api/generate-ideas` | Generates campaign idea cards; falls back to built-in templates without a key. |
| `POST /api/analyze-resource` | Extracts notes from an uploaded PDF, image or text file. |
| `GET /api/status` | Reports which keys exist in server env (never the values). |

## Configuration

Keys can be entered in the in-app settings modal (stored in this browser, sent only to this app's routes) or set as server env vars:
`GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_IMAGE_MODEL`, `FAL_KEY`, `FLUX_MODEL`, `RESEND_API_KEY`, `SENDGRID_API_KEY`, `MANDRILL_API_KEY`, `MAIL_FROM`.

Without a Gemini key the generator falls back to a built-in offline MJML template builder so the whole workflow remains usable.
Test sends require a mailer key and a verified sender address.

## Notes

- Data lives in the browser's IndexedDB (no server database). Data saved by earlier versions in localStorage is moved over automatically on first load.
- PDFs are limited to 3 MB each and screenshots are downscaled so requests stay under Vercel's 4.5 MB body limit.
- Every brand asset is tagged for **Email Design**, **Poster Illustration**, or both (never neither). The email generator only sees assets tagged Email Design; Brand Books shows Email Design, Poster Illustration and All Assets folders.
- Settings → Workspace backup exports everything (brand books, assets and fonts, saved emails and posters, Idea Base, calendar pipeline, theme) to one JSON file, with API keys excluded, and imports it with Merge or Replace. To share with a teammate: deploy the app (e.g. on Vercel), then send them the export file to import.
- Poster, font and export work stays in the browser, and only small summaries are sent to the server, which keeps requests under Vercel's 4.5 MB body limit.
- Only CDN URLs saved in the selected brand book are allowed as image sources in generated emails.
