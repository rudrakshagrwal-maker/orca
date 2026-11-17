import type { CommandHandler } from '../dispatch'
import { RuntimeClientError } from '../runtime-client'
import { writeStdoutLine } from '../stdout-line'
import {
  loadCanonicalGuides,
  requireTopic,
  type BundledSkillGuide,
  type BundledSkillGuideReference
} from './bundled-skill-guide-table'

type GuideSelection = { full: boolean; reference: string | null; listReferences: boolean }
// Accept references/<file>.md exactly as published in the kernel's gate table.
function normalizeReferenceSelector(value: string): string {
  return value
    .trim()
    .replace(/^references\//, '')
    .replace(/\.md$/, '')
}

function resolveSelection(flags: Map<string, string | boolean>): GuideSelection {
  const full = flags.has('full')
  const listReferences = flags.get('references') === true
  const requested = flags.get('reference')
  const hasReference = flags.has('reference')
  if (listReferences && full) {
    throw new RuntimeClientError('invalid_argument', 'Use either --references or --full, not both.')
  }
  if (listReferences && hasReference) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Use either --references or --reference, not both.'
    )
  }
  if (full && hasReference) {
    throw new RuntimeClientError('invalid_argument', 'Use either --full or --reference, not both.')
  }
  if (hasReference && (typeof requested !== 'string' || requested.trim().length === 0)) {
    throw new RuntimeClientError('invalid_argument', 'Missing required --reference')
  }
  return {
    full,
    reference: typeof requested === 'string' ? requested : null,
    listReferences
  }
}

function requireReferences(guide: BundledSkillGuide): readonly BundledSkillGuideReference[] {
  if (guide.references.length === 0) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Guide "${guide.name}" has no bundled references.`
    )
  }
  return guide.references
}

function requireReference(guide: BundledSkillGuide, requested: string): BundledSkillGuideReference {
  const selector = normalizeReferenceSelector(requested)
  const match = requireReferences(guide).find((reference) => reference.name === selector)
  if (!match) {
    const available = requireReferences(guide)
      .map((reference) => reference.name)
      .join(', ')
    throw new RuntimeClientError(
      'invalid_argument',
      `Unknown reference "${requested}" for ${guide.name}. Available: ${available}`
    )
  }
  return match
}

function composeFullGuide(
  markdown: string,
  references: readonly BundledSkillGuideReference[]
): string {
  if (references.length === 0) {
    return markdown
  }
  const header =
    '\n\n---\n\n# Bundled references\n\n' +
    'These references belong to the version-matched guide above. Read only the documents ' +
    'named by its action gates.\n'
  const documents = references
    .map(
      (reference) =>
        `\n<!-- bundled-reference: references/${reference.name}.md -->\n\n${reference.markdown.trimEnd()}\n`
    )
    .join('')
  return `${markdown.trimEnd()}${header}${documents}`
}

export const SKILL_GUIDE_GET_HANDLER: Record<string, CommandHandler> = {
  'skills get': async (ctx) => {
    const { flags, json } = ctx
    const selection = resolveSelection(flags)
    const guides = await loadCanonicalGuides()
    const guide = requireTopic(flags, guides)

    if (selection.listReferences) {
      const names = requireReferences(guide).map((reference) => reference.name)
      writeStdoutLine(
        json ? JSON.stringify({ name: guide.name, references: names }, null, 2) : names.join('\n')
      )
      return
    }

    if (selection.reference !== null) {
      const reference = requireReference(guide, selection.reference)
      writeStdoutLine(
        json
          ? JSON.stringify(
              { name: guide.name, reference: reference.name, markdown: reference.markdown },
              null,
              2
            )
          : reference.markdown
      )
      return
    }

    const markdown =
      selection.full && guide.references.length > 0
        ? composeFullGuide(guide.markdown, guide.references)
        : guide.markdown
    writeStdoutLine(
      json
        ? JSON.stringify({ name: guide.name, full: selection.full, markdown }, null, 2)
        : markdown
    )
  }
}
