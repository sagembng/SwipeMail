export type TagKind = "act" | "promo" | "urgent" | "fyi" | "plain";
export type Bucket = "today" | "earlier";

export interface Mail {
  id: string;
  /** Conversation id used to open the email in Gmail (real mail only). */
  threadId?: string;
  name: string;
  /** Sender email address. Used to find a profile picture or company logo. */
  address?: string;
  initials: string;
  color: string;
  time: string;
  /** Full sent time for the card header, for example "Today, 8:12 AM". */
  sentAt?: string;
  subject: string;
  summary: string;
  tags: { kind: TagKind; label: string }[];
  /** Details worth scanning for: a deadline, amounts. */
  facts?: { label: string; tone: "urgent" | "neutral" }[];
  body: string[];
  /** Sanitised HTML for the preview (real emails only). */
  html?: string;
  hiddenImages?: number;
  /** Only headers and a snippet are loaded; the full email is fetched when it is opened. */
  light?: boolean;
  bucket: Bucket;
}

/** Sample emails used until the Gmail API is wired in. */
export const MAILS: Mail[] = [
  {
    id: "m1",
    sentAt: "Today, 8:12 AM",
    address: "priya.nair@acme.example",
    name: "Priya Nair",
    initials: "PN",
    color: "#5b6cff",
    time: "8:12 AM",
    subject: "Q3 budget sign-off needed by Friday",
    summary:
      "Priya needs your approval on the revised Q3 marketing budget, up $12k for two events. Deadline is Friday at 5 PM.",
    tags: [
      { kind: "act", label: "Action needed" },
      { kind: "plain", label: "2 min read" },
    ],
    facts: [{ label: "Due Friday 5 PM", tone: "neutral" }, { label: "$12,000", tone: "neutral" }],
    body: [
      "Hi, attached is the revised Q3 marketing budget. The only change from last week is +$12,000 for the Austin and Lisbon events, offset by pausing paid social in September.",
      'Finance closes the quarter on Friday at 5 PM, so I need your sign-off before then. A reply with "approved" is enough.',
      "Thanks, Priya",
    ],
    bucket: "today",
  },
  {
    id: "m2",
    sentAt: "Today, 7:40 AM",
    address: "receipts@stripe.com",
    name: "Stripe",
    initials: "S",
    color: "#635bff",
    time: "7:40 AM",
    subject: "Your payout of $2,480.00 is on its way",
    summary: "A payout to the account ending 4417 has started. It is expected to arrive on Tuesday.",
    tags: [
      { kind: "fyi", label: "FYI" },
      { kind: "plain", label: "1 min read" },
    ],
    facts: [{ label: "$2,480.00", tone: "neutral" }, { label: "Arrives Tuesday", tone: "neutral" }],
    body: [
      "A payout of $2,480.00 was initiated to the bank account ending in 4417.",
      "It covers 38 payments from Oct 28 to Nov 3 and should arrive by Tuesday, Nov 11.",
      "You can view the payout report in your Stripe dashboard.",
    ],
    bucket: "today",
  },
  {
    id: "m3",
    sentAt: "Yesterday, 4:55 PM",
    address: "notifications@linear.app",
    name: "Linear",
    initials: "L",
    color: "#3a4560",
    time: "Yesterday",
    subject: "3 issues were assigned to you in Platform",
    summary: "SWP-212 login timeout, SWP-219 webhook retries and SWP-224 rate-limit headers. The first is marked urgent.",
    tags: [
      { kind: "urgent", label: "Urgent" },
      { kind: "act", label: "Action needed" },
    ],
    facts: [],
    body: [
      "SWP-212: Login times out after 30 seconds on slow networks (Urgent).",
      "SWP-219: Webhook retries do not back off.",
      "SWP-224: Add rate-limit headers to the public API.",
      "Assigned by Marco Reyes.",
    ],
    bucket: "today",
  },
  {
    id: "m4",
    sentAt: "Yesterday, 11:02 AM",
    address: "offers@northwind.example",
    name: "Northwind Outfitters",
    initials: "NW",
    color: "#e4572e",
    time: "Yesterday",
    subject: "Last chance: 40% off ends tonight",
    summary: "Seasonal sale on jackets and boots. The offer ends at midnight. Nothing for you to do.",
    tags: [{ kind: "promo", label: "Promo" }],
    facts: [{ label: "Ends Tonight", tone: "urgent" }],
    body: [
      "Our biggest winter sale ends tonight at midnight.",
      "Take 40% off jackets, boots and base layers with code LASTCALL.",
      "Unsubscribe any time.",
    ],
    bucket: "today",
  },
  {
    id: "m5",
    sentAt: "Mon, 9:30 AM",
    address: "dana.okafor@acme.example",
    name: "Dana Okafor",
    initials: "DO",
    color: "#0f8b8d",
    time: "Mon",
    subject: "Benefits enrollment closes Nov 15",
    summary:
      "Open enrollment ends in 7 days. If you do nothing, last year's plan carries over with a 6% premium increase.",
    tags: [{ kind: "act", label: "Action needed" }],
    facts: [{ label: "Ends Nov 15", tone: "neutral" }],
    body: [
      "Open enrollment closes on Saturday, Nov 15.",
      "If you make no changes, your current plan carries over, but premiums rise 6% in January.",
      "Review the options in the benefits portal. Questions are welcome in office hours on Thursday.",
      "Dana, People Ops",
    ],
    bucket: "today",
  },
  {
    id: "m6",
    sentAt: "Nov 3, 6:18 PM",
    address: "noreply@github.com",
    name: "GitHub",
    initials: "GH",
    color: "#24292f",
    time: "Nov 3",
    subject: "A new sign-in to your account from Chrome",
    summary: "Someone signed in from Chrome on Windows in Manila. If this was you, no action is needed.",
    tags: [{ kind: "fyi", label: "FYI" }],
    body: [
      "We noticed a new sign-in to your GitHub account.",
      "Device: Chrome on Windows. Location: Manila, Philippines.",
      "If this was you, you can ignore this email. If not, reset your password right away.",
    ],
    bucket: "earlier",
  },
  {
    id: "m7",
    sentAt: "Nov 2, 2:41 PM",
    address: "marco.reyes@acme.example",
    name: "Marco Reyes",
    initials: "MR",
    color: "#a23bd8",
    time: "Nov 2",
    subject: "Can we move Thursday's sync to 3 PM?",
    summary: "Marco has a clash and asks to shift the Thursday platform sync one hour later. Reply with yes or a new time.",
    tags: [{ kind: "act", label: "Action needed" }],
    facts: [{ label: "Due Thursday", tone: "neutral" }],
    body: [
      "Hey, I have a clash with the vendor call on Thursday.",
      "Could we move the platform sync to 3 PM instead of 2? Same room.",
      "Let me know, thanks.",
    ],
    bucket: "earlier",
  },
  {
    id: "m8",
    sentAt: "Nov 1, 8:00 AM",
    address: "notify@mail.notion.so",
    name: "Notion",
    initials: "N",
    color: "#333333",
    time: "Nov 1",
    subject: "Your weekly digest: 12 updates in 3 pages",
    summary: "Roadmap, Q4 OKRs and Onboarding checklist were edited by teammates this week.",
    tags: [{ kind: "fyi", label: "FYI" }],
    body: [
      "Here is what changed in your workspace this week.",
      "Roadmap: 5 edits. Q4 OKRs: 4 edits. Onboarding checklist: 3 edits.",
      "Open Notion to see the full change history.",
    ],
    bucket: "earlier",
  },
];
