// The practice modes, as linked from the home page and the navigation.

export const MODES = [
  { page: 'parse', name: 'Parse it', text: 'Identify a form: its case, number and gender, or its tense, voice, mood, person and number.' },
  { page: 'fill', name: 'Fill the table', text: 'Complete a paradigm, or one tense and voice of a verb, with some cells left blank.' },
  { page: 'make', name: 'Make it', text: 'Type the form of a word that the features ask for.' },
  { page: 'sprint', name: 'Endings sprint', text: 'Sixty seconds of endings for one declension class or one tense and voice.' },
] as const
