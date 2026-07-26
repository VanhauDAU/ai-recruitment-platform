import Image from '@tiptap/extension-image'

const WIDTHS = new Set(['25%', '50%', '75%', '100%'])
const ALIGNMENTS = new Set(['left', 'center', 'right'])

export const RichTextImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        parseHTML: (element) => {
          const value = element.getAttribute('data-width')
          return WIDTHS.has(value) ? value : '100%'
        },
        renderHTML: ({ width }) => ({ 'data-width': WIDTHS.has(width) ? width : '100%' }),
      },
      alignment: {
        default: 'center',
        parseHTML: (element) => {
          const value = element.getAttribute('data-align')
          return ALIGNMENTS.has(value) ? value : 'center'
        },
        renderHTML: ({ alignment }) => ({
          'data-align': ALIGNMENTS.has(alignment) ? alignment : 'center',
        }),
      },
    }
  },
})
