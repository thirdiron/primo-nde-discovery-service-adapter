import { Component, input, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
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
    MatMenuModule,
    StackedButtonComponent,
    MainButtonComponent,
    ArticleLinkButtonComponent,
    BrowzineButtonComponent,
  ],
  templateUrl: './stacked-dropdown.component.html',
  styleUrls: ['../../third-iron-module/stacked-dropdown-overrides.scss'],
  encapsulation: ViewEncapsulation.None, // override styles are loaded globally from third-iron-module/stacked-dropdown-overrides.scss
})
export class StackedDropdownComponent {
  ButtonType = ButtonType;
  EntityType = EntityType;
  links = input.required<StackLink[]>();

  constructor(private navigationService: NavigationService) {}

  onMenuItemClick(link: StackLink): void {
    if (link?.url) {
      this.navigationService.openUrl(link.url);
    }
  }

  onMenuItemKeydown(event: KeyboardEvent, link: StackLink): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onMenuItemClick(link);
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
