import { Component, input, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { StackLink } from 'src/app/types/primoViewModel.types';
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

  toEntityType(value: unknown): EntityType {
    // #region agent log
    const _links = this.links?.() || [];
    fetch('http://127.0.0.1:7243/ingest/6f464193-ba2e-4950-8450-e8a059b7fbe3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'C',location:'stacked-dropdown.component.ts:toEntityType',message:'stacked-dropdown render snapshot',data:{count:_links.length,first:{source:_links[0]?.source,showSecondaryButton:!!_links[0]?.showSecondaryButton,mainButtonType:_links[0]?.mainButtonType,label:_links[0]?.label,urlPresent:!!_links[0]?.url,urlPrefix:(_links[0]?.url||'').slice(0,24)}},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log

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
