# Solo Product Research: Etsy Orders → Laser/Cutter Batch Files

**Date:** 2026-10-02
**Goal:** A product one person can build and sell for $500+/month.

## The recommendation

**A small web app that turns Etsy personalization orders straight into ready-to-run laser and cutter files.**

Working name: **EngraveQueue**

The user connects an Etsy shop. Each morning the app pulls new orders and reads what buyers typed into the personalization box ("Sarah & Mike — est. 2019, font 3 please!!"). It cleans that text into structured fields. It then produces **one batch file** for the seller's machine:

| Machine / software | Output |
|---|---|
| LightBurn (most diode/CO2 lasers) | CSV made for LightBurn's Variable Text, or a `.lbrn2` project |
| xTool Creative Space | Spreadsheet in the format XCS batch mode imports |
| Glowforge | Laid-out SVG with text already converted to paths (Glowforge has no variable text) |
| Cricut Design Space | Laid-out SVG sheet of names (Design Space has no batch personalization either) |

It also prints a matching **production sheet and packing slip** (order #, position on the bed, buyer name), so each engraved piece reaches the right buyer.

## Why this is a real gap (the evidence)

1. **The volume is real.** xTool alone reported **405,000+ connected devices** as of Sept 2025, and it holds roughly 47% of the consumer laser market. Craft-fair guides now say every market has "at least three or four laser vendors." Personalized names are the bread-and-butter product.
2. **Etsy broke the do-it-yourself workaround.** In **July 2025 Etsy put a two-week delay on the Orders CSV export** with no announcement, and Etsy Support called it intentional. Sellers who printed packing slips or production lists from that CSV now work from data that's two weeks old. Only tools that use the Etsy API get same-day data. *(I couldn't confirm whether the delay is still in place in Oct 2026. Check this first.)*
3. **The machines' own software doesn't connect to orders:**
   - LightBurn has Variable Text from a CSV, but nothing fills that CSV from Etsy. Sellers copy and paste each name.
   - Glowforge has **no** variable text or batch personalization. The Glowforge owners' forum is full of free one-off generators (name puzzles, keychains, "Text2Vector"), so people want this, but each generator handles one item at a time.
   - Cricut Design Space has no batch personalization. Sellers retype names, or make them in Canva and import them.
4. **Etsy changed its personalization data in 2026.** Listings can now have several personalization questions, and the field labels are seller-defined. Any integration that assumed one "Personalization" field has to be reworked. A new tool starts on the new format, while older tools carry the legacy one.
5. **The closest competitor is built for a different buyer.** **Customily** has an Etsy personalizer that makes production files, priced at **$49/mo plus a per-item fee**. It's built mainly for print-on-demand and for live-preview product builders. Other tools in the space (Teeinblue, Printful's personalization) are also POD-first. ImagR helps laser sellers prepare *photos*, but it doesn't touch the order-to-name pipeline. I found nothing that is flat-priced, laser- and cutter-native, and handles Glowforge and Cricut.

**The wedge:** Customily handles every kind of personalization for POD shops. This tool does one job for a hobby laser or Cricut shop: it turns this morning's orders into one batch file. Flat price, no per-item fee.

## Why AI earns its place here (not a gimmick)

Buyers type messy free text: `"Name: JESSICA (all caps pls) Date 06.14.25"`, or names in the wrong field, or emoji and characters the font can't render. An LLM pass:
- splits the text into the template's fields (line 1, line 2, date, font choice)
- normalizes capitalization and dates to the seller's rules
- **flags anything ambiguous or impossible** (too long for the item, unsupported characters, two answers in one field) so the seller can message the buyer *before* wasting material

That flagging alone saves a seller ruined blanks, and it's the feature to put on the landing page.

## MVP scope (about 4–6 weekends)

1. Etsy OAuth with Personal App access (up to 5 shops). This covers beta users while the Commercial Access review runs.
2. Pull open receipts and their transactions, and read every personalization entry in `variations` (`property_id` 54, which can now appear more than once).
3. Per-listing template mapping: "this listing → this template, these fields."
4. LLM parse and validation, plus a review queue for flagged orders.
5. Exporters: LightBurn CSV (simplest, ship first), then Glowforge/Cricut SVG with text outlined via opentype.js, then xTool XCS.
6. Production sheet and packing slip PDFs with matching numbers.

**Stack:** Next.js or SvelteKit, Postgres, Stripe, opentype.js for text-to-path, and a small, cheap model for parsing. LLM cost is fractions of a cent per order.

**Fallback if Etsy API access is slow:** let users paste order text or upload Etsy's packing-slip PDF, and parse that with the LLM. It's slower for the user but has no API dependency.

## Pricing and the math to $500/mo

| Plan | Price | For |
|---|---|---|
| Hobby | $12/mo, up to 100 orders/mo | side-hustle shops |
| Shop | $24/mo, unlimited orders, multiple machines | full-time sellers |
| (Optional) Lifetime | $149 one-time, early-bird only | launch cash and testimonials |

**$500/mo ≈ 25 Shop customers or about 40 mixed customers.** That's a tiny share of the market. A seller doing 20 personalized orders a day saves 30–60 minutes a day, so even $24 is easy to justify.

## Go-to-market (where these sellers already gather)

- **Facebook groups:** "LightBurn Software Users," "xTool Creators," "Glowforge Owners," laser business groups (100k+ members each). Post a free tool, not an ad.
- **Free lead magnet:** a web page where you paste an Etsy order and get a LightBurn CSV or Glowforge SVG back, without an account. Glowforge forum users already share free generators like this.
- **YouTube:** laser channels (e.g. Laser Everything, Glowforge/xTool tutorial creators) need sponsors and "workflow" content. A 3-minute "20 orders in 2 minutes" demo is the whole pitch.
- **SEO:** "Etsy personalization to LightBurn," "Glowforge batch names," "Cricut multiple names at once," "Etsy CSV delay workaround."
- **Later:** add Shopify, which has an easier app review, to grow the market.

## Risks (honest list)

| Risk | Mitigation |
|---|---|
| Etsy Commercial Access review is manual and slow | Start on Personal App (5 shops) for beta; offer the paste/upload fallback; add Shopify. |
| Customily or xTool adds this natively | Stay laser- and Cricut-native and cheap. xTool would only support xTool, while sellers often own several machines. |
| Etsy's CSV delay is lifted | The pain stays: the CSV still doesn't produce laser files or catch bad text. |
| Hobby sellers resist subscriptions | Cheap Hobby tier and a lifetime deal at launch. |
| Etsy API changes | Keep the Etsy client thin and watch the developer changelog. |

## Validate before building (one weekend)

1. Post in two laser Facebook groups: *"How do you get Etsy personalization names into LightBurn/Glowforge right now? How long does it take you?"* Count replies that describe copying and pasting by hand.
2. Confirm the Etsy CSV delay still applies in 2026.
3. Ship the free paste-an-order converter page. If about 50 people use it in two weeks, build the paid version.

## Ideas I checked and rejected (and why)

| Idea | Why not |
|---|---|
| Cottage-food label generator | At least 8 tools already, many free (BatchBound, CottageFoodLabels, MyPorch…). |
| Knitting pattern grading tool | KnitGrader, PatternGrader and others are already free. |
| Microsoft Publisher replacement (retired Oct 2026) | Timely but crowded: Printicorn, PublishMedia, Univik, Markzware, Affinity free for charities. |
| Micro-bakery preorders (Castiron shut down) | Hotplate, Homegrown ($10), MyPorch, DoughPlan and others moved in quickly. |
| ADA Title II accessible PDFs for small towns | Real mandate (deadline moved to April 2028 for small entities), but crowded with agencies and enterprise vendors, and it's a slow government sale. |
| Whatnot seller profit tracking | Dozens of Etsy spreadsheet templates, plus Seller Ledger. |
| Vending route software | VendSoft, Vendera, VendingMetrics. |
| Small cemetery mapping | Chronicle and Atlas have free tiers. |
| CFI student tracking | Right Rudder, Instructeeze, Pilot Partner, wifiCFI. |
| Senior-living big-screen trivia (game option) | Plausible, but Quizado already targets it and selling to facilities is slow. Best "game" runner-up. |
| Foundry VTT premium modules | Real, but sample Patreons earn $17–32/mo. Too small. |

## Sources

- Etsy CSV two-week delay: [Value Added Resource](https://www.valueaddedresource.net/etsy-csv-2-week-delay/), [Craftybase](https://craftybase.com/blog/etsy-order-csv-delays), [Etsy Community thread](https://community.etsy.com/t5/Technical-Issues/CSV-are-now-2-weeks-delayed/td-p/148783715)
- Etsy personalization API changes: [Personalization Migration Guide](https://developers.etsy.com/documentation/tutorials/personalization-migration/), [Multiple question support](https://developer.etsy.com/documentation/tutorials/personalization/multiple-and-new-question-type-support)
- Etsy API access tiers: [Vorp Labs summary](https://vorplabs.com/agent-tools/etsy-api), [etsy/open-api discussion #1361](https://github.com/etsy/open-api/discussions/1361)
- xTool market size: [36Kr](https://eu.36kr.com/en/p/3637407225070601), [Makers101 IPO analysis](https://makers101.com/xtool-hong-kong-ipo-filing-analysis/)
- LightBurn Variable Text: [LightBurn docs](https://docs.lightburnsoftware.com/Tools/VariableText.html), [Busy Bee Laser tutorial](https://www.busybeelaser.com/post/batch-engraving-names-in-lightburn-with-variable-text-and-a-csv)
- Glowforge lacks batch personalization: [Clever Creations comparison](https://clevercreations.org/xtool-p2-vs-glowforge/), [Glowforge forum generators](https://community.glowforge.com/t/kids-name-puzzle-svg-generator/124901)
- xTool batch spreadsheet import: [xTool Support](https://support.xtool.com/article/1869)
- Competitors: [Customily Etsy Personalizer](https://www.customily.com/etsy-product-personalizer), [Teeinblue](https://teeinblue.com/blogs/en/how-to-create-a-custom-order-on-etsy), [ImagR](https://imag-r.com/)
- Laser vendor saturation at fairs: [The Craft Map](https://www.thecraftmap.com/blog/how-to-sell-laser-engraved-items-at-craft-fairs)
- Rejected-idea evidence: [Cottage food label tools](https://batchbound.com/), [KnitGrader](https://knitgrader.com/), [Publisher alternatives](https://univik.com/blog/microsoft-publisher-alternatives/), [Castiron/Hotplate alternatives](https://findhomegrown.com/blog/castiron-alternative-food-vendors), [ADA Title II deadline extension](https://titleii.org/deadlines), [Quizado/senior trivia](https://quizado.com/blog/tv-show-trivia-questions-and-answers), [Foundry Patreon examples](https://www.patreon.com/foundryworkshop/about)
