import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, map } from 'rxjs';
import { DebugLogService } from './debug-log.service';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  // Memoized vid suffix (only the segment after the last ':' of the URL `vid` param).
  private vidSuffix: string | null = null;

  constructor(
    private translate: TranslateService,
    private debugLog: DebugLogService,
    private configService: ConfigService
  ) {
    // Log language changes once at the translation boundary so downstream callers don't need to.
    const onLangChange$ = (this.translate as any)?.onLangChange;
    if (onLangChange$ && typeof onLangChange$.subscribe === 'function') {
      onLangChange$.subscribe((evt: any) => {
        this.debugLog.debug('Translation.langChange', {
          lang: evt?.lang ?? null,
        });
      });
    }
  }

  /**
   * Gets translated text with fallback support
   * @param translationKey - The translation key to look up
   * @param fallbackText - Fallback text if translation is not found or equals the key
   * @returns Observable that emits the translated text (and updates on language changes) or fallback text
   */
  getTranslatedText$(translationKey: string, fallbackText: string): Observable<string> {
    const effectiveKey = this.buildEffectiveKey(translationKey);
    return this.translate
      .stream(effectiveKey)
      .pipe(
        map(translatedText =>
          translatedText && translatedText !== effectiveKey ? translatedText : fallbackText
        )
      );
  }

  /**
   * In multicampus mode, LibKey custom-label keys are looked up under a campus-specific prefix
   * derived from the URL `vid` (e.g. vid `01COLSCHL_INST:LIBKEY_NDE` => prefix `LIBKEY_NDE`).
   * Non-LibKey keys (Primo's own labels) and single-campus mode are left untouched.
   */
  private buildEffectiveKey(translationKey: string): string {
    if (this.configService.isMulticampus() && translationKey.startsWith('LibKey.')) {
      const vidSuffix = this.getVidSuffix();
      if (vidSuffix) {
        return `${vidSuffix}.${translationKey}`;
      }
    }
    return translationKey;
  }

  /**
   * Reads the `vid` from the URL and returns only the segment after the last ':'.
   * The value is stable for a given page load, so it is computed once and memoized.
   */
  private getVidSuffix(): string {
    if (this.vidSuffix === null) {
      let vid = '';
      try {
        vid = new URLSearchParams(location.search).get('vid') || '';
      } catch {
        vid = '';
      }
      this.vidSuffix = vid.includes(':') ? vid.slice(vid.lastIndexOf(':') + 1) : vid;
    }
    return this.vidSuffix;
  }

  // POSSIBLE FUTURE ADDITIONS //

  /**
   * Sets the current language
   * @param language - The language code to set
   */
  // setLanguage(language: string): void {
  //   this.translate.use(language);
  // }

  /**
   * Gets the current language
   * @returns The current language code
   */
  // getCurrentLanguage(): string {
  //   return this.translate.currentLang;
  // }

  /**
   * Gets all available languages
   * @returns Array of available language codes
   */
  // getAvailableLanguages(): string[] {
  //   return this.translate.getLangs();
  // }
}
