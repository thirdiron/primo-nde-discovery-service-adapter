import { Component, ElementRef, Input, ViewEncapsulation, DestroyRef } from '@angular/core';
import { Observable, combineLatestWith, map } from 'rxjs';
import { BrowzineButtonComponent } from '../../components/browzine-button/browzine-button.component';
import { SearchEntity } from '../../types/searchEntity.types';
import { DisplayWaterfallResponse } from '../../types/displayWaterfallResponse.types';
import { SearchEntityService } from '../../services/search-entity.service';
import { ButtonInfoService } from '../../services/button-info.service';
import { ConfigService } from 'src/app/services/config.service';
import { ExlibrisStoreService } from 'src/app/services/exlibris-store.service';
import { AsyncPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ArticleLinkButtonComponent } from 'src/app/components/article-link-button/article-link-button.component';
import { MainButtonComponent } from 'src/app/components/main-button/main-button.component';
import { StackLink, PrimoViewModel } from 'src/app/types/primoViewModel.types';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { ViewOptionType } from 'src/app/shared/view-option.enum';
import { StackedDropdownComponent } from 'src/app/components/stacked-dropdown/stacked-dropdown.component';
import { DebugLogService } from 'src/app/services/debug-log.service';

@Component({
  selector: 'custom-third-iron-buttons',
  standalone: true,
  imports: [
    MainButtonComponent,
    BrowzineButtonComponent,
    ArticleLinkButtonComponent,
    AsyncPipe,
    StackedDropdownComponent,
    MatIconModule,
    MatSelectModule,
  ],
  templateUrl: './third-iron-buttons.component.html',
  styleUrls: [
    './third-iron-buttons.component.scss',
    '../../components/stacked-dropdown/stacked-dropdown.component.scss',
  ],
  providers: [SearchEntityService],
  encapsulation: ViewEncapsulation.None,
})
export class ThirdIronButtonsComponent {
  @Input() hostComponent!: any;
  elementRef: ElementRef;
  combinedLinks: StackLink[] = []; // used to build custom merged array of online services for stack views
  primoLinks: StackLink[] = []; // used to build array of Primo only links for NoStack view option
  showDropdown = false;
  viewOption = this.configService.getViewOption();

  // Expose enum to template
  ViewOptionType = ViewOptionType;

  displayInfo$!: Observable<DisplayWaterfallResponse | null>;
  viewModel$!: Observable<PrimoViewModel>;

  constructor(
    private buttonInfoService: ButtonInfoService,
    private searchEntityService: SearchEntityService,
    private configService: ConfigService,
    private exlibrisStoreService: ExlibrisStoreService,
    private debugLog: DebugLogService,
    private destroyRef: DestroyRef,
    elementRef: ElementRef
  ) {
    this.elementRef = elementRef;
  }

  ngOnInit() {
    // Expose host viewModel$ to the template so it can update reactively via async pipe
    this.viewModel$ = this.hostComponent.viewModel$ as Observable<PrimoViewModel>;

    // Start the process for determining which buttons should be displayed and with what info
    // The raw hostComponent.searchResult is not an observable, so we need to use the ExLibris store to get the up to date record
    this.exlibrisStoreService
      .getRecordForEntity$(this.hostComponent?.searchResult)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(record => {
        this.debugLog.debug(
          'ThirdIronButtons.ngOnInit.record',
          this.debugLog.safeSearchEntityMeta(record)
        );
        if (record) {
          this.enhance(record);
        }
      });
  }

  enhance = (searchResult: SearchEntity) => {
    const shouldEnhance = this.searchEntityService.shouldEnhance(searchResult);
    if (!shouldEnhance) {
      this.debugLog.debug(
        'ThirdIronButtons.enhance.skip',
        this.debugLog.safeSearchEntityMeta(searchResult)
      );
      return;
    }

    this.debugLog.debug('ThirdIronButtons.enhance.start', {
      viewOption: this.viewOption,
      ...this.debugLog.safeSearchEntityMeta(searchResult),
    });

    // Use combineLatestWith to handle both displayInfo$ and viewModel$ observables together
    this.displayInfo$ = this.buttonInfoService.getDisplayInfo(searchResult).pipe(
      combineLatestWith(this.viewModel$),
      map(([displayInfo, viewModel]) => {
        if (this.viewOption !== ViewOptionType.NoStack) {
          // build custom stack options array for StackPlusBrowzine and SingleStack view options
          this.combinedLinks = this.buttonInfoService.buildCombinedLinks(displayInfo, viewModel);

          // remove Primo generated buttons/stack if we have a custom stack
          if (this.combinedLinks.length > 0) {
            const hostElem = this.elementRef.nativeElement; // this component's template element
            const removedCount = this.removePrimoOnlineAvailability(hostElem);
            this.debugLog.debug('ThirdIronButtons.removePrimoOnlineAvailability', {
              reason: 'combinedLinks>0',
              removedCount,
            });
          }
        } else if (this.viewOption === ViewOptionType.NoStack) {
          // Build array of Primo only links, filter based on TI config settings
          this.primoLinks = this.buttonInfoService.buildPrimoLinks(viewModel);

          // remove Primo "Online Options" button or Primo's stack (quick links and direct link)
          // Will be replaced with our own primoLinks options
          const hostElem = this.elementRef.nativeElement; // this component's template element
          const removedCount = this.removePrimoOnlineAvailability(hostElem);
          this.debugLog.debug('ThirdIronButtons.removePrimoOnlineAvailability', {
            reason: 'NoStack',
            removedCount,
          });
        }

        return displayInfo;
      })
    );
  };

  removePrimoOnlineAvailability = (hostElement: HTMLElement): number => {
    const blockParent = hostElement?.parentElement?.parentElement ?? null;
    if (!blockParent) {
      this.debugLog.debug('ThirdIronButtons.removePrimoOnlineAvailability.noAncestor', {
        hasParent: !!hostElement?.parentElement,
      });
      return 0;
    }

    const elems = blockParent.getElementsByTagName(
      'nde-online-availability'
    ) as HTMLCollectionOf<HTMLElement>;
    const arr = Array.from(elems);
    for (const elem of arr) {
      elem.style.display = 'none';
    }
    return arr.length;
  };
}
