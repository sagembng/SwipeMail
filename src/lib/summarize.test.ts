import { strict as assert } from "node:assert";
import { test } from "node:test";
import { classify, cleanParagraphs, extractFacts, summarize } from "./summarize.ts";

const priya = [
  "Hi Alex,",
  "I hope you had a good weekend. Attached is the revised Q3 marketing budget. The only change from last week is +$12,000 for the Austin and Lisbon events, offset by pausing paid social in September.",
  'Finance closes the quarter on Friday at 5 PM, so I need your sign-off by Friday 5 PM. A reply with "approved" is enough.',
  "Thanks,",
  "Priya Nair",
  "Head of Marketing | Acme Inc.",
];

test("cleanParagraphs drops greeting, sign-off and signature", () => {
  const out = cleanParagraphs(priya);
  assert.equal(out.length, 2);
  assert.ok(!out.some((p) => /^Hi Alex/.test(p)));
  assert.ok(!out.some((p) => /Head of Marketing/.test(p)));
});

test("summary leads with the ask and the deadline, not the pleasantries", () => {
  const s = summarize(priya, "Q3 budget sign-off needed by Friday", "");
  assert.match(s, /sign-off/i);
  assert.ok(!/weekend/i.test(s), s);
});

test("newsletter footers are ignored", () => {
  const s = summarize(
    [
      "This week: three ways teams cut meeting time in half, and a new template for weekly updates.",
      "You are receiving this email because you subscribed. Unsubscribe | Manage preferences | © 2026 Acme Inc. All rights reserved.",
    ],
    "The Weekly Brief",
    "",
  );
  assert.match(s, /meeting time/);
  assert.ok(!/unsubscribe|rights reserved/i.test(s), s);
});

test("a sentence that only repeats the subject is not chosen over real content", () => {
  const s = summarize(
    ["Your payout of $2,480.00 is on its way.", "It covers 38 payments from Oct 28 to Nov 3 and should arrive by Tuesday, Nov 11."],
    "Your payout of $2,480.00 is on its way",
    "",
  );
  assert.match(s, /38 payments/);
});

test("falls back to the Gmail snippet when there is no body", () => {
  assert.equal(summarize([], "Hello", "Short snippet text"), "Short snippet text");
});

test("summaries stay short", () => {
  const long = Array.from({ length: 12 }, (_, i) => `Sentence number ${i} talks about the project plan in some detail here.`).join(" ");
  assert.ok(summarize([long], "Plan", "").length <= 240);
});

test("extractFacts finds a deadline and amounts", () => {
  const facts = extractFacts("I need your sign-off by Friday 5 PM. The budget is +$12,000, up from $8,000.");
  assert.deepEqual(
    facts.map((f) => f.label),
    ["Due Friday 5 PM", "$12,000", "$8,000"],
  );
});

test("a deadline today or tomorrow is flagged urgent", () => {
  assert.equal(extractFacts("Please reply by tomorrow.")[0].tone, "urgent");
  assert.equal(extractFacts("Please reply by next Friday.")[0].tone, "neutral");
  assert.equal(extractFacts("The sale ends tonight at midnight.")[0].label, "Ends Tonight");
});

test("extractFacts finds month-day deadlines", () => {
  assert.equal(extractFacts("Open enrollment closes Nov 15.")[0].label, "Ends Nov 15");
});

const base = { labels: [], address: "someone@example.com", hasUnsubscribe: false, wordCount: 120 };

test("classify: security alerts", () => {
  const t = classify({ ...base, address: "no-reply@accounts.example.com", subject: "Security alert", text: "A new sign-in to your account." });
  assert.equal(t[0].label, "Security");
  assert.equal(t[0].kind, "urgent");
});

test("classify: promos by Gmail category and by wording", () => {
  assert.equal(classify({ ...base, labels: ["CATEGORY_PROMOTIONS"], subject: "Hi", text: "x" })[0].kind, "promo");
  assert.equal(classify({ ...base, hasUnsubscribe: true, subject: "40% off ends tonight", text: "Shop the sale" })[0].kind, "promo");
});

test("classify: receipts, codes and meetings", () => {
  assert.equal(classify({ ...base, address: "receipts@stripe.com", subject: "Your payout", text: "A payout was sent. Statement attached." })[0].label, "Receipt");
  assert.equal(classify({ ...base, subject: "Your sign in", text: "Your verification code is 482913" })[0].label, "Code");
  assert.equal(classify({ ...base, subject: "Invitation: Weekly sync", text: "Marco invited you" })[0].label, "Meeting");
});

test("classify: personal emails with a request need action; urgent adds both tags", () => {
  assert.equal(classify({ ...base, subject: "Quick question", text: "Can you review the draft?" })[0].label, "Action needed");
  const u = classify({ ...base, subject: "URGENT: server down", text: "Please fix this ASAP" });
  assert.deepEqual(u.slice(0, 2).map((t) => t.label), ["Urgent", "Action needed"]);
});

test("classify: automated updates are FYI, not action", () => {
  const t = classify({ ...base, address: "notifications@github.com", labels: ["CATEGORY_UPDATES"], subject: "Build passed", text: "Your workflow run finished." });
  assert.equal(t[0].kind, "fyi");
});

test("every email gets a read-time tag", () => {
  assert.equal(classify({ ...base, wordCount: 650, subject: "x", text: "y" }).at(-1)?.label, "3 min read");
});
