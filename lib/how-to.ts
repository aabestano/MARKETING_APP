export type GuideSegmentId = "setup" | "plan" | "create" | "library";

export interface GuideItem {
  /** Control or status name. Shown in bold ahead of the description. */
  name?: string;
  text: string;
  /** Optional monospace snippet under the description. */
  code?: string;
}

export interface GuideGroup {
  title?: string;
  items: GuideItem[];
}

export interface GuideCard {
  id: string;
  title: string;
  purpose: string;
  groups: GuideGroup[];
}

export interface GuideSegment {
  id: GuideSegmentId;
  label: string;
  intro: string;
  cards: GuideCard[];
}

export interface GuideKey {
  id: string;
  label: string;
  powers: string;
  where: string;
}

/** Where each team key is pasted. The values stay out of the repository. */
export const GUIDE_KEYS: GuideKey[] = [
  {
    id: "gemini",
    label: "Gemini",
    powers: "Ideas, email layouts, poster layouts, section rewrites, and document analysis",
    where: "Gemini → API key",
  },
  {
    id: "fal",
    label: "fal.ai",
    powers: "Drawing a poster illustration when the brand library has nothing that fits",
    where: "Poster illustrations → FLUX (fal.ai) → fal.ai API key",
  },
  {
    id: "resend",
    label: "Resend",
    powers: "Sending yourself a test of the email",
    where: "Mailer for test sends → Resend → API key",
  },
];

export const WORKSPACE_DRIVE_URL = "https://drive.google.com/drive/folders/1Wc7G4TQ8owuQKwJZpxNqQF5lKvBmFrnF?usp=drive_link";

export const GUIDE_SEGMENTS: GuideSegment[] = [
  {
    id: "setup",
    label: "Setting up",
    intro: "Do this once in a new browser. Keys and the workspace are separate. The workspace file does not contain keys.",
    cards: [
      {
        id: "sidebar",
        title: "Sidebar",
        purpose: "The left column is how you move around and how you see whether the app is ready.",
        groups: [
          {
            items: [
              { name: "Plan, Create, and Library", text: "Switch sections. The active section shows its tabs across the top of the main panel." },
              { name: "Move up / Move down", text: "Reorder the three sections. On a tab, move it left or right. The order is saved in this browser." },
              { name: "Light and dark mode", text: "The sun or moon button next to the app name switches the theme." },
              { name: "Gemini status", text: "The settings card shows the model name. A green dot means a key is saved. Amber means the app will use the offline templates." },
              { name: "Mailer status", text: "The card shows the provider name. Ready means that provider’s key is saved." },
            ],
          },
        ],
      },
      {
        id: "settings",
        title: "API and Mail Settings",
        purpose: "Open the card under this guide. Changes to keys, name, and wording apply when you press Save settings.",
        groups: [
          {
            items: [
              { name: "App name", text: "Shown in the sidebar, the browser tab, and calendar exports. Leave it blank to use IDEAte." },
              { name: "Reset tab order", text: "Restores Plan, Create, and Library, and the tabs inside them." },
              { name: "Interface text", text: "Rename headers, helper text, and buttons. A blank field keeps the original wording. Reset one line, or reset all of them." },
              { name: "Gemini", text: "Paste the Gemini key and pick the model. This key runs ideas, email layouts, poster layouts, section rewrites, and reading uploaded documents." },
              { name: "Poster illustrations", text: "Gemini uses the Gemini key and an image model. FLUX (fal.ai) uses a separate fal.ai key and a FLUX model. Your illustration library is always searched first. Layouts, ideas, and emails still use Gemini." },
              { name: "Mailer for test sends", text: "Pick Resend, SendGrid, or Mandrill, paste that provider’s key, then set From name, From email, and the default test recipient. The from address has to be verified with that provider." },
              { name: "Save settings", text: "Keys stay in this browser and are left out of every workspace file." },
            ],
          },
        ],
      },
      {
        id: "keys",
        title: "Keys to paste on a new browser",
        purpose: "Paste the team key for each row, choose FLUX (fal.ai) and Resend, then press Save settings. The key values are shared outside this app, so they are not stored in the guide. After saving, Gemini should show a green dot and Mailer should say Ready.",
        groups: [],
      },
      {
        id: "workspace",
        title: "Workspace backup",
        purpose: "Brand books, assets, fonts, saved emails and posters, the Idea Base, the calendar, the theme, the app name, and the tab order travel as one JSON file. API keys never travel with it.",
        groups: [
          {
            title: "Move a workspace file",
            items: [
              { name: "Export workspace", text: "Downloads that JSON. It runs immediately, without Save settings." },
              { name: "Import workspace", text: "Loads a JSON file. Merge adds it and updates items that share an ID. Replace clears this browser, then loads the file. Import also runs immediately." },
            ],
          },
          {
            title: "Load the shared workspace",
            items: [
              { text: "Open the Drive folder and download the workspace JSON file." },
              { text: "In IDEAte, open API and Mail Settings." },
              { text: "Under Workspace backup, click Import workspace and choose that file." },
              { text: "On a new browser, choose Replace. Choose Merge only when this browser already has work you want to keep." },
              { text: "Check the sidebar again. If the dots are not green, paste the three keys. They are not inside the file." },
              { text: "Later, export a new JSON and upload it to the same Drive folder when the team should get newer work." },
            ],
          },
          {
            title: "Coming from the old IDEAte app",
            items: [
              {
                text: "If the work lives in the old app instead of Drive, open that app’s browser console and run this, then copy the result.",
                code: "copy(localStorage.getItem('bestLifePipelineDBv4'))",
              },
              { name: "Import from older IDEAte versions", text: "On the Calendar or the Idea Base, paste what you copied. Items already here are kept." },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "plan",
    label: "Plan",
    intro: "Plan is the calendar. Schedule from Create first, then come back here to run the month.",
    cards: [
      {
        id: "calendar",
        title: "Calendar",
        purpose: "A month of campaigns. The header counts scheduled, released, and completed.",
        groups: [
          {
            title: "The month",
            items: [
              { name: "Previous month / Next month / Today", text: "Move through the year. Today’s cell has a blue ring." },
              { text: "A day shows up to two campaign titles, then “+ more”. On a narrow screen, status dots replace the titles. Green is scheduled, amber is a past date, gray is completed." },
              { text: "A date that has passed shows as Past Date (Released) until you mark it completed." },
              { name: "CSV", text: "Downloads the schedule." },
              { name: "iCal", text: "Downloads a calendar file named with the app name." },
              { name: "Import from older IDEAte versions", text: "Pastes a pipeline from the old app. This is separate from the Drive JSON import in settings." },
              { name: "Open Idea Generator", text: "Shown when the calendar is empty, next to the old-app import." },
            ],
          },
          {
            title: "A day",
            items: [
              { text: "Click a day to open it." },
              { name: "Add a campaign on this day", text: "Creates a blank campaign and opens it in Idea Studio." },
              { text: "Each campaign shows its type badge, status, a “Studio content saved” mark when Idea Studio has written to it, and a short summary." },
              { name: "View idea", text: "Opens the idea card. From there you can open it in Idea Studio." },
              { name: "Open in Idea Studio", text: "Loads that campaign’s content. Edits save back onto this day." },
              { name: "Mark complete", text: "Sets the status to Completed." },
              { name: "Reopen", text: "Turns a completed item back to Scheduled." },
              { name: "Move to", text: "Changes the date. Moving a past-date item onto today or later sets it back to Scheduled." },
              { name: "Remove", text: "Takes the campaign off the calendar. Saved email and poster files stay in the Design Repository." },
              { name: "Designs for this campaign", text: "Lists emails and posters saved while this campaign was open. Open the email in the Email Designer or the poster in the Poster Illustrator. Unlink a design from the day without deleting the file." },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "create",
    label: "Create",
    intro: "Work the three tabs in order. The brand selector at the top of Create applies to all three.",
    cards: [
      {
        id: "idea-generator",
        title: "Idea Generator",
        purpose: "Builds campaign ideas, then schedules the ones you want. Up to 10 unscheduled ideas stay on this tab. Scheduling one removes it from here and puts it on the Calendar.",
        groups: [
          {
            title: "Campaign generation matrix",
            items: [
              { name: "Hybrid (Idea Base + AI)", text: "Mixes active Idea Base notes with new writing." },
              { name: "Idea Base Match", text: "Stays on the uploaded notes. It needs at least one active item with notes." },
              { name: "Pure AI", text: "Ignores the Idea Base and uses the cohort." },
              { name: "Custom Idea Base Items", text: "Uses only the notes you check, up to 10. A file with no notes has to be analyzed in the Idea Base before it can be checked." },
              { text: "The matrix shows how many active Idea Base items with notes will be used, and how many upcoming calendar items are excluded so ideas are not repeated." },
              { name: "Target cohort", text: "All Members, Unconverted, Ordered within the past 90 days, or Ordered more than 90 days ago." },
              { name: "Tone", text: "Empathetic and Supportive, Urgent and Savings-Driven, Informative and Navigational, or Modular and custom." },
              { name: "Focus types", text: "One idea is made for each box you leave on: Promotional, Non-Promotional, and Non-promotional (Resource). At least one is required." },
              { name: "Generate ideas", text: "Writes the cards. Without a Gemini key, built-in templates are used and the screen says so. Generating more than 10 unscheduled ideas drops the oldest." },
            ],
          },
          {
            title: "A generated card",
            items: [
              { name: "Inspect and schedule", text: "Opens the summary, announcement, intro, cohort, offer, subject lines, outline, call to action, and SMS. Pick a date and schedule it." },
              { name: "Inspect full idea content", text: "Opens the longer draft, with Basics, Email, and Poster. Edit it, send that draft to Idea Studio, or schedule the edited version." },
            ],
          },
        ],
      },
      {
        id: "idea-studio",
        title: "Idea Studio",
        purpose: "Turns one campaign into email copy and poster copy. Changes save as you type.",
        groups: [
          {
            title: "Open a campaign",
            items: [
              { name: "Start from the template", text: "Opens the ForwardMG and Best Life campaign, ready to edit." },
              { name: "From a calendar item", text: "Opens a scheduled campaign. Linked edits save onto that date." },
              { name: "From a generated idea", text: "Opens an unscheduled idea. It stays unlinked until you schedule it." },
              { text: "The header says which calendar date the open campaign is saved to, or that it is not linked." },
            ],
          },
          {
            title: "Send the copy onward",
            items: [
              { name: "Copy prompt → Email Designer prompt", text: "Copies a full prompt for an outside tool that writes the email." },
              { name: "Copy prompt → Poster Illustrator prompt", text: "Copies a prompt for an outside design tool." },
              { name: "Send to Design Studio → Email Designer", text: "Fills the blueprint and the header directive, selects the matching brand book, and opens Design Studio. If an email is already open, you confirm before it is replaced." },
              { name: "Send to Design Studio → Poster Illustrator", text: "Fills the poster brief and opens that mode. If a poster is already open, you confirm before it is replaced." },
              { name: "Reset to template", text: "Replaces the open content with the ForwardMG template." },
              { name: "Close", text: "Leaves the studio." },
            ],
          },
          {
            title: "Basics",
            items: [
              { text: "Campaign title, type (Promotional, Non-Promotional, Non-promotional (Resource), Seasonal), and cohort." },
              { text: "Brand header: single brand, or 2 or 3 logos, plus connector text and the brand names." },
              { text: "Shared call to action: button label, link, and support line. The email and the poster both use it." },
            ],
          },
          {
            title: "Email content",
            items: [
              { text: "Preheader, hero headline, announcement banner, and intro. Use *|FNAME|* for the member’s first name. Blocks with a toggle can be turned off." },
              { text: "Price comparison table: intro, 2–4 columns, 1–10 rows, and an optional disclaimer." },
              { text: "Benefit cards: a section header and 1–4 cards, each with an icon, title, and subtext." },
              { text: "Did you know box, a step-by-step guide (1–6 steps), and a promo tip box." },
              { text: "Calls to action: microcopy under the main button, and an optional second call-out with its own label and link." },
              { text: "Terms and conditions, and the footer." },
            ],
          },
          {
            title: "Poster content",
            items: [
              { name: "Custom directive", text: "Tell the poster what to emphasize. Leave it as N/A to keep the idea’s own copy." },
              { name: "Fill poster sections", text: "Writes the poster sections from that request." },
              { text: "Headline and subheading." },
              { text: "Steps, one per line. Add detail with “Label :: detail”. A yes or no decision is “Label ?? yes outcome || no outcome”." },
              { text: "Key points, one per line, and a callout." },
              { name: "Show a QR code", text: "Uses the link from Basics." },
              { text: "Footer, disclaimer, and what the illustration should show. The Poster Illustration library is searched first. AI draws one only if nothing fits." },
            ],
          },
        ],
      },
      {
        id: "design-studio",
        title: "Design Studio",
        purpose: "Turns the copy into an email or a poster. A blue bar names the calendar item this design belongs to. What you save is attached to that day.",
        groups: [
          {
            title: "Shared",
            items: [
              { name: "Email Designer / Poster Illustrator", text: "Switch modes. Emails use assets tagged Email Design. Posters use assets tagged Poster Illustration." },
              { name: "Detach", text: "Keeps working without attaching the next save to the calendar item." },
            ],
          },
          {
            title: "Email Designer",
            items: [
              { name: "Brief", text: "Write or paste a markdown blueprint. Load sample, or Load 11-section sample. Choose a brand book, or all brand books. Add custom directives. Attach up to 3 reference screenshots, and optionally save them onto the brand book. Only CDN URLs saved on that book can become images." },
              { name: "Generate Blast", text: "Writes MJML, repairs it, and compiles HTML. Without a Gemini key, an offline template is used. Regenerate Blast replaces the current email." },
              { name: "Edit Sections with AI", text: "Describe a change and apply it. The email is recompiled." },
              { name: "Manually Edit Sections", text: "Recolor from the brand book, reorder blocks, show or hide them, edit text, buttons, and image URLs, add a block, and apply. That recompiles without a new AI pass." },
              { name: "Visual Preview", text: "Shows the email. Open in new tab, or Print." },
              { name: "MJML Code Editor", text: "Edit the MJML. It auto-compiles about a second after you stop typing, or press Transpile now." },
              { name: "Raw HTML", text: "Read-only compiled output. Edit the MJML to change it." },
              { text: "A badge says Gemini, Offline template, or Edited. Auto-repair notes are listed above the preview." },
              { name: "Copy for Mailchimp", text: "Copies the HTML with sample values filled in for merge tags." },
              { name: "Send Test Email", text: "Sends through the mailer in settings. You can change the recipient for this send." },
              { name: "Save Blast", text: "Name, subject, and category: Promotional, Educational, or Seasonal. A linked calendar item lists the blast on that day." },
            ],
          },
          {
            title: "Poster Illustrator",
            items: [
              { name: "Brief", text: "Write the poster in your own words, or start from a suggested format: step-by-step flowchart, campaign announcement, checklist and tips, or facts and numbers. Clear the brief." },
              { name: "Layout prompt", text: "Build one from the brief, brand book, size, hero, and layout pieces. Generate uses it when the box has text." },
              { name: "Brand book and illustration", text: "Library images tagged Poster Illustration are listed first. Draw with AI uses Gemini or fal.ai, depending on settings, and can save the picture back to the brand book." },
              { name: "Generate poster", text: "Builds the layout in the brand colors. Regenerating replaces manual edits. Changing size or hero size does not require a regenerate. Without a Gemini key, a built-in layout is read from the brief." },
              { name: "Size", text: "A4, A3, A2, Letter, Instagram post, Instagram story, Facebook post, or a custom width, height, and unit. Swap orientation. Print sizes have a bleed, 3 mm unless you change it. You can change size before or after generating." },
              { name: "Save to repository", text: "Keeps the poster. The button becomes Update saved after the first save. A linked calendar item lists it on that day." },
              { name: "Download Poster", text: "PDF (print-ready, RGB, not CMYK), PNG, Vector PDF (print dialog, live text), or Figma SVG (text stays editable; fonts need to be installed in Figma). Print sizes can export at draft or 300 DPI. Very large sizes are capped around 24 megapixels." },
              { name: "Check against brief", text: "Compares the poster with what you asked for." },
              { name: "Edit Sections with AI", text: "Rewrites a chosen part." },
              { name: "Manually Edit Sections", text: "Edits the blocks on the canvas directly." },
              { text: "Toggle bleed, crop marks on the PDF, hero size (Small, Medium, Large), Remove background, and trim guides. Remove background turns a plain white or empty edge transparent. Interior white, such as a logo, stays. The original file is unchanged." },
              { text: "The canvas warns when text no longer fits and tells you to shorten a section or shrink the hero." },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "library",
    label: "Library",
    intro: "Library is what Plan and Create read. After a Drive import, most of this is already filled in.",
    cards: [
      {
        id: "idea-base",
        title: "Idea Base",
        purpose: "Source notes. Only Active items with notes are offered to the Idea Generator, and only for the brand selected in Create.",
        groups: [
          {
            title: "Add",
            items: [
              { name: "Scratch note", text: "Title, notes, target month, cohort, comma-separated tags, brand book, and Active." },
              { name: "Upload file", text: "PDF, PNG, JPG, HTML, or TXT, up to 25 MB, plus a source type. TXT and HTML notes are filled in automatically. PDFs and images need Analyze with AI. Analysis reads PDFs up to about 2.5 MB and shrinks large images. Bigger PDFs can be stored, and the notes have to be typed." },
              { name: "Add to Idea Base", text: "Saves the note or file." },
              { name: "Load sample ideas", text: "Adds starter notes so you can click through before real notes exist." },
              { name: "Import from older IDEAte versions", text: "Pastes the old app’s data. This is separate from the Drive JSON import in settings." },
            ],
          },
          {
            title: "Find and edit",
            items: [
              { name: "Search", text: "Matches title, tags, or notes." },
              { text: "Filter by cohort, source type, and status." },
              { name: "Select", text: "Select one or all, then Set as Active, Set as Inactive, or Delete. Delete is permanent." },
              { name: "Active", text: "On a card, this is the switch the Idea Generator reads. On means the generator may use it." },
              { name: "Open", text: "Edit the notes the generator will use, open the original file, re-analyze, and change the brand book." },
              { name: "Analyze with AI", text: "Pulls notes out of an uploaded PDF or image. Re-analyze with AI runs it again. Needs the Gemini key." },
              { name: "Delete", text: "Removes one item from its card, after you confirm." },
            ],
          },
        ],
      },
      {
        id: "brands",
        title: "Brand Books",
        purpose: "Colors, type, logos, illustrations, and files for one brand. Design Studio only sees assets tagged for the thing you are making.",
        groups: [
          {
            title: "Add a book or a file",
            items: [
              { name: "+ New brand book…", text: "Name the book, then upload into it." },
              { name: "Drop files here", text: "PDF, PNG, JPG, SVG, TTF, OTF, WOFF, WOFF2, TXT, HTML, MJML, and Markdown." },
              { name: "Save CDN URL", text: "URL, label, usage directive, and purpose. Generated emails can only use CDN URLs saved here." },
            ],
          },
          {
            title: "A brand book",
            items: [
              { name: "Email Design / Poster Illustration / All Assets", text: "Folder tabs filter the library. Counts show on the tabs. An asset is tagged Email Design, Poster Illustration, or both." },
              { name: "Color tokens", text: "Primary, secondary, accent, canvas, container, text, and the related variants, plus the font family. Apply the built-in Maxicare BL token set." },
              { name: "Saved designs", text: "Emails and posters filed onto this book. Open loads them in Design Studio." },
              { text: "On an asset: preview it, download it, edit its usage directive, set its purpose, share it with every brand book, name a font family for a font file, and delete it." },
              { name: "Delete brand book", text: "Deletes the book and the assets that belong to it." },
            ],
          },
        ],
      },
      {
        id: "repository",
        title: "Design Repository",
        purpose: "Everything saved from Design Studio.",
        groups: [
          {
            title: "Find a design",
            items: [
              { name: "All designs / Emails / Posters", text: "Filter by kind. Counts sit on each filter." },
              { name: "Promotional / Educational / Seasonal", text: "Filter emails further by category. Posters stay visible only on All designs." },
              { name: "Email Designer / Poster Illustrator", text: "Shown when nothing is saved yet. Each jumps into that mode." },
            ],
          },
          {
            title: "A poster",
            items: [
              { text: "The card shows a thumbnail, the name, the size, the brand book, and the last update." },
              { name: "Add to brand book", text: "Check the books this poster should be filed under." },
              { name: "Open in Design Studio", text: "Continues editing." },
              { name: "Delete", text: "Removes the poster after you confirm." },
            ],
          },
          {
            title: "An email",
            items: [
              { text: "The card shows a scaled preview, the name, the category, the subject, the brand book, and the last update." },
              { name: "Add to brand book", text: "Check the books this email should be filed under." },
              { name: "Inspect", text: "Opens the saved HTML." },
              { name: "Open in Email Designer", text: "The mail icon on the card. Continues editing the MJML." },
              { name: "Delete", text: "Removes the email after you confirm." },
            ],
          },
          {
            title: "Inspect",
            items: [
              { name: "Live HTML Editor", text: "Edit the HTML, rename the blast, and change its category. Revert edits puts the HTML back. Update Saved Blast writes the change." },
              { name: "Save as .TXT / Download .HTML", text: "Downloads the current HTML." },
              { name: "Visual Render", text: "Shows the email. Print, or Render in a new tab." },
            ],
          },
        ],
      },
      {
        id: "first-session",
        title: "First session, in this order",
        purpose: "A full pass from an empty browser to a saved email and poster on a calendar day.",
        groups: [
          {
            items: [
              { name: "1", text: "Paste the three keys and save. Confirm the green dot and Ready." },
              { name: "2", text: "Import the Drive workspace with Replace." },
              { name: "3", text: "Check Idea Base (active notes) and Brand Books (the brand you will use)." },
              { name: "4", text: "Generate an idea and schedule it." },
              { name: "5", text: "Open that day in Idea Studio and finish the email and poster copy." },
              { name: "6", text: "Send each to Design Studio, generate, and save." },
              { name: "7", text: "Confirm both files in Design Repository and on that calendar day." },
            ],
          },
        ],
      },
    ],
  },
];
