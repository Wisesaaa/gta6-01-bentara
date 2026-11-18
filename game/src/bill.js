// The damage bill: every prop you smash is itemised, and the total is really
// deducted from cash when a mission ends. settle() returns the amount paid.
export function createBill() {
  const lines = [];
  return {
    lines,
    add(label, amount) {
      const existing = lines.find((l) => l.label === label);
      if (existing) existing.amount += amount;
      else lines.push({ label, amount });
    },
    total() {
      let sum = 0;
      for (const l of lines) sum += l.amount;
      return sum;
    },
    // Pay the bill out of `cash`. Returns what was actually paid; clears the bill.
    settle(cash) {
      const due = this.total();
      const paid = Math.min(Math.max(0, cash), due);
      lines.length = 0;
      return paid;
    },
    clear() { lines.length = 0; },
  };
}
