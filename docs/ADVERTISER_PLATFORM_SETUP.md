# NearShop External Advertiser Platform V1

## What is included

- Self-service advertiser registration from Profile → **Advertise on NearShop**.
- Admin-assisted advertiser account creation for an existing NearShop user from Admin → Advertisers.
- Admin review of advertiser accounts.
- Advertiser dashboard and brand profile.
- Campaign drafts with image/video creative uploads, headline/body, HTTPS destination URL and optional WhatsApp contact.
- Placements: Feed, Deals, Banner/Strip and Full-screen Popup.
- Audience targeting: all users, city, state or business category.
- Campaign schedule and prepaid budget.
- CPM / CPC billing using server-enforced rates. Defaults: ₹100 per 1,000 views or ₹3 per click; Admin can edit both under Admin → Pricing → External Brand Advertising. Each new campaign snapshots the current rate.
- Wallet balance, payment-reference top-up requests, admin verification and ledger.
- Campaign approval before delivery, view/click tracking, advertiser reports.
- Budget stops campaign delivery when exhausted; unused budget is returned on rejection/pause or can be claimed after expiry/end.
- WhatsApp share link/message for the advertiser's campaign.

## Installation

1. Apply all missing migrations in `DATABASE_MIGRATION_ORDER.md`. Do not rerun migrations already applied.
2. The new migration is `supabase/migrations/20261128_external_advertiser_platform.sql`.
3. Commit the frontend files and let Vercel deploy.
4. In the signed-in app, open **Profile → Advertise on NearShop**.
5. Register an advertiser account.
6. In the separate Admin login, open **Advertisers**:
   - Approve the advertiser.
   - Verify the top-up payment reference before crediting the wallet.
   - Review and approve each campaign before it can go live.

## Payment and wallet behavior

V1 does not collect money through an automated UPI/payment gateway. The advertiser makes a payment outside NearShop and submits its UTR/reference. Admin manually verifies the payment and credits the advertiser wallet. This avoids pretending a payment was collected when it was not.

When a campaign is submitted, its full budget is reserved from the wallet. CPM campaigns deduct ₹100 per 1,000 counted views (₹0.10 per view); CPC campaigns deduct ₹3 per counted click. When remaining budget reaches zero, the campaign is automatically marked expired and no longer delivered. If a campaign is rejected or paused, its unused reserved amount is automatically returned to wallet. When a campaign ends/expires, the advertiser can claim the remaining amount from the dashboard.

## Delivery placements

- Feed: Sponsored card in the Feed campaign area.
- Deals: Existing Deals ad slot.
- Banner: Discover/Deals top strip ad slot.
- Popup: Existing interstitial ad slot.

Campaigns are not delivered until both advertiser account and campaign are approved, campaign dates are active, and the budget is paid/reserved.

## Security notes

- Advertiser account/campaign writes use security-definer RPCs; users cannot set their own approved/live/payment status directly.
- Advertiser data is scoped to the logged-in NearShop user.
- Admin review functions use the existing `nearshop_admin_ok` password verification.
- Creative uploads are limited to the signed-in Supabase Auth UID folder.
- Public creative reads are required so approved ads can display to app users.
- Never add Supabase service-role keys or Firebase service-account JSON to the frontend or GitHub.

## Not included yet

- Automated UPI / Razorpay / Cashfree checkout and payment webhooks.
- 
- GST invoices, advertiser tax/KYC workflows and refund payout to bank (unused amount returns to NearShop wallet).
- Automated WhatsApp Business API message sending. The current share action opens WhatsApp with a prefilled message.
- Advanced geo-fencing, frequency caps, A/B testing and bot/fraud filtering.

## Test checklist

- Register advertiser account and verify it appears in Admin → Advertisers.
- Approve advertiser.
- Submit top-up request and verify it remains pending until admin approves it.
- Confirm wallet balance changes only after admin verification.
- Create a campaign with image/video, select a placement and target, save draft.
- Submit campaign with sufficient wallet balance; verify budget reservation.
- Confirm campaign remains invisible before admin approval.
- Approve campaign; verify it appears in selected placements during active dates.
- Check impressions/clicks and CPM/CPC spend in advertiser dashboard.
- Exhaust a small budget in a test campaign and confirm status becomes expired.
- Reject/pause a campaign and verify unused reserved budget returns to wallet.
- Test advertiser account with a second user and confirm it cannot read or modify the first advertiser's campaigns.
