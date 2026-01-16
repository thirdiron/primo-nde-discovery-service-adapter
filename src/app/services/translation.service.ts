import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, map } from 'rxjs';
import { DebugLogService } from './debug-log.service';

@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  constructor(
    private translate: TranslateService,
    private debugLog: DebugLogService
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
    return this.translate
      .stream(translationKey)
      .pipe(
        map(translatedText =>
          translatedText && translatedText !== translationKey ? translatedText : fallbackText
        )
      );
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
