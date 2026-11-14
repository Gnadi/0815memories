/* Markdown for recipe instructions: parsed into the rich document format that
   RichContent renders, never into HTML, and written back out when a recipe's
   editor is switched from rich text to Markdown. */
import { describe, it, expect } from 'vitest'
import { markdownToRich, richToMarkdown } from '../utils/markdown'
import { richToPlainText } from '../utils/richText'

const text = (value, marks) => (marks ? { type: 'text', text: value, marks } : { type: 'text', text: value })
const para = (...content) => ({ type: 'paragraph', content })

describe('markdownToRich', () => {
  it('reads headings, emphasis and links', () => {
    const doc = markdownToRich('# Dough\n\nKnead **firmly**, _gently_ or ~~not~~ with `care`, see [here](https://example.com).')
    expect(doc.content[0]).toEqual({ type: 'heading', attrs: { level: 2 }, content: [text('Dough')] })
    expect(doc.content[1]).toEqual(para(
      text('Knead '),
      text('firmly', [{ type: 'bold' }]),
      text(', '),
      text('gently', [{ type: 'italic' }]),
      text(' or '),
      text('not', [{ type: 'strike' }]),
      text(' with '),
      text('care', [{ type: 'code' }]),
      text(', see '),
      text('here', [{ type: 'link', attrs: { href: 'https://example.com' } }]),
      text('.'),
    ))
  })

  it('nests marks', () => {
    expect(markdownToRich('**very _hot_**').content[0]).toEqual(para(
      text('very ', [{ type: 'bold' }]),
      text('hot', [{ type: 'bold' }, { type: 'italic' }]),
    ))
  })

  it('reads numbered steps from where they start, and nested lists', () => {
    const [list] = markdownToRich('3. Mix\n4. Bake\n   - 180 °C').content
    expect(list.type).toBe('orderedList')
    expect(list.attrs.start).toBe(3)
    expect(list.content[0]).toEqual({ type: 'listItem', content: [para(text('Mix'))] })
    expect(list.content[1].content[1]).toEqual({
      type: 'bulletList',
      content: [{ type: 'listItem', content: [para(text('180 °C'))] }],
    })
  })

  it('keeps a task\'s checkbox as a character', () => {
    const [list] = markdownToRich('- [x] Preheat\n- [ ] Serve').content
    expect(richToPlainText({ type: 'doc', content: [list] })).toBe('☑ Preheat\n\n☐ Serve')
  })

  it('takes a single newline as a line break', () => {
    expect(markdownToRich('Peel\nSlice').content[0]).toEqual(para(text('Peel'), { type: 'hardBreak' }, text('Slice')))
  })

  it('reads quotes, code and rules', () => {
    const doc = markdownToRich('> Grandma says\n\n```\n200 g flour\n```\n\n---')
    expect(doc.content.map((n) => n.type)).toEqual(['blockquote', 'codeBlock', 'horizontalRule'])
    expect(doc.content[1].content).toEqual([text('200 g flour')])
  })

  it('shows raw HTML as text, and an image as its alt text only', () => {
    const doc = markdownToRich('<img src=x onerror=alert(1)>\n\nA ![photo of the pie](https://tracker.example/p.png) <b>b</b>')
    const flat = richToPlainText(doc)
    expect(flat).toContain('<img src=x onerror=alert(1)>')
    expect(flat).toContain('photo of the pie')
    expect(flat).toContain('<b>b</b>')
    expect(JSON.stringify(doc)).not.toContain('tracker.example')
  })

  it('reads a table one row per line', () => {
    expect(richToPlainText(markdownToRich('| a | b |\n|---|---|\n| 1 | 2 |'))).toBe('a · b\n\n1 · 2')
  })

  it('gives an empty document for nothing', () => {
    expect(markdownToRich('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
    expect(markdownToRich(undefined)).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
  })
})

describe('richToMarkdown', () => {
  it('writes what the editor makes', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [text('Dough')] },
        para(text('Knead '), text('firmly ', [{ type: 'bold' }]), text('then rest.')),
        { type: 'orderedList', attrs: { start: 1 }, content: [
          { type: 'listItem', content: [para(text('Mix'))] },
          { type: 'listItem', content: [para(text('Bake')), { type: 'bulletList', content: [
            { type: 'listItem', content: [para(text('180 °C'))] },
          ] }] },
        ] },
        { type: 'blockquote', content: [para(text('Never rush it'))] },
        para(text('link', [{ type: 'link', attrs: { href: 'https://example.com/a b' } }])),
      ],
    }
    expect(richToMarkdown(doc)).toBe(
      '## Dough\n\nKnead **firmly** then rest.\n\n1. Mix\n2. Bake\n   - 180 °C\n\n> Never rush it\n\n[link](https://example.com/a%20b)',
    )
  })

  it('escapes what would otherwise turn into Markdown', () => {
    const doc = { type: 'doc', content: [para(text('# not a heading')), para(text('2. not a step')), para(text('5 * 3 = 15_000'))] }
    const markdown = richToMarkdown(doc)
    expect(markdownToRich(markdown).content).toEqual(doc.content)
  })

  it('comes back as the same document', () => {
    const markdown = '## Filling\n\n- Peel the **apples**\n- _optional:_ raisins\n\n1. Fill\n2. Bake'
    const doc = markdownToRich(markdown)
    expect(markdownToRich(richToMarkdown(doc))).toEqual(doc)
  })

  it('gives nothing for something that is not a document', () => {
    expect(richToMarkdown('ciphertext')).toBe('')
  })
})
