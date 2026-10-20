export function Tally({ right, total }: { right: number; total: number }) {
  return total ? (
    <p className="tally muted">
      {right} of {total} right this session
    </p>
  ) : null
}
