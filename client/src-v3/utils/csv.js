// ─────────────────────────────────────────────────────────────────────────────
// SimchaKit — csv.js
// The one CSV cell escaper. Imports nothing, so exports.js and guests.js can
// both use it without a circular import.
//
// Formula-injection hardening (SK-A7): a value that starts with = + - @ tab or
// CR would run as a formula when the CSV is opened in Excel or Sheets, so it is
// prefixed with a single quote (the cell then shows as text). Plain numbers such
// as "-5.00" are left alone so negative amounts stay numeric. The quote-prefix
// runs BEFORE the comma/quote/newline quoting check.
// ─────────────────────────────────────────────────────────────────────────────

const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

export function csvEsc(val) {
  let s = String(val == null ? "" : val);
  if (/^[=+\-@\t\r]/.test(s) && !PLAIN_NUMBER.test(s)) s = "'" + s;
  return (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r"))
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}
