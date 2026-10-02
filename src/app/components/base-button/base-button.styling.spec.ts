import { TestBed } from '@angular/core/testing';
import { ɵSharedStylesHost as SharedStylesHost } from '@angular/platform-browser';
import { BaseButtonComponent } from './base-button.component';
import { ScopedStylesHost } from '../../styles/scoped-styles-host';
import { TI_SCOPE_CLASS } from '../../styles/css-scope';

/**
 * This is a `mat-flat-button`, so Material paints it with
 * `.mat-mdc-unelevated-button:not(:disabled)` at specificity (0,2,0) — identical to our own
 * `.ti-custom-button[_ngcontent-xxx]`, and injected afterwards, so Material wins any tie. When the
 * host page defines `--mdc-filled-button-container-color` (Primo does), that regressed the button
 * to a primary fill with white text. These tests render against a Primo-shaped theme and assert the
 * button keeps its own colors.
 */
describe('BaseButtonComponent styling', () => {
  const PRIMO_PRIMARY = 'rgb(94, 66, 216)';
  const WHITE = 'rgb(255, 255, 255)';

  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BaseButtonComponent],
      providers: [{ provide: SharedStylesHost, useClass: ScopedStylesHost }],
    });

    // Stand in for the host page: Primo's theme defines the Material filled-button tokens, and our
    // root component supplies the scope class plus --sys-primary.
    host = document.createElement('div');
    host.className = TI_SCOPE_CLASS;
    host.style.setProperty('--mdc-filled-button-container-color', PRIMO_PRIMARY);
    host.style.setProperty('--mdc-filled-button-label-text-color', WHITE);
    host.style.setProperty('--sys-primary', PRIMO_PRIMARY);
    document.body.appendChild(host);
  });

  afterEach(() => host.remove());

  function renderButton(): HTMLButtonElement {
    const fixture = TestBed.createComponent(BaseButtonComponent);
    fixture.componentRef.setInput('ariaLabel', 'Download PDF');
    fixture.componentRef.setInput('buttonText', 'Download PDF');
    fixture.componentRef.setInput('color', 'sys-primary');
    fixture.componentRef.setInput('icon', 'pdf-download-icon');
    fixture.componentRef.setInput('url', 'https://example.test');
    fixture.detectChanges();

    host.appendChild(fixture.nativeElement);
    fixture.detectChanges();

    return fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  }

  it('renders primary-on-white, not the Material inverted filled-button colors', () => {
    const button = renderButton();
    const styles = getComputedStyle(button);

    expect(styles.backgroundColor).withContext('background should stay white').toBe(WHITE);
    expect(styles.color).withContext('label should stay primary').toBe(PRIMO_PRIMARY);
  });

  it('keeps its own sizing against the Material filled-button rules', () => {
    const styles = getComputedStyle(renderButton());

    expect(styles.height).toBe('32px');
    expect(styles.borderTopColor).toBe(PRIMO_PRIMARY);
  });

  it('confines its Material token overrides to its own button', () => {
    renderButton();

    // A Primo-shaped filled button placed inside our scope root — the most demanding case, since
    // anything leaking would reach it. The tokens are declared on `.ti-custom-button` and custom
    // properties only inherit downwards, so this button must keep Material's own colors.
    const primoButton = document.createElement('button');
    primoButton.className = 'mdc-button mdc-button--unelevated mat-mdc-unelevated-button';
    host.appendChild(primoButton);

    const styles = getComputedStyle(primoButton);

    expect(styles.backgroundColor)
      .withContext('Primo keeps its filled background')
      .toBe(PRIMO_PRIMARY);
    expect(styles.color).withContext('Primo keeps its filled label color').toBe(WHITE);
  });
});
