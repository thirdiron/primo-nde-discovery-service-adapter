import { PrimoAvailabilityDomController } from './primo-availability-dom';

const TAG = PrimoAvailabilityDomController.ONLINE_AVAILABILITY_TAG;
const HIDDEN_CLASS = PrimoAvailabilityDomController.HIDDEN_CLASS;

// Let any pending MutationObserver callbacks flush.
const flushMutations = () => new Promise(resolve => setTimeout(resolve, 0));

describe('PrimoAvailabilityDomController', () => {
  let controller: PrimoAvailabilityDomController;
  let container: HTMLElement;
  let wrapper: HTMLElement;
  let host: HTMLElement;

  // Build the DOM shape the controller expects in the real app:
  //   container
  //     ├─ ng-component (wrapper)        <- our component's wrapper
  //     │    └─ custom-third-iron-buttons (host, i.e. elementRef.nativeElement)
  //     └─ nde-online-availability       <- native Primo element (sibling of the wrapper)
  // The availability element is only appended when `withAvailability` is true, so tests can also
  // exercise the "not rendered yet" path.
  const buildDom = (withAvailability = true): HTMLElement | null => {
    container = document.createElement('div');
    wrapper = document.createElement('ng-component');
    host = document.createElement('custom-third-iron-buttons');
    wrapper.appendChild(host);
    container.appendChild(wrapper);

    let availability: HTMLElement | null = null;
    if (withAvailability) {
      availability = document.createElement(TAG);
      container.appendChild(availability);
    }
    document.body.appendChild(container);
    return availability;
  };

  beforeEach(() => {
    controller = new PrimoAvailabilityDomController();
  });

  afterEach(() => {
    controller.disconnect();
    if (container?.parentElement) {
      container.parentElement.removeChild(container);
    }
  });

  describe('hideAvailability', () => {
    it('hides the native element found by walking up from the host, and returns the count', () => {
      const availability = buildDom()!;

      const count = controller.hideAvailability(host);

      expect(count).toBe(1);
      expect(availability.classList.contains(HIDDEN_CLASS)).toBeTrue();
      expect(availability.style.display).toBe('none');
      expect(availability.dataset['tiOnlineAvailabilityHiddenByThirdIron']).toBe('1');
    });

    it('remembers the previous inline display value so it can be restored exactly', () => {
      const availability = buildDom()!;
      availability.style.display = 'flex';

      controller.hideAvailability(host);

      expect(availability.dataset['tiOnlineAvailabilityPrevDisplay']).toBe('flex');
      expect(availability.style.display).toBe('none');
    });

    it('returns 0 when there is no native element to hide', () => {
      buildDom(false);
      expect(controller.hideAvailability(host)).toBe(0);
    });

    it('returns 0 for a null host', () => {
      expect(controller.hideAvailability(null)).toBe(0);
    });
  });

  describe('restoreAvailability', () => {
    it('restores the previous display, removes the class + dataset flags, and returns the count', () => {
      const availability = buildDom()!;
      availability.style.display = 'flex';
      controller.hideAvailability(host);

      const restored = controller.restoreAvailability(host);

      expect(restored).toBe(1);
      expect(availability.classList.contains(HIDDEN_CLASS)).toBeFalse();
      expect(availability.style.display).toBe('flex');
      expect(availability.dataset['tiOnlineAvailabilityHiddenByThirdIron']).toBeUndefined();
      expect(availability.dataset['tiOnlineAvailabilityPrevDisplay']).toBeUndefined();
    });

    it('does not touch elements it did not hide', () => {
      const availability = buildDom()!;
      availability.style.display = 'block';

      const restored = controller.restoreAvailability(host);

      expect(restored).toBe(0);
      expect(availability.style.display).toBe('block');
    });
  });

  describe('hideWrapper / restoreWrapper', () => {
    it('hides the ng-component wrapper and restores it exactly', () => {
      buildDom();
      wrapper.style.display = 'inline-block';

      expect(controller.hideWrapper(host)).toBeTrue();
      expect(wrapper.style.display).toBe('none');
      expect(wrapper.dataset['tiWrapperHiddenByThirdIron']).toBe('1');

      expect(controller.restoreWrapper(host)).toBeTrue();
      expect(wrapper.style.display).toBe('inline-block');
      expect(wrapper.dataset['tiWrapperHiddenByThirdIron']).toBeUndefined();
    });

    it('returns false when there is no ng-component wrapper', () => {
      // host directly under container, no ng-component ancestor
      container = document.createElement('div');
      host = document.createElement('custom-third-iron-buttons');
      container.appendChild(host);
      document.body.appendChild(container);

      expect(controller.hideWrapper(host)).toBeFalse();
      expect(controller.restoreWrapper(host)).toBeFalse();
    });

    it('restoreWrapper is a no-op when the wrapper was not hidden by us', () => {
      buildDom();
      expect(controller.restoreWrapper(host)).toBeFalse();
    });
  });

  describe('observeAvailability', () => {
    it('hides a native element that appears AFTER we start observing (the core race)', async () => {
      buildDom(false); // native element not rendered yet
      controller.observeAvailability(host);

      // Primo renders the native element later.
      const availability = document.createElement(TAG);
      container.appendChild(availability);
      await flushMutations();

      expect(availability.classList.contains(HIDDEN_CLASS)).toBeTrue();
      expect(availability.style.display).toBe('none');
    });

    it('hides an element that is already present when observing starts', () => {
      const availability = buildDom()!;
      controller.observeAvailability(host);

      // Synchronous initial pass hides what's already there (no mutation needed).
      expect(availability.classList.contains(HIDDEN_CLASS)).toBeTrue();
    });

    it('re-hides an element that Primo replaces (re-render)', async () => {
      const first = buildDom()!;
      controller.observeAvailability(host);
      expect(first.classList.contains(HIDDEN_CLASS)).toBeTrue();

      // Primo removes and re-adds a fresh (unhidden) element.
      container.removeChild(first);
      const replacement = document.createElement(TAG);
      container.appendChild(replacement);
      await flushMutations();

      expect(replacement.classList.contains(HIDDEN_CLASS)).toBeTrue();
    });

    it('stops re-hiding when the shouldKeepHiding guard returns false', async () => {
      let guarding = true;
      buildDom(false);
      controller.observeAvailability(host, () => guarding);

      guarding = false;
      const availability = document.createElement(TAG);
      container.appendChild(availability);
      await flushMutations();

      expect(availability.classList.contains(HIDDEN_CLASS)).toBeFalse();
    });

    it('does not hide new elements after disconnect()', async () => {
      buildDom(false);
      controller.observeAvailability(host);
      controller.disconnect();

      const availability = document.createElement(TAG);
      container.appendChild(availability);
      await flushMutations();

      expect(availability.classList.contains(HIDDEN_CLASS)).toBeFalse();
    });
  });

  describe('isObserving', () => {
    it('reflects the observer lifecycle', () => {
      buildDom();
      expect(controller.isObserving()).toBeFalse();

      controller.observeAvailability(host);
      expect(controller.isObserving()).toBeTrue();

      controller.disconnect();
      expect(controller.isObserving()).toBeFalse();
    });
  });
});
