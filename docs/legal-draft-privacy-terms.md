# DRAFT: privacy policy and terms updates

**Status: applied to `client/public/about/privacy.html` and `terms.html` on 2026-11-03 (effective date November 3, 2026), once deployed. The owner chose not to have a lawyer review it. This is not legal advice.** The live pages are now the source of truth; this file is the working record of why each line is there. If the product changes how guest data, email, payments or retention work, update the pages and this file together.

Items in **[OWNER DECISION]** need an answer only the owner can give. Items in **[VERIFY]** are facts I could not confirm from the code. Everything else is based on what the code does today (V5.14.0). Keep the existing plain tone, and update the "Effective date" when published.

---

## Privacy policy (full replacement text)

### What we collect

We collect the information you give us to run your account and plan your event:

- Your account email address and display name.
- The event data you enter, such as budgets, vendors, tasks, seating and schedules.
- The guest details you enter, such as names, addresses, email addresses, RSVPs and dietary needs.
- Payment details are handled by our payment provider; we receive confirmation of a purchase, not your card number.

If you send guests an RSVP link, we also collect what each guest chooses to submit on that page: their reply for each event, meal and dietary choices, an address, a note, and the names of any extra guests they add. A reply does not change your plan until you review and accept it.

We also receive basic technical information when anyone uses the app or an RSVP link, such as IP address and device and browser details, which our hosting and analytics providers use to deliver the service, keep it secure and understand performance.

### Who processes it

Your data is never sold or used for advertising. We share it only with the service providers needed to run SimchaKit:

- **Supabase** hosts the database and handles sign-in. Your account, event and guest data are stored there.
- **Vercel** hosts the app and the RSVP pages, and provides usage and performance analytics.
- **Brevo** delivers email and keeps our contact list for notifications. It receives the email addresses we send to, including account and collaborator invitations and, when you use the Guests tab, the emails you send to your guests.
- **Stripe** processes payments for purchases. It receives your payment details and email.
- **Google (Gmail)** delivers our internal alerts, such as a notice when a new account is created or the app crashes.
- **Hebcal** supplies Hebrew dates, Torah portions and Shabbat times. To look them up, your browser sends Hebcal your event date and, for Shabbat times, the ZIP code of the venue. Hebcal also sees your device's IP address, as any website would. No names or guest details are sent.

When the app crashes, we record technical details (the error, the page you were on, your account id and email, and the event) in our database and email an alert to us, so we can fix the problem. We do not use a separate error-reporting service.

### Guest emails and RSVP links

If you email guests or send RSVP links, you are the sender and SimchaKit delivers the message for you. Every guest email includes an unsubscribe link. A guest who unsubscribes is skipped on future sends for that event. An RSVP link is private to a household, is not listed in search engines, and can be replaced by you at any time, which stops the old link from working.

### How long we keep it

We keep your account and event data while your account is active so you can keep planning and look back at your event afterwards. Archived events are kept and become read-only until you ask us to delete them. We keep a record of your purchase for accounting and tax purposes even after you delete your data.

### How to export or delete your data

You can export your guest list from the Guests tab (Export Guests), your seating chart from the Seating tab (Export Seating), and a full backup from Admin Mode at any time. To have your account and data deleted, email hello@simcha-kit.com. **[OWNER DECISION]** Add how quickly you will respond, if you want to commit to one. Guests who want their details removed or corrected should contact the event organizer who invited them, or email hello@simcha-kit.com.

### Your role as the event organizer

You enter your guests' details, so you are responsible for having a reason to hold that information and for using it only to plan your event, including any email you send them. We process guest details on your behalf and only to provide the app.

### Contact

Questions about this policy: hello@simcha-kit.com.

---

## Terms of service (additions)

Keep the existing Fee, Acceptable use, Your data is yours and No warranty sections. Add or change:

### Acceptable use (replace the current text)

Use SimchaKit to plan your own events and those you are organizing with permission. Do not use it to break the law, to send spam or unwanted messages, to enter information you have no right to hold, or to interfere with the service or other users' accounts.

### Emailing guests (new)

When you email your guests through SimchaKit, you are responsible for the content, for sending only to people you have a reason to contact about your event, and for honoring their requests to stop. We may limit how many messages you can send, and we may suspend sending if it is misused.

### Collaborators (new)

You can invite co-planners to your event. You are responsible for who you invite, and they can see and, depending on their role, change the event's information, including guest details.

### Payment and refunds (new)

The fee is charged once per event through our payment provider. If you are not satisfied, email hello@simcha-kit.com within 30 days of purchase for a full refund, no questions asked. After 30 days, we will consider a refund if there is a problem we cannot fix. We do not refund after the event date. **Do not add a sentence about losing access after a refund yet.** The admin console's refund only marks the purchase "refunded" in the database. It does not send money back through Stripe (do that in the Stripe dashboard) and it does not lock or archive the event, so the family keeps access today. Either leave the policy silent on access, or build the lock first.

### Your data is yours (add one sentence)

Add: "If your account is deleted, we remove your event and guest data as described in the Privacy Policy."

---

## Questions for the owner before this goes live

Decided (2026-11-03): data is kept while the account is active, archived events stay read-only, deletion is on request, and purchase records are kept for accounting. There is no automatic deletion, so do not add wording that promises it unless it is built. Refunds: full refund within 30 days of purchase, discretionary after that, none after the event date.

Still open:
Resolved from the code (2026-11-03): error reporting is built in, with no third-party service. It saves crash details (including account email) to the database and emails them to the owner through Gmail. Hebcal is called from the user's browser with the event date and the venue ZIP (for Shabbat times), plus the visitor's IP. The privacy text above reflects both.

Still open:
1. Do you want refunds to lock the event? Today they do not (see the refund note above).
2. Should a lawyer review it? The app handles guests' names, addresses and emails, so I'd suggest yes, especially if you expect customers outside the US.
