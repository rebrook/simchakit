// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit V3 — utils/expensePayments.js
// Pure helpers for optional per-expense installment payment schedules.
// V3 only, by explicit decision — V2 BudgetTab does not get this feature.
//
// expense.amount always remains the TOTAL contract amount, unchanged in meaning.
// expense.payments is optional; its absence or an empty array means "single
// payment," which is today's existing behavior. Nothing here requires a
// migration of existing rows — every helper falls back to the legacy
// expense.amount / expense.paid fields when payments is missing or empty.
// ─────────────────────────────────────────────────────────────────────────────

export function hasPayments(expense) {
  return Array.isArray(expense?.payments) && expense.payments.length > 0;
}

// The expense's contract total. Always expense.amount, regardless of whether
// a payment schedule exists or how much of it has been entered so far.
// payments is a schedule of how this fixed total gets paid over time, not a
// substitute for it — a partially-built schedule must never make the
// contract total appear smaller than it really is.
export function totalAmount(expense) {
  return parseFloat(expense?.amount) || 0;
}

export function amountPaid(expense) {
  if (hasPayments(expense)) {
    return expense.payments
      .filter(p => p.status === "paid")
      .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  }
  return expense?.paid ? (parseFloat(expense?.amount) || 0) : 0;
}

export function amountRemaining(expense) {
  return totalAmount(expense) - amountPaid(expense);
}

// "Fully paid" means the contract balance is actually zero — not merely that
// every installment currently on the schedule happens to be marked paid.
// An incomplete schedule (e.g. only a deposit entered and paid, with the
// balance not yet scheduled) must not show as fully paid.
export function isFullyPaid(expense) {
  if (hasPayments(expense)) {
    return amountRemaining(expense) <= 0.005;
  }
  return !!expense?.paid;
}

// Derives "overdue" at render time from dueDate + status. Never stored.
export function getPaymentStatus(payment) {
  if (payment?.status === "paid") return "paid";
  const due = payment?.dueDate;
  if (due) {
    const today = new Date().toISOString().slice(0, 10);
    if (due < today) return "overdue";
  }
  return "scheduled";
}

// Sum of scheduled payment amounts vs. the expense's contract total.
// Positive = payments total is under the contract amount; negative = over.
// Returns null when there are no payments to compare (nothing to warn about).
export function paymentMismatch(expense) {
  if (!hasPayments(expense)) return null;
  const contractTotal = parseFloat(expense?.amount) || 0;
  const paymentsTotal = expense.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const diff = contractTotal - paymentsTotal;
  if (Math.abs(diff) < 0.005) return null; // effectively equal, no warning
  return { contractTotal, paymentsTotal, diff };
}

export function newPaymentId() {
  return "pmt_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
