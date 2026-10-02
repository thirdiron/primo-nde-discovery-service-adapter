/**
 * Rewrites CSS so it can only match inside our own components.
 *
 * Angular Material declares its components with `ViewEncapsulation.None`, so instantiating a
 * `MatButton` makes Angular append Material's raw, unscoped stylesheet to the *host* page's
 * `document.head` (`SharedStylesHost` always keeps `doc.head` registered as a style host). Primo NDE
 * is itself an Angular Material app, so our copy of selectors like `.mat-mdc-button` lands later in
 * the cascade at equal specificity and wins on Primo's own buttons. Worse, our Material version
 * falls back to `--mat-app-*` design tokens that a newer Primo theme never defines, so those
 * declarations resolve to invalid values and the affected properties silently reset.
 *
 * See `ScopedStylesHost`, which runs every stylesheet through `scopeCss` before insertion.
 */

/** Applied to our root custom elements and to any overlay panel CDK portals out of them. */
export const TI_SCOPE_CLASS = 'ti-scope';

/**
 * Appended to the *subject* of every selector. `:where()` contributes no specificity, so existing
 * overrides keep working against the un-scoped weights they were written for.
 */
const SCOPE_SUFFIX = `:where(.${TI_SCOPE_CLASS}, .${TI_SCOPE_CLASS} *)`;

/** Pseudo-elements that predate the `::` syntax; the scope has to go before them, not after. */
const LEGACY_PSEUDO_ELEMENT = /^:(before|after|first-line|first-letter)\b/i;

/**
 * Selectors that can only ever match above our subtree. Retargeting them at the scope root keeps
 * custom-property declarations (`:root { --foo: ... }`) alive instead of dropping them.
 */
const DOCUMENT_ROOT_SELECTOR = /^(:root|html|body)$/i;

const scopedCssCache = new Map<string, string>();

/**
 * Splits a selector list on top-level commas, ignoring commas nested in `()`, `[]` or strings
 * (`:is(a, b)`, `[data-x="y, z"]`).
 */
function splitSelectorList(selectorText: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';

  for (let i = 0; i < selectorText.length; i++) {
    const char = selectorText[i];

    if (quote) {
      current += char;
      if (char === quote && selectorText[i - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    else if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);

  return parts;
}

/**
 * Index at which the rightmost compound selector — the element the rule actually styles — begins.
 *
 * Only that compound gets scoped. Prefixing the whole selector instead would break every rule that
 * depends on an ancestor above us: `[dir="rtl"] .mat-mdc-button` would become
 * `.ti-scope [dir="rtl"] .mat-mdc-button`, which never matches because `dir` lives on `<html>`.
 */
function subjectStart(complexSelector: string): number {
  let depth = 0;
  let quote: string | null = null;
  let start = 0;

  for (let i = 0; i < complexSelector.length; i++) {
    const char = complexSelector[i];

    if (quote) {
      if (char === quote && complexSelector[i - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    else if (depth === 0 && (char === ' ' || char === '>' || char === '+' || char === '~')) {
      start = i + 1;
    }
  }

  return start;
}

/** Index of the trailing pseudo-element within a compound selector, or its length if there is none. */
function pseudoElementStart(compoundSelector: string): number {
  let depth = 0;
  let quote: string | null = null;

  for (let i = 0; i < compoundSelector.length; i++) {
    const char = compoundSelector[i];

    if (quote) {
      if (char === quote && compoundSelector[i - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    else if (depth === 0 && char === ':') {
      if (compoundSelector[i + 1] === ':') return i;
      if (LEGACY_PSEUDO_ELEMENT.test(compoundSelector.slice(i))) return i;
    }
  }

  return compoundSelector.length;
}

/** Qualifies every selector in a selector list so it can only match inside `.ti-scope`. */
export function scopeSelector(selectorText: string): string {
  return splitSelectorList(selectorText)
    .map(part => {
      const selector = part.trim();
      if (!selector) return selector;
      if (selector.includes(SCOPE_SUFFIX)) return selector;
      if (DOCUMENT_ROOT_SELECTOR.test(selector)) return `.${TI_SCOPE_CLASS}`;

      const start = subjectStart(selector);
      const ancestors = selector.slice(0, start);
      const subject = selector.slice(start);
      const pseudoAt = pseudoElementStart(subject);

      return ancestors + subject.slice(0, pseudoAt) + SCOPE_SUFFIX + subject.slice(pseudoAt);
    })
    .filter(Boolean)
    .join(', ');
}

function scopeRules(rules: CSSRuleList): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      // Nested rules resolve against the (now scoped) parent selector, so don't recurse into them.
      rule.selectorText = scopeSelector(rule.selectorText);
    } else if (!(rule instanceof CSSKeyframesRule) && 'cssRules' in rule) {
      // `@media` / `@supports` / `@container` / `@layer` wrap style rules that still need scoping.
      // `@keyframes` children are keyframe offsets, not selectors.
      scopeRules((rule as CSSGroupingRule).cssRules);
    }
  }
}

/**
 * Returns `css` with every selector qualified by `.ti-scope`. Parsing goes through a constructable
 * stylesheet so nothing is ever attached to the document in un-scoped form.
 */
export function scopeCss(css: string): string {
  const cached = scopedCssCache.get(css);
  if (cached !== undefined) return cached;

  let scoped: string;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    scopeRules(sheet.cssRules);
    scoped = Array.from(sheet.cssRules)
      .map(rule => rule.cssText)
      .join('\n');
  } catch {
    // Better to ship the un-scoped styles than to render unstyled buttons.
    scoped = css;
  }

  scopedCssCache.set(css, scoped);
  return scoped;
}
