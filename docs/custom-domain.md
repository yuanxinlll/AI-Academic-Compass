# Custom domain and hackathon submission

## Public addresses

- Primary public link: [https://aiacademiccompass.us](https://aiacademiccompass.us)
- Also available: [https://www.aiacademiccompass.us](https://www.aiacademiccompass.us)
- Existing Vercel origin: `https://ai-academic-compass.vercel.app`

The team registered **one domain**, `aiacademiccompass.us`, during the hackathon
on November 15, 2026. `www.aiacademiccompass.us` is a subdomain of that registration,
not another registered domain. Both addresses were verified to serve the existing
Academic Compass application over HTTPS; no redirect between them is claimed.

## Registry, registrar, DNS, and hosting

| Role | Provider / evidence |
| --- | --- |
| Registered domain | `aiacademiccompass.us` |
| Registrar | Porkbun |
| DNS provider | Porkbun's default DNS service |
| Registry reference | Porkbun includes `.us` in its [GoDaddy Registry offering](https://porkbun.com/land/godaddy-domain-sale); [IANA lists Registry Services, LLC as the `.us` manager](https://www.iana.org/domains/root/db/us.html) |
| Application hosting | Existing Next.js project on Vercel |

We registered the domain **through Porkbun**, not through GoDaddy's retail
registration site. This is a custom-domain setup, not an integration with a
GoDaddy API or GoDaddy web hosting. The sponsor reference does not assert prize
eligibility; the organizers' rules determine that.

## DNS configuration

The main website's Vercel project has both complete names attached, including
the initial **ai**. Do not substitute `academiccompass.us`, which is a different
domain. Do not attach the website domain to the `academic-compass-ai` Python
service project.

Records configured in Porkbun, using the values supplied by the main website's
Vercel project owner:

| Type | Porkbun Host | Answer | TTL |
| --- | --- | --- | --- |
| A | Leave blank (root) | `216.198.79.1` | 600 |
| A | Leave blank (root) | `64.29.17.1` | 600 |
| CNAME | `www` | `b07fba7dc8cab899.vercel-dns-017.com` | 600 |

Both A records are intentional. Porkbun's blank Host represents the root domain.
The default root ALIAS and wildcard CNAME pointing to `pixie.porkbun.com` were
replaced with the website records. No MX records were changed.

The existing authoritative nameservers were retained:

```text
curitiba.ns.porkbun.com
fortaleza.ns.porkbun.com
maceio.ns.porkbun.com
salvador.ns.porkbun.com
```

These DNS targets document the verified setup, not universal Vercel defaults.
For a future project move, obtain that project's current required DNS values
before changing the records.

## Verification

Completed on November 15, 2026:

- Porkbun displayed exactly the two root A records and the `www` CNAME above.
- External DNS queries returned both configured A values and the configured CNAME.
- Both HTTPS addresses opened Academic Compass without a certificate warning.
- The root-domain homepage loaded the live opportunity data and category counts.

To repeat the public DNS checks:

```bash
dig +short aiacademiccompass.us A
dig +short www.aiacademiccompass.us CNAME
```

Then open both HTTPS addresses and check that the homepage and opportunity list
load. A documentation update does not itself change DNS or the Vercel domain
binding. Never commit credentials, session cookies, or registrar API keys.

## Hackathon form answer

Question: **List all of the domain names your team has registered with GoDaddy
Registry during this hackathon.**

Answer:

> aiacademiccompass.us — registered during the hackathon through Porkbun and
> connected to our Vercel-hosted Academic Compass application:
> https://aiacademiccompass.us

List only the registered root domain. Do not count `www.aiacademiccompass.us` or
the Vercel-provided subdomains as additional registrations.
