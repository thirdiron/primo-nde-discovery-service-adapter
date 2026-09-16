import { TestBed } from '@angular/core/testing';
import { ɵSharedStylesHost as SharedStylesHost } from '@angular/platform-browser';
import { StackedButtonComponent } from './stacked-button.component';
import { NavigationService } from '../../../services/navigation.service';
import { ScopedStylesHost } from '../../../styles/scoped-styles-host';
import { TI_SCOPE_CLASS } from '../../../styles/css-scope';
import { StackLink } from 'src/app/types/primoViewModel.types';

/**
 * These render `mat-flat-button`s, which Material paints via
 * `.mat-mdc-unelevated-button:not(:disabled)` at specificity (0,2,0) — higher than the class
 * selectors in stacked-dropdown-overrides.scss, and injected after them.
 * These tests render against a Primo-shaped theme so that swap can't silently regress the colors.
 */
describe('StackedButtonComponent styling', () => {
  const PRIMO_PRIMARY = 'rgb(94, 66, 216)';
  const WHITE = 'rgb(255, 255, 255)';
  const TRANSPARENT = 'rgba(0, 0, 0, 0)';

  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StackedButtonComponent],
      providers: [
        { provide: SharedStylesHost, useClass: ScopedStylesHost },
        { provide: NavigationService, useValue: { openUrl: () => {} } },
      ],
    });

    // Primo's theme defines the Material filled-button tokens; our root component supplies the
    // scope class and --sys-primary.
    host = document.createElement('div');
    host.className = TI_SCOPE_CLASS;
    host.style.setProperty('--mdc-filled-button-container-color', PRIMO_PRIMARY);
    host.style.setProperty('--mdc-filled-button-label-text-color', WHITE);
    host.style.setProperty('--sys-primary', PRIMO_PRIMARY);
    document.body.appendChild(host);
  });

  afterEach(() => host.remove());

  function render(stackType: 'main' | 'dropdown', wrapper?: HTMLElement): HTMLButtonElement {
    const fixture = TestBed.createComponent(StackedButtonComponent);
    fixture.componentRef.setInput('link', {
      label: 'Download PDF',
      url: 'https://example.test',
      entityType: 'PDF',
    } as StackLink);
    fixture.componentRef.setInput('stackType', stackType);
    fixture.detectChanges();

    (wrapper ?? host).appendChild(fixture.nativeElement);
    fixture.detectChanges();

    return fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  }

  describe('main button', () => {
    it('renders primary-on-white inside a dropdown group', () => {
      const group = document.createElement('div');
      group.className = 'ti-dropdown-group';
      host.appendChild(group);

      const styles = getComputedStyle(render('main', group));

      expect(styles.backgroundColor).withContext('background should stay white').toBe(WHITE);
      expect(styles.color).withContext('label should stay primary').toBe(PRIMO_PRIMARY);
    });

    it('lays out its label through Material\u2019s internal wrapper', () => {
      const group = document.createElement('div');
      group.className = 'ti-dropdown-group';
      host.appendChild(group);

      const label = render('main', group).querySelector('.mdc-button__label') as HTMLElement;
      const styles = getComputedStyle(label);

      expect(styles.display).toBe('flex');
      expect(styles.columnGap).toBe('8px');
    });
  });

  describe('dropdown option button', () => {
    // Portaled into the CDK overlay container, so it is *not* inside .ti-dropdown-group and can't
    // inherit the tokens set there — it carries its own.
    it('renders primary on a transparent background', () => {
      const styles = getComputedStyle(render('dropdown'));

      expect(styles.backgroundColor).withContext('option rows are not filled').toBe(TRANSPARENT);
      expect(styles.color).withContext('label should be primary').toBe(PRIMO_PRIMARY);
    });

    it('is left-aligned rather than centred like a Material button', () => {
      const styles = getComputedStyle(render('dropdown'));

      expect(styles.justifyContent).toBe('flex-start');
      expect(styles.minHeight).toBe('48px');
    });
  });
});
