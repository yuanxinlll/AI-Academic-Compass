// Read-aloud script for one listing (ElevenLabs voices it). Built by fixed rules from the stored
// listing, never written by AI, so what a student hears is exactly what the page shows.
// Pure: used by the API route and by the browser to show "What you'll hear".

type Fact = { value: string; quote: string | null } | undefined;
export type SpeakableListing = {
  title: string;
  organization: string | null;
  deadline: string | null;
  deadline_text: string | null;
  application_method: string | null;
  status: string;
  eligibility: { raw_text: string; is_hard_requirement: boolean }[];
  access?: Partial<Record<"international" | "first_gen" | "transfer" | "compensation" | "cost", Fact>> | null;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function spokenDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function clean(s: string) {
  return s
    .replace(/https?:\/\/\S+/g, "the link on the page")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;:,]*$/, ".");
}

export const MAX_SPEECH_CHARS = 1500;

export function speechScript(o: SpeakableListing): string {
  const parts: string[] = [];
  parts.push(clean(o.organization ? `${o.title}, from ${o.organization}` : o.title));

  if (o.deadline) parts.push(`The deadline is ${spokenDate(o.deadline)}.`);
  else if (o.deadline_text) parts.push(`About the deadline, the page says: ${clean(o.deadline_text)}`);
  else parts.push("The page does not give a deadline.");

  const a = o.access ?? {};
  const who: string[] = [];
  if (a.first_gen?.value === "focus") who.push("It is made for first-generation students.");
  if (a.transfer?.value === "focus") who.push("It is made for transfer students.");
  if (a.international?.value === "open") who.push("The page says international students can apply.");
  else if (a.international?.value === "restricted") who.push("The page says you need U.S. citizenship, permanent residency or work authorization.");
  else who.push("The page does not say whether international students can apply, so ask before you apply.");
  if (a.compensation?.value === "paid") who.push("It is paid.");
  if (a.compensation?.value === "stipend") who.push("It comes with a stipend.");
  if (a.compensation?.value === "credit") who.push("You can earn course credit.");
  if (a.compensation?.value === "unpaid") who.push("It is unpaid.");
  if (a.cost?.value === "fee") who.push("There is a fee.");
  parts.push(...who);

  const reqs = o.eligibility ?? [];
  if (reqs.length) {
    const hard = reqs.filter((r) => r.is_hard_requirement).slice(0, 5);
    const soft = reqs.filter((r) => !r.is_hard_requirement).slice(0, 2);
    if (hard.length) parts.push(`Requirements, in the page's own words: ${hard.map((r) => clean(r.raw_text)).join(" ")}`);
    if (soft.length) parts.push(`Preferred: ${soft.map((r) => clean(r.raw_text)).join(" ")}`);
  } else {
    parts.push("No specific requirements were found on the page.");
  }

  if (o.application_method) parts.push(`How to apply: ${clean(o.application_method)}`);
  parts.push(
    o.status === "verified"
      ? "A person has checked this listing against its source."
      : "Nobody has checked this listing by hand yet, so confirm the details on the source page.",
  );

  let text = parts.join(" ");
  if (text.length > MAX_SPEECH_CHARS) text = `${text.slice(0, MAX_SPEECH_CHARS - 40).replace(/\s+\S*$/, "")}. The rest is on the page.`;
  return text;
}
