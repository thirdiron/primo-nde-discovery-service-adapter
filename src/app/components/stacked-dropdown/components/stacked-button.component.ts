import { Component, input, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { StackLink } from 'src/app/types/primoViewModel.types';
import { PrimoPdfIconComponent } from '../../icons/primo-pdf-icon.component';
import { PrimoHtmlIconComponent } from '../../icons/primo-html-icon.component';
import { SvgIconComponent } from '../../svg-icon/svg-icon.component';
import { NavigationService } from '../../../services/navigation.service';

@Component({
  selector: 'stacked-button',
  standalone: true,
  imports: [
    MatButtonModule,
    PrimoPdfIconComponent,
    PrimoHtmlIconComponent,
    SvgIconComponent,
  ],
  templateUrl: './stacked-button.component.html',
  styleUrls: ['../../../third-iron-module/stacked-dropdown-overrides.scss'],
  encapsulation: ViewEncapsulation.None, // override styles are loaded globally from third-iron-module/stacked-dropdown-overrides.scss
})
export class StackedButtonComponent {
  link = input.required<StackLink>();
  stackType = input.required<'dropdown' | 'main'>();

  constructor(private navigationService: NavigationService) {}

  openLink() {
    // When in dropdown, parent stacked-dropdown handles navigation from menu item click/keyboard
    // to avoid double navigation from nested buttons.
    if (this.stackType() === 'main' && this.link()?.url) {
      this.navigationService.openUrl(this.link().url);
    }
  }
}
