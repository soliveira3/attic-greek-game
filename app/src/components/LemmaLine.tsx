import { useApp } from '../app/AppContext'
import { GENDER_LABELS, type Lemma } from '../lib/features'
import { displayForm } from '../lib/normalize'

/** The word being drilled: headword, a noun's gender, and the gloss. */
export function LemmaLine({ lemma }: { lemma: Lemma }) {
  const { settings } = useApp()
  return (
    <p className="lemma-line">
      <span lang="grc" className="lemma">
        {displayForm(lemma.lemma, { lengthMarks: settings.lengthMarks })}
      </span>
      {lemma.pos === 'noun' && <span className="gender"> ({lemma.gender.map((g) => GENDER_LABELS[g][0]).join(' or ')})</span>}
      <span className="gloss"> — {lemma.gloss}</span>
    </p>
  )
}
