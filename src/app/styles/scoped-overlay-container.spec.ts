import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ScopedOverlayContainer } from './scoped-overlay-container';
import { TI_SCOPE_CLASS } from './css-scope';

/**
 * CDK portals overlays to document.body, outside the root element carrying our scope class,
 * so without this the scope-rewritten menu/button styles never reach an open
 * `mat-menu` panel and its options fall back to Material's filled-button colors.
 */
describe('ScopedOverlayContainer', () => {
  let container: OverlayContainer;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: OverlayContainer, useClass: ScopedOverlayContainer }],
    });
    container = TestBed.inject(OverlayContainer);
  });

  afterEach(() => (container as OverlayContainer).ngOnDestroy());

  it('marks the overlay container with the scope class', () => {
    const element = container.getContainerElement();

    expect(element.classList.contains(TI_SCOPE_CLASS)).toBeTrue();
    expect(element.classList.contains('cdk-overlay-container')).toBeTrue();
  });

  it('lets scope-rewritten styles reach content portaled into the container', () => {
    const element = container.getContainerElement();

    const panel = document.createElement('div');
    panel.innerHTML =
      '<button class="mat-mdc-unelevated-button ti-dropdown-option-button"></button>';
    element.appendChild(panel);

    // The shape our rewritten selectors take; it must match inside the container.
    expect(
      element.querySelector('.ti-dropdown-option-button:where(.ti-scope, .ti-scope *)')
    ).not.toBeNull();
  });

  it('is idempotent across repeated lookups', () => {
    const first = container.getContainerElement();
    const second = container.getContainerElement();

    expect(second).toBe(first);
    expect(first.className.match(new RegExp(TI_SCOPE_CLASS, 'g'))?.length).toBe(1);
  });
});
