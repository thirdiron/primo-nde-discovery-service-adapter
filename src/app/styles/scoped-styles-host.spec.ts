import { TestBed } from '@angular/core/testing';
import { ɵSharedStylesHost as SharedStylesHost } from '@angular/platform-browser';
import { BaseButtonComponent } from '../components/base-button/base-button.component';
import { ScopedStylesHost } from './scoped-styles-host';
import { TI_SCOPE_CLASS } from './css-scope';

/**
 * Guards against appending Angular Material's unscoped stylesheet to the host page's <head>
 * where it restyled Primo's own `.mat-mdc-button` elements. This asserts on what really lands in the DOM,
 * so it fails if a new Material module is imported without the scoping provider in place.
 */
describe('ScopedStylesHost', () => {
  // Markup copied from Primo's resource-type filter bar — the elements the customer saw change.
  const PRIMO_MARKUP = `
    <div class="resource-type-bar">
      <button class="resource-type-items mdc-button mat-mdc-button mat-unthemed mat-mdc-button-base">
        <span class="mat-mdc-button-persistent-ripple mdc-button__ripple"></span>
        <span class="mdc-button__label">Articles</span>
        <mat-icon class="mat-icon"></mat-icon>
      </button>
    </div>`;

  let stylesBefore: Set<HTMLStyleElement>;

  beforeEach(() => {
    stylesBefore = new Set(Array.from(document.head.querySelectorAll('style')));

    TestBed.configureTestingModule({
      imports: [BaseButtonComponent],
      providers: [{ provide: SharedStylesHost, useClass: ScopedStylesHost }],
    });
  });

  /** Style elements this spec's render added to the document head. */
  const newlyInjectedStyles = () =>
    Array.from(document.head.querySelectorAll('style')).filter(el => !stylesBefore.has(el));

  function renderButton() {
    const fixture = TestBed.createComponent(BaseButtonComponent);
    fixture.componentRef.setInput('ariaLabel', 'Download PDF');
    fixture.componentRef.setInput('buttonText', 'Download PDF');
    fixture.componentRef.setInput('color', 'sys-primary');
    fixture.componentRef.setInput('icon', 'pdf-download-icon');
    fixture.componentRef.setInput('url', 'https://example.test');
    fixture.detectChanges();
    return fixture;
  }

  it('injects stylesheets into the host page when a button renders', () => {
    renderButton();

    // Sanity check: if nothing is injected the assertions below would pass for the wrong reason.
    expect(newlyInjectedStyles().length).toBeGreaterThan(0);
  });

  it('injects nothing that matches Primo markup outside our components', () => {
    renderButton();

    const primo = document.createElement('div');
    primo.innerHTML = PRIMO_MARKUP;

    for (const styleEl of newlyInjectedStyles()) {
      for (const selector of selectorsOf(styleEl)) {
        expect(primo.querySelector(selector))
          .withContext(`injected selector "${selector}" reaches Primo's own markup`)
          .toBeNull();
      }
    }
  });

  it('still styles the same markup once it is inside our scope', () => {
    renderButton();

    const scoped = document.createElement('div');
    scoped.className = TI_SCOPE_CLASS;
    scoped.innerHTML = PRIMO_MARKUP;

    const matched = newlyInjectedStyles()
      .flatMap(selectorsOf)
      .filter(selector => scoped.querySelector(selector) !== null);

    expect(matched.length)
      .withContext('scoping removed the styles from our own components too')
      .toBeGreaterThan(0);
  });
});

function selectorsOf(styleEl: HTMLStyleElement): string[] {
  const selectors: string[] = [];
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) selectors.push(rule.selectorText);
      else if (rule instanceof CSSGroupingRule) walk(rule.cssRules);
    }
  };
  if (styleEl.sheet) walk(styleEl.sheet.cssRules);
  return selectors;
}
