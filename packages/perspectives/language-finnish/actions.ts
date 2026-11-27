// language-finnish: see perspective.md
import { turning } from '../lib/facets.js'

export default turning('language', (setting) => ({
  setting: { ...setting, code: 'fi' },
  variant: 'suomi',
}))
