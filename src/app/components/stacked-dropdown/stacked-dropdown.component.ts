import { Component, input, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { StackLink } from 'src/app/types/primoViewModel.types';
import { NavigationService } from '../../services/navigation.service';
import { EntityType } from 'src/app/shared/entity-type.enum';
import { StackedButtonComponent } from './components/stacked-button.component';
import { MainButtonComponent } from '../main-button/main-button.component';
import { ButtonType } from 'src/app/shared/button-type.enum';
import { ArticleLinkButtonComponent } from '../article-link-button/article-link-button.component';
import { BrowzineButtonComponent } from '../browzine-button/browzine-button.component';

@Component({
  selector: 'stacked-dropdown',
  standalone: true,
  imports: [
    MatButtonModule,
    MatSelectModule,
    StackedButtonComponent,
    MainButtonComponent,
    ArticleLinkButtonComponent,
    BrowzineButtonComponent,
  ],
  templateUrl: './stacked-dropdown.component.html',
  styleUrls: ['../../third-iron-module/mat-select-overrides.scss'],
  encapsulation: ViewEncapsulation.None, // override styles are loaded globally from third-iron-module/mat-select-overrides.scss
})
export class StackedDropdownComponent {
  ButtonType = ButtonType;
  EntityType = EntityType;
  links = input.required<StackLink[]>();

  constructor(private navigationService: NavigationService) {}

  onPanelOpened(opened: boolean): void {
    if (!opened) return;
    // queueMicrotask schedules a callback to run after the current task, before the next paint.
    // We use it so the panel is in the DOM and focus state is settled before we check them.
    queueMicrotask(() => {
      const isKeyboard = document.activeElement?.matches?.(':focus-visible') ?? false;
      const panel = document.querySelector('.ti-stacked-dropdown-panel');
      panel?.classList.toggle('ti-select-keyboard-nav', isKeyboard);
    });
  }

  onOptionSelected(event: MatSelectChange): void {
    const link = event.value as StackLink;
    if (link?.url) {
      this.navigationService.openUrl(link.url);
    }
  }

  toEntityType(value: unknown): EntityType {
    // Accept enum values or string literals and coerce to EntityType
    if (value === EntityType.Article || value === 'Article') {
      return EntityType.Article;
    }
    if (value === EntityType.Journal || value === 'Journal') {
      return EntityType.Journal;
    }
    // Default to Article when ambiguous (only used for BrowZine context)
    return EntityType.Article;
  }
}
