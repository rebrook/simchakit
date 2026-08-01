// Vendor and budget utilities — financials, due dates, and currency formatting

import { hasPayments, isFullyPaid, totalAmount, amountPaid } from "./expensePayments.js";

// For an expense with a payment schedule, find the earliest due date among
// its not-yet-paid installments. Returns null if there's nothing scheduled
// with a due date (mirrors the legacy "no dueDate means not surfaced" rule).
function nextInstallmentDueDate(expense) {
  const unpaid = (expense.payments || []).filter(p => p.status !== "paid" && p.dueDate);
  if (!unpaid.length) return null;
  return unpaid.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0].dueDate;
}

function getDueStatus(expense) {
  if (isFullyPaid(expense)) return null;
  const dueDate = hasPayments(expense) ? nextInstallmentDueDate(expense) : expense.dueDate;
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0,0,0,0);
  const due = new Date(dueDate + "T00:00:00");
  const diff = Math.ceil((due - today) / (1000*60*60*24));
  if (diff < 0)  return { label: "Overdue", cls: "expense-row-overdue", diff };
  if (diff <= 14) return { label: `Due in ${diff}d`, cls: "expense-row-due", diff };
  return { label: `Due ${new Date(dueDate+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`, cls: "expense-row-due", diff };
}

function getNextDue(expenses) {
  const candidates = [];
  (expenses || []).forEach(e => {
    if (isFullyPaid(e)) return;
    if (hasPayments(e)) {
      (e.payments || []).forEach(p => {
        if (p.status !== "paid" && p.dueDate) {
          candidates.push({ description: `${e.description} — ${p.label}`, amount: p.amount, dueDate: p.dueDate });
        }
      });
    } else if (e.dueDate) {
      candidates.push({ description: e.description, amount: e.amount, dueDate: e.dueDate });
    }
  });
  if (!candidates.length) return null;
  return candidates.sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
}

function computeVendorFinancials(vendor, expenses) {
  const linked = (expenses||[]).filter(e => e.vendorId === vendor.id);
  const totalPaid       = linked.reduce((s,e) => s + amountPaid(e), 0);
  const totalScheduled  = linked.reduce((s,e) => s + (totalAmount(e) - amountPaid(e)), 0);
  const contractAmt     = parseFloat(vendor.contractAmt) || 0;
  const totalLinked     = totalPaid + totalScheduled;
  const unscheduled     = Math.max(0, contractAmt - totalLinked);
  const paidPct         = contractAmt > 0 ? Math.min(100, (totalPaid / contractAmt) * 100) : 0;
  return { totalPaid, totalScheduled, contractAmt, unscheduled, paidPct, linkedCount: linked.length };
}

function getLastContacted(vendor) {
  const log = vendor.contactLog || [];
  if (log.length === 0) return { date: null, daysAgo: null };
  const sorted = [...log].sort((a,b) => (b.date||"").localeCompare(a.date||""));
  const latest = sorted[0].date || null;
  if (!latest) return { date: null, daysAgo: null };
  const diff = Math.floor((Date.now() - new Date(latest+"T00:00:00").getTime()) / (1000*60*60*24));
  return { date: latest, daysAgo: diff };
}

function fmt$(n) {
  return "$" + (parseFloat(n)||0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export {
  getDueStatus,
  getNextDue,
  computeVendorFinancials,
  getLastContacted,
  fmt$,
};
