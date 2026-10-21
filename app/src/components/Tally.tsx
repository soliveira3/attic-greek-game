import { Icon } from './Icon'

export function Tally({ right, total }: { right: number; total: number }) {
  return total ? (
    <p className="tally">
      <Icon name="check" size={18} />
      {right} of {total} right this session
    </p>
  ) : null
}
