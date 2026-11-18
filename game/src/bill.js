// The damage bill: every prop you smash is itemised, and the total is really
// deducted from cash when a mission ends. settle() returns the amount paid.
// A bill is a ledger, not a number: lines are grouped by label so the panel
// shows "Kios pasar ×3 — $120" instead of three identical rows.
export class Bill {
  constructor() {
    this.lines = [];
  }
  add(label, amount) {
    const existing = this.lines.find((l) => l.label === label);
    if (existing) {
      existing.amount += amount;
      existing.count += 1;
    } else {
      this.lines.push({ label, amount, count: 1 });
    }
    return this;
  }
  total() {
    return this.lines.reduce((sum, l) => sum + l.amount, 0);
  }
  itemCount() {
    return this.lines.reduce((n, l) => n + l.count, 0);
  }
  // Pay the bill out of `cash`. Returns what was actually paid; clears the bill.
  settle(cash) {
    const due = this.total();
    const paid = Math.min(Math.max(0, cash), due);
    this.clear();
    return paid;
  }
  clear() {
    this.lines.length = 0;
    return this;
  }
  toJSON() {
    return this.lines.map((l) => ({ label: l.label, amount: l.amount, count: l.count }));
  }
}

export function createBill() {
  return new Bill();
}
