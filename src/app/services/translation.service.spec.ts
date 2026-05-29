import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

import { TranslationService } from './translation.service';
import { DebugLogService } from './debug-log.service';
import { ConfigService } from './config.service';

interface SetupOptions {
  multicampus?: boolean;
  initialValue?: string;
}

const setup = (opts: SetupOptions = {}) => {
  const multicampus = opts.multicampus ?? false;
  const streamedKeys: string[] = [];
  const stream$ = new BehaviorSubject<string>(opts.initialValue ?? '');
  const langChange$ = new BehaviorSubject<any>({ lang: 'en', previousLang: 'fr' });

  const translateMock = {
    stream: (key: string) => {
      streamedKeys.push(key);
      return stream$.asObservable();
    },
    onLangChange: langChange$.asObservable(),
  } as unknown as TranslateService;

  const debugLogMock = {
    debug: jasmine.createSpy('debug'),
  } as unknown as DebugLogService;

  const configMock = {
    isMulticampus: () => multicampus,
  } as unknown as ConfigService;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      TranslationService,
      { provide: TranslateService, useValue: translateMock },
      { provide: DebugLogService, useValue: debugLogMock },
      { provide: ConfigService, useValue: configMock },
    ],
  });

  const service = TestBed.inject(TranslationService);
  return { service, stream$, streamedKeys, debugLogMock };
};

describe('TranslationService', () => {
  it('emits fallback when translation equals the key, otherwise emits translated value', () => {
    const { service, stream$, streamedKeys, debugLogMock } = setup({
      initialValue: 'TRANSLATION_KEY',
    });

    const received: string[] = [];
    const sub = service
      .getTranslatedText$('TRANSLATION_KEY', 'Fallback')
      .subscribe(v => received.push(v));

    // Single-campus: key is looked up as-is (no prefix).
    expect(streamedKeys[0]).toBe('TRANSLATION_KEY');

    // Initial emission equals key → fallback
    expect(received[0]).toBe('Fallback');

    // Update: a real translation should pass through
    stream$.next('Translated!');
    expect(received[1]).toBe('Translated!');

    // Update: empty string should fall back
    stream$.next('');
    expect(received[2]).toBe('Fallback');

    // Language change is logged
    expect((debugLogMock as any).debug).toHaveBeenCalledWith('Translation.langChange', {
      lang: 'en',
    });

    sub.unsubscribe();
  });

  describe('multicampus vid prefixing', () => {
    it('prefixes LibKey.* keys with the vid suffix (segment after last ":")', () => {
      const { service, streamedKeys } = setup({ multicampus: true });
      spyOn(service as any, 'getVidSuffix').and.returnValue('LIBKEY_NDE');

      const sub = service.getTranslatedText$('LibKey.articleLinkText', 'Read Article').subscribe();

      expect(streamedKeys[0]).toBe('LIBKEY_NDE.LibKey.articleLinkText');
      sub.unsubscribe();
    });

    it('derives the prefix from only the part after the last ":" of the URL vid', () => {
      const { service, streamedKeys } = setup({ multicampus: true });
      // getVidSuffix reads the `vid` param via URLSearchParams; return a full vid to verify ":"-stripping.
      spyOn(URLSearchParams.prototype, 'get').and.returnValue('01COLSCHL_INST:LIBKEY_NDE');

      const sub = service.getTranslatedText$('LibKey.articleLinkText', 'Read Article').subscribe();

      expect(streamedKeys[0]).toBe('LIBKEY_NDE.LibKey.articleLinkText');
      sub.unsubscribe();
    });

    it('does not prefix non-LibKey keys', () => {
      const { service, streamedKeys } = setup({ multicampus: true });
      spyOn(service as any, 'getVidSuffix').and.returnValue('LIBKEY_NDE');

      const sub = service.getTranslatedText$('fulldisplay.HTML', 'Read Online').subscribe();

      expect(streamedKeys[0]).toBe('fulldisplay.HTML');
      sub.unsubscribe();
    });

    it('does not prefix when the vid suffix is empty', () => {
      const { service, streamedKeys } = setup({ multicampus: true });
      spyOn(service as any, 'getVidSuffix').and.returnValue('');

      const sub = service.getTranslatedText$('LibKey.articleLinkText', 'Read Article').subscribe();

      expect(streamedKeys[0]).toBe('LibKey.articleLinkText');
      sub.unsubscribe();
    });

    it('does not prefix in single-campus mode', () => {
      const { service, streamedKeys } = setup({ multicampus: false });
      spyOn(service as any, 'getVidSuffix').and.returnValue('LIBKEY_NDE');

      const sub = service.getTranslatedText$('LibKey.articleLinkText', 'Read Article').subscribe();

      expect(streamedKeys[0]).toBe('LibKey.articleLinkText');
      sub.unsubscribe();
    });
  });
});
