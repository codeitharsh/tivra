// A deliberately tiny, fixed inline-formatting parser for lesson
// paragraph text — bold/italic/inline-code/links only, no raw HTML ever
// accepted or passed through. This sidesteps the entire sanitization/XSS
// surface a real rich-text editor would need: the input is escaped FIRST,
// then only our own literal, hardcoded tag strings are ever introduced,
// so there's no path for user-supplied markup to reach the DOM.

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || url.startsWith('/')
}

export function renderInlineSafe(raw: string): string {
  let text = escapeHtml(raw)

  // Inline code first, so ** or * inside a code span isn't re-parsed.
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>')
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label: string, url: string) => {
    if (!isSafeUrl(url)) return label
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${label}</a>`
  })

  return text
}
