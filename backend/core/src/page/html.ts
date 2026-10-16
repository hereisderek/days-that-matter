// Pure typed HTML template literal and escaping without external dependencies.

export class HtmlString {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
  toString(): string {
    return this.value;
  }
}

export function raw(value: unknown): HtmlString {
  return new HtmlString(String(value ?? ''));
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): HtmlString {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += formatHtmlValue(values[i]);
    }
  }
  return new HtmlString(result);
}

function formatHtmlValue(val: unknown): string {
  if (val === null || val === undefined || typeof val === 'boolean') {
    return '';
  }
  if (val instanceof HtmlString) {
    return val.value;
  }
  if (Array.isArray(val)) {
    return val.map(formatHtmlValue).join('');
  }
  return escapeHtml(String(val));
}

/** JSON for a `<script type="application/json">` block. Escapes characters that could end the block. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
