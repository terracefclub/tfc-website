# Hosted donations

The first donation increment uses Stripe Checkout through configured Payment Links. The site presents approved fund/frequency/recipient choices, then redirects to the exact hosted link. Stripe collects payment details and remains the source of truth for payments, receipts, recurring billing and reconciliation. No card fields, bank details, donor records, fake success page or payment-status inference exist in this application.

## Configure

Default: disabled; the established Terrace donation page remains available. Use deployment secrets/configuration or ignored local environment files, never user dotfiles. No Stripe API secret is needed for this handoff.

- `DONATIONS_MODE`: `disabled`, `test`, or `live`.
- `DONATION_CHECKOUTS_JSON`: an array of at most ten objects. Each has a unique `id` (lowercase letters/digits/hyphens, up to 40), `fund` (`financial-aid` or `club-support`), `frequency` (`once` or `monthly`), exact public `recipient` name, and a Stripe Payment Link `url`.
- Monthly options additionally require integer `monthlyAmountCents` in USD, between 100 and 1000000. This must match the configured recurring Stripe Price; the field describes the price, it does not change Stripe billing.
- One-time links use Stripe's customer-chosen amount. Monthly links use fixed recurring Prices: customer-chosen Payment Links do not support recurring donations.

Only `https://buy.stripe.com/<link>` is accepted; no credentials, custom ports, query parameters or fragments. Test mode requires `/test_` links, live mode rejects them. Malformed configuration disables the entire new checkout list. The handler ignores visitor-supplied amounts/destinations and only selects a configured ID. No donor information is attached to the URL. Both page and handoff bypass caches.

## Account and release gates

1. Connect the authorized receiving organization's Stripe account and verify its legal recipient, payout bank, currency and approved fund designations. Do not reuse a personal account by accident. Confirm donation wording; the site makes no tax-deductibility assertion.
2. Create test Payment Links in that account, one for each approved fund/frequency. Configure descriptions, fund metadata, required donor information and relevant custom fields. Legacy class year, dedication and employer-match fields still need field-by-field parity review; this increment does not claim to replace them.
3. Enable Stripe receipts and subscription management/cancellation, and verify them. Keep confirmation on Stripe. Do not redirect to a local page claiming payment succeeded.
4. Complete provider-sandbox checks for chosen amounts, monthly terms/cancellation, failed/abandoned payments, receipt delivery and reconciliation against Stripe reports. Verify every displayed amount, recipient and purpose matches its hosted destination.
5. Only then configure live links and explicit `DONATIONS_MODE=live`. Keep the old provider available for existing recurring gifts; no subscriptions migrate automatically.

Tests exercise validation and the real SvelteKit HTTP boundary with synthetic destinations; they do not prove a Stripe transaction, account ownership, receipts or payouts. Those require account access. No live charge is performed as a test.

If later work stores donation statuses, sends its own receipt, grants access or triggers fulfillment, it must first add signed webhook verification, durable duplicate-safe processing, delayed-payment/refund handling and reconciliation. This simple external handoff makes none of those local claims or side effects.

## Primary references (checked 2026-10-28)

- [Stripe Payment Links: pricing models and creation](https://docs.stripe.com/payment-links/create)
- [Customize hosted fields and branding](https://docs.stripe.com/payment-links/customize)
- [After a payment: confirmations and receipts](https://docs.stripe.com/payment-links/post-payment)
