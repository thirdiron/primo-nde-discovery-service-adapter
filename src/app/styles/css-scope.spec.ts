import { TI_SCOPE_CLASS, scopeCss, scopeSelector } from './css-scope';

const SCOPE = `:where(.${TI_SCOPE_CLASS}, .${TI_SCOPE_CLASS} *)`;

describe('scopeSelector', () => {
  it('qualifies a simple selector', () => {
    expect(scopeSelector('.mat-mdc-button')).toBe(`.mat-mdc-button${SCOPE}`);
  });

  it('keeps the scope outside functional pseudo-classes', () => {
    expect(scopeSelector('.mat-mdc-button:not(:disabled)')).toBe(
      `.mat-mdc-button:not(:disabled)${SCOPE}`
    );
  });

  it('qualifies every selector in a list', () => {
    expect(scopeSelector('.a, .b:hover')).toBe(`.a${SCOPE}, .b:hover${SCOPE}`);
  });

  it('ignores commas nested in functional pseudo-classes and attribute values', () => {
    expect(scopeSelector('.a:is(.b, .c) .d[data-x="y, z"]')).toBe(
      `.a:is(.b, .c) .d[data-x="y, z"]${SCOPE}`
    );
  });

  // The whole point of scoping only the subject: `dir` lives on <html>, above our root element, so
  // prefixing the selector would silently break right-to-left layouts.
  it('leaves ancestor selectors untouched so above-scope conditions still apply', () => {
    expect(scopeSelector('[dir="rtl"] .mat-mdc-button > .mat-icon')).toBe(
      `[dir="rtl"] .mat-mdc-button > .mat-icon${SCOPE}`
    );
  });

  it('inserts the scope before a trailing pseudo-element', () => {
    expect(scopeSelector('.mat-mdc-button-persistent-ripple::before')).toBe(
      `.mat-mdc-button-persistent-ripple${SCOPE}::before`
    );
  });

  it('inserts the scope before a legacy single-colon pseudo-element', () => {
    expect(scopeSelector('.a:after')).toBe(`.a${SCOPE}:after`);
  });

  it('retargets document-root selectors at the scope root so custom properties survive', () => {
    expect(scopeSelector(':root')).toBe(`.${TI_SCOPE_CLASS}`);
    expect(scopeSelector('html')).toBe(`.${TI_SCOPE_CLASS}`);
  });

  it('is idempotent', () => {
    const once = scopeSelector('.mat-mdc-button');
    expect(scopeSelector(once)).toBe(once);
  });
});

describe('scopeCss', () => {
  it('scopes rules nested inside at-rules', () => {
    const scoped = scopeCss('@media (min-width: 100px) { .a { color: red; } }');

    expect(scoped).toContain(`.a${SCOPE}`);
    expect(scoped).toContain('@media');
  });

  it('does not touch keyframe offsets', () => {
    const scoped = scopeCss('@keyframes ti-shimmer { 0% { opacity: 0; } 100% { opacity: 1; } }');

    expect(scoped).not.toContain(TI_SCOPE_CLASS);
    expect(scoped).toContain('0%');
  });

  it('preserves declarations', () => {
    expect(scopeCss('.a { color: red; }')).toContain('color: red');
  });

  it('leaves no selector in Material-shaped CSS able to match Primo-shaped markup', () => {
    const scoped = scopeCss(`
      .mat-mdc-button-base { text-decoration: none; }
      .mat-mdc-button:not(:disabled) { color: var(--mdc-text-button-label-text-color); }
      mat-icon { height: 24px; }
      @media (prefers-reduced-motion: reduce) { .mat-mdc-button { transition: none; } }
    `);

    const primo = document.createElement('div');
    primo.innerHTML =
      '<button class="resource-type-items mdc-button mat-mdc-button mat-mdc-button-base"><mat-icon></mat-icon></button>';

    for (const selector of collectSelectors(scoped)) {
      expect(primo.querySelector(selector))
        .withContext(`"${selector}" matched markup outside our components`)
        .toBeNull();
    }
  });

  it('still matches the same markup inside the scope', () => {
    const scoped = scopeCss('.mat-mdc-button:not(:disabled) { color: red; }');

    const ours = document.createElement('div');
    ours.className = TI_SCOPE_CLASS;
    ours.innerHTML = '<button class="mat-mdc-button"></button>';

    for (const selector of collectSelectors(scoped)) {
      expect(ours.querySelector(selector)).not.toBeNull();
    }
  });
});

/** Flattens every style-rule selector in `css`, including those nested inside at-rules. */
function collectSelectors(css: string): string[] {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);

  const selectors: string[] = [];
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) selectors.push(rule.selectorText);
      else if (rule instanceof CSSGroupingRule) walk(rule.cssRules);
    }
  };
  walk(sheet.cssRules);

  expect(selectors.length).toBeGreaterThan(0);
  return selectors;
}
