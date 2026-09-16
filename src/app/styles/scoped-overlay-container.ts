import { Injectable } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { TI_SCOPE_CLASS } from './css-scope';

/**
 * Tags our CDK overlay container with the scope class.
 *
 * `ScopedStylesHost` rewrites every stylesheet we inject to only match inside `.ti-scope`, which our
 * root components carry. Overlays break that assumption: CDK portals them into a
 * `.cdk-overlay-container` appended to `document.body`, so an open `mat-menu` panel is a sibling of
 * Primo's app root rather than a descendant of ours, and none of our scoped CSS reaches it.
 *
 * Each Angular app gets its own `OverlayContainer` instance and therefore its own container
 * element, so adding the class here scopes all of our overlays at once without touching Primo's.
 *
 * Doing it here rather than per-component is deliberate: `MatMenu` exposes its `panelClass` input
 * under the public name `class` (`@Input('class') set panelClass`), so the obvious-looking
 * `<mat-menu panelClass="...">` silently does nothing — it just becomes an inert DOM attribute.
 * This approach can't be defeated that way, and it covers any overlay we add later.
 */
@Injectable()
export class ScopedOverlayContainer extends OverlayContainer {
  override getContainerElement(): HTMLElement {
    const container = super.getContainerElement();
    container.classList.add(TI_SCOPE_CLASS);
    return container;
  }
}
