import { APP_INITIALIZER, ApplicationRef, DoBootstrap, Injector, NgModule } from '@angular/core';
import { BrowserModule, ɵSharedStylesHost as SharedStylesHost } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { createCustomElement, NgElementConstructor } from '@angular/elements';
import { Router } from '@angular/router';
import { selectorComponentMap } from './third-iron-module/customComponentMappings';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AutoAssetSrcDirective } from './services/auto-asset-src.directive';
import { SHELL_ROUTER } from './injection-tokens';
import { provideHttpClient } from '@angular/common/http';
import { ScopedStylesHost } from './styles/scoped-styles-host';
import { ScopedOverlayContainer } from './styles/scoped-overlay-container';
import { OverlayContainer } from '@angular/cdk/overlay';
import { installHostElementOverrides } from './styles/host-element-overrides';

export const AppModule = ({ providers, shellRouter }: { providers: any; shellRouter: Router }) => {
  @NgModule({
    declarations: [AppComponent, AutoAssetSrcDirective],
    exports: [AutoAssetSrcDirective],
    imports: [BrowserModule, CommonModule, TranslateModule.forRoot({})],
    providers: [
      ...providers,
      provideHttpClient(),
      { provide: SHELL_ROUTER, useValue: shellRouter },
      // Displaces the `SharedStylesHost` from BROWSER_MODULE_PROVIDERS so every stylesheet we
      // inject into the host page is scoped to our components. Must stay ahead of first render.
      { provide: SharedStylesHost, useClass: ScopedStylesHost },
      // Overlays (the stacked-dropdown `mat-menu`) are portaled to document.body, outside the root
      // element carrying the scope class, so the container needs the class too.
      { provide: OverlayContainer, useClass: ScopedOverlayContainer },
      // The handful of rules that must reach Primo's own elements, which by definition sit outside
      // the scope the two providers above enforce. Injected here rather than shipped in custom.css
      // because that bundle is only loaded when a library installs our view customization package —
      // see host-element-overrides.ts.
      { provide: APP_INITIALIZER, multi: true, useValue: () => installHostElementOverrides() },
    ],
    bootstrap: [],
  })
  class AppModule implements DoBootstrap {
    private webComponentSelectorMap = new Map<string, NgElementConstructor<unknown>>();

    constructor(
      private injector: Injector,
      private router: Router
    ) {
      router.dispose(); //this prevents the router from being initialized and interfering with the shell app router
    }

    ngDoBootstrap(appRef: ApplicationRef) {
      for (const [key, value] of selectorComponentMap) {
        const customElement = createCustomElement(value, {
          injector: this.injector,
        });
        this.webComponentSelectorMap.set(key, customElement);
      }
    }

    /**
     * Use componentMapping, selectorComponentMap
     * @param componentName
     */
    public getComponentRef(componentName: string) {
      return this.webComponentSelectorMap.get(componentName);
    }
  }
  return AppModule;
};
