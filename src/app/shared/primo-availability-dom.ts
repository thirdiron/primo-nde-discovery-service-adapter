import { Injectable } from '@angular/core';

/**
 * DOM helper for coordinating with the host Primo (NDE) online-availability UI.
 *
 * The ThirdIron buttons component is inserted in the DOM *before* the host `nde-online-availability` element
 * (via `nde-online-availability-before`). When we enhance a record we need to hide that native
 * element (so we don't show duplicate buttons), and when we don't enhance we must leave it alone /
 * restore it. This controller owns all of that DOM plumbing so the component can stay focused on
 * the enhancement/rendering logic.
 *
 * Aside from the `@Injectable()` decorator it has no Angular/RxJS dependencies, and it keeps its
 * only piece of state (a MutationObserver) internal — which makes it straightforward to unit test
 * in isolation. It is provided at the *component* level (not root) so each buttons component gets
 * its own instance and therefore its own observer.
 */
@Injectable()
export class PrimoAvailabilityDomController {
  static readonly ONLINE_AVAILABILITY_TAG = 'nde-online-availability';

  // CSS class used to hide the native availability element. Marked `!important` in the ThirdIron
  // buttons component stylesheet so Primo's own inline / bound `display` styles can't override us.
  // NOTE: the same literal is referenced in third-iron-buttons.component.scss.
  static readonly HIDDEN_CLASS = 'ti-online-availability-hidden';

  private observer: MutationObserver | null = null;

  /**
   * Hide the native `nde-online-availability` element(s). Walks up the DOM from `hostElement` until
   * it finds an ancestor that contains the element, then hides all matches. Returns how many were
   * hidden (0 if not found — e.g. Primo hasn't rendered it yet; use observeAvailability for that).
   * Depth of 12 is arbitrary but a reasonable ceiling.
   */
  hideAvailability = (hostElement: HTMLElement | null): number => {
    let current: HTMLElement | null = hostElement ?? null;
    for (let depth = 0; current && depth < 12; depth++) {
      const elems = current.getElementsByTagName(
        PrimoAvailabilityDomController.ONLINE_AVAILABILITY_TAG
      ) as HTMLCollectionOf<HTMLElement>;
      if (elems.length > 0) {
        const arr = Array.from(elems);
        for (const elem of arr) {
          this.hideElement(elem);
        }
        return arr.length;
      }
      current = current.parentElement;
    }
    return 0;
  };

  /**
   * Restore any `nde-online-availability` element(s) we previously hid, back to their original
   * inline display value. Only touches elements we marked, and cleans up our dataset flags.
   */
  restoreAvailability = (hostElement: HTMLElement | null): number => {
    let current: HTMLElement | null = hostElement ?? null;
    for (let depth = 0; current && depth < 12; depth++) {
      const elems = current.getElementsByTagName(
        PrimoAvailabilityDomController.ONLINE_AVAILABILITY_TAG
      ) as HTMLCollectionOf<HTMLElement>;
      if (elems.length > 0) {
        const arr = Array.from(elems);
        let restored = 0;
        for (const elem of arr) {
          if (elem.dataset['tiOnlineAvailabilityHiddenByThirdIron'] !== '1') continue;
          const prevDisplay = elem.dataset['tiOnlineAvailabilityPrevDisplay'];
          elem.classList.remove(PrimoAvailabilityDomController.HIDDEN_CLASS);
          elem.style.display = prevDisplay ?? '';
          delete elem.dataset['tiOnlineAvailabilityHiddenByThirdIron'];
          delete elem.dataset['tiOnlineAvailabilityPrevDisplay'];
          restored++;
        }
        return restored;
      }
      current = current.parentElement;
    }
    return 0;
  };

  /**
   * Watch the surrounding container so the native availability element stays hidden even if Primo
   * renders (or re-renders) it *after* our initial one-shot hide — the common race, since we're
   * injected before it. Safe to call repeatedly; resets any previous observer.
   *
   * @param shouldKeepHiding optional guard; when it returns false the observer stops re-hiding
   *        (belt-and-suspenders — callers should still `disconnect()` before restoring).
   */
  observeAvailability = (
    hostElement: HTMLElement | null,
    shouldKeepHiding?: () => boolean
  ): void => {
    this.disconnect();
    if (typeof MutationObserver === 'undefined') return;

    const root = this.getObserverRoot(hostElement);
    if (!root) return;

    // Hide anything already present, then watch for future additions / re-renders.
    this.hideWithin(root);

    this.observer = new MutationObserver(() => {
      if (shouldKeepHiding && !shouldKeepHiding()) return;
      this.hideWithin(root);
    });
    this.observer.observe(root, { childList: true, subtree: true });
  };

  disconnect = (): void => {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  };

  isObserving = (): boolean => this.observer !== null;

  /**
   * The host renders this component via `*ngComponentOutlet`, wrapping our element in an
   * `<ng-component>` that is a flex item of the host's `.responsive-availability-layout` container.
   * When we render nothing, that empty wrapper still triggers the container's `gap`, leaving a blank
   * space to the left of the Primo button. Hiding our own element doesn't help (the flex item is the
   * wrapper), so we hide the wrapper instead, marking it so restoreWrapper only undoes our change.
   */
  hideWrapper = (hostElement: HTMLElement | null): boolean => {
    const wrapper = this.findWrapper(hostElement);
    if (!wrapper) return false;
    if (wrapper.dataset['tiWrapperPrevDisplay'] === undefined) {
      wrapper.dataset['tiWrapperPrevDisplay'] = wrapper.style.display ?? '';
    }
    wrapper.dataset['tiWrapperHiddenByThirdIron'] = '1';
    wrapper.style.display = 'none';
    return true;
  };

  // Restore the wrapping `<ng-component>`'s display if (and only if) we previously hid it.
  restoreWrapper = (hostElement: HTMLElement | null): boolean => {
    const wrapper = this.findWrapper(hostElement);
    if (!wrapper) return false;
    if (wrapper.dataset['tiWrapperHiddenByThirdIron'] !== '1') return false;
    const prevDisplay = wrapper.dataset['tiWrapperPrevDisplay'];
    wrapper.style.display = prevDisplay ?? '';
    delete wrapper.dataset['tiWrapperHiddenByThirdIron'];
    delete wrapper.dataset['tiWrapperPrevDisplay'];
    return true;
  };

  // Hide a single element via a CSS class (with `!important`) plus an inline style, remembering the
  // previous inline display value so restoreAvailability() can put it back exactly.
  private hideElement(elem: HTMLElement): void {
    if (elem.dataset['tiOnlineAvailabilityPrevDisplay'] === undefined) {
      elem.dataset['tiOnlineAvailabilityPrevDisplay'] = elem.style.display ?? '';
    }
    elem.dataset['tiOnlineAvailabilityHiddenByThirdIron'] = '1';
    elem.classList.add(PrimoAvailabilityDomController.HIDDEN_CLASS);
    elem.style.display = 'none';
  }

  // Pick the container to watch. The native element is a sibling of our wrapping `<ng-component>`,
  // so that wrapper's parent is the natural (tightly scoped) root. Falls back to the nearest
  // ancestor already containing the element, then to our own parent.
  private getObserverRoot(hostElement: HTMLElement | null): HTMLElement | null {
    const wrapperParent = this.findWrapper(hostElement)?.parentElement ?? null;
    if (wrapperParent) return wrapperParent;

    let current: HTMLElement | null = hostElement?.parentElement ?? null;
    for (let depth = 0; current && depth < 12; depth++) {
      if (
        current.getElementsByTagName(PrimoAvailabilityDomController.ONLINE_AVAILABILITY_TAG)
          .length > 0
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return hostElement?.parentElement ?? null;
  }

  // Hide every `nde-online-availability` element currently within `root` (idempotent).
  private hideWithin(root: HTMLElement): number {
    const elems = Array.from(
      root.getElementsByTagName(PrimoAvailabilityDomController.ONLINE_AVAILABILITY_TAG)
    ) as HTMLElement[];
    for (const elem of elems) {
      this.hideElement(elem);
    }
    return elems.length;
  }

  // Walk up a small fixed number of levels looking for the `<ng-component>` wrapper. Depth is
  // normally 1, but we allow a few hops in case a future host inserts an extra wrapper.
  private findWrapper(hostElement: HTMLElement | null): HTMLElement | null {
    let current: HTMLElement | null = hostElement?.parentElement ?? null;
    for (let depth = 0; current && depth < 4; depth++) {
      if (current.tagName.toLowerCase() === 'ng-component') return current;
      current = current.parentElement;
    }
    return null;
  }
}
