import {
  HOST_ELEMENT_OVERRIDES_CSS,
  HOST_ELEMENT_OVERRIDES_STYLE_ID,
  ONLINE_AVAILABILITY_HIDDEN_CLASS,
  installHostElementOverrides,
} from './host-element-overrides';
import { PrimoAvailabilityDomController } from '../shared/primo-availability-dom';

/**
 * These rules used to ship in a `custom.css` bundle, which Primo only loads from a view
 * customization package — a channel our add-on's own deployment doesn't use, so the rule never
 * reached the page. They now ride in the remote bundle; these tests pin that down.
 */
describe('host element overrides', () => {
  function installed(): HTMLElement[] {
    return Array.from(document.querySelectorAll(`#${HOST_ELEMENT_OVERRIDES_STYLE_ID}`));
  }

  afterEach(() => {
    installed().forEach(el => el.remove());
    document.querySelectorAll('nde-online-availability').forEach(el => el.remove());
  });

  it('injects the stylesheet into the document head', () => {
    installHostElementOverrides();

    expect(installed().length).toBe(1);
    expect(installed()[0].parentElement).toBe(document.head);
  });

  it('installs once no matter how many components bootstrap', () => {
    installHostElementOverrides();
    installHostElementOverrides();
    installHostElementOverrides();

    expect(installed().length).toBe(1);
  });

  it('hides Primo\u2019s availability element even against an inline display', () => {
    installHostElementOverrides();

    // Stand in for Primo's own markup: it binds `display` and writes it inline, which outranks any
    // ordinary declaration of ours — hence the `!important`.
    const availability = document.createElement('nde-online-availability');
    availability.style.display = 'block';
    availability.classList.add(ONLINE_AVAILABILITY_HIDDEN_CLASS);
    document.body.appendChild(availability);

    expect(getComputedStyle(availability).display).toBe('none');
  });

  it('leaves untagged availability elements alone', () => {
    installHostElementOverrides();

    const availability = document.createElement('nde-online-availability');
    availability.style.display = 'block';
    document.body.appendChild(availability);

    expect(getComputedStyle(availability).display).toBe('block');
  });

  it('is the single source of the class the controller applies', () => {
    expect(PrimoAvailabilityDomController.HIDDEN_CLASS).toBe(ONLINE_AVAILABILITY_HIDDEN_CLASS);
  });

  it('scopes the selector to our own marker class, not bare Primo markup', () => {
    // Guards the invariant in the file's header comment: these rules are unscoped, so every
    // selector must be qualified by a class only our code applies.
    const selectors = HOST_ELEMENT_OVERRIDES_CSS.match(/^[^{@\s][^{]*(?=\{)/gm) ?? [];

    expect(selectors.length).toBeGreaterThan(0);
    selectors.forEach(selector => expect(selector).toContain('.ti-'));
  });
});
