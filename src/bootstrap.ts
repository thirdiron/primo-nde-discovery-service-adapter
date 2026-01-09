import "@angular/compiler";
import { AppModule } from './app/app.module';
import {bootstrap} from "@angular-architects/module-federation-tools";
import { installDebugApi, isDebugEnabled } from './app/debug/debug-controller';

export const bootstrapRemoteApp = (bootstrapOptions: any) => {
   installDebugApi(globalThis);
   return bootstrap(AppModule(bootstrapOptions), {
    production: true,
    appType: 'microfrontend'
  }).then(r => {
    if (isDebugEnabled()) {
      // eslint-disable-next-line no-console
      console.debug('[TI-NDE] bootstrapRemoteApp success');
    }
    return r
  });
}

