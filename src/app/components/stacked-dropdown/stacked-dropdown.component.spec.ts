import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StackedDropdownComponent } from './stacked-dropdown.component';
import { ComponentRef } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

describe('StackedDropdownComponent', () => {
  let component: StackedDropdownComponent;
  let componentRef: ComponentRef<StackedDropdownComponent>;
  let fixture: ComponentFixture<StackedDropdownComponent>;

  beforeEach(() => {
    const translateServiceMock = {
      instant: (key: string) => key,
      stream: (key: string) => of(key),
    } as Partial<TranslateService> as TranslateService;

    TestBed.configureTestingModule({
      imports: [StackedDropdownComponent, NoopAnimationsModule],
      providers: [{ provide: TranslateService, useValue: translateServiceMock }],
    });
    fixture = TestBed.createComponent(StackedDropdownComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
  });

  it('should create', () => {
    expect(component).toBeDefined();
  });

  it('renders main-button when first link is from ThirdIron', () => {
    const links = [
      {
        source: 'thirdIron',
        entityType: 'HTML',
        url: 'https://example.com/article',
        mainButtonType: 'ArticleLink',
        ariaLabel: 'Article',
        label: 'Read Article',
      },
    ];
    componentRef.setInput('links', links as any);
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    const mainButton = nativeEl.querySelector('main-button');
    const stackedButton = nativeEl.querySelector('stacked-button');
    expect(mainButton).toBeTruthy();
    // When stack=true, main-button renders a stacked-button internally
    expect(stackedButton).toBeTruthy();
  });

  it('renders custom-browzine-button as the main button when first link is ThirdIron BrowZine', () => {
    const links = [
      {
        source: 'thirdIron',
        entityType: 'Article',
        url: 'https://example.com/browzine',
        mainButtonType: 'Browzine',
        ariaLabel: 'Browse Journal',
        label: 'Browse Journal',
      },
    ];
    componentRef.setInput('links', links as any);
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    const customBrowzine = nativeEl.querySelector('custom-browzine-button');
    const mainButton = nativeEl.querySelector('main-button');
    expect(customBrowzine).toBeTruthy();
    expect(mainButton).toBeFalsy();
  });

  it('renders stacked-button when first link is not from ThirdIron', () => {
    const links = [
      {
        source: 'quicklink',
        entityType: 'PDF',
        url: 'https://example.com/pdf',
        ariaLabel: 'Get PDF',
        label: 'Get PDF',
      },
    ];
    componentRef.setInput('links', links as any);
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    const mainButton = nativeEl.querySelector('main-button');
    const stackedButton = nativeEl.querySelector('stacked-button');
    expect(mainButton).toBeFalsy();
    expect(stackedButton).toBeTruthy();
  });

  it('renders menu trigger for ThirdIron secondary link scenario', () => {
    const links = [
      {
        source: 'quicklink',
        entityType: 'PDF',
        url: 'https://example.com/pdf',
        ariaLabel: 'Get PDF',
        label: 'Get PDF',
      },
      {
        source: 'thirdIron',
        entityType: 'HTML',
        url: 'https://example.com/article',
        showSecondaryButton: true,
        ariaLabel: 'Article',
        label: 'Read Article',
      },
    ];
    componentRef.setInput('links', links as any);
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    const menu = nativeEl.querySelector('mat-menu');
    const toggle = nativeEl.querySelector('.ti-dropdown-toggle');
    expect(menu).toBeTruthy();
    expect(toggle).toBeTruthy();
  });

  it('renders menu trigger for non-ThirdIron secondary link scenario', () => {
    const links = [
      {
        source: 'thirdIron',
        entityType: 'Article',
        url: 'https://example.com/article',
        mainButtonType: 'ArticleLink',
        ariaLabel: 'Article',
        label: 'Read Article',
      },
      {
        source: 'quicklink',
        entityType: 'HTML',
        url: 'https://example.com/hosted-html',
        ariaLabel: 'Read Online',
        label: 'Read Online',
      },
    ];
    componentRef.setInput('links', links as any);
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    const menu = nativeEl.querySelector('mat-menu');
    const toggle = nativeEl.querySelector('.ti-dropdown-toggle');
    expect(menu).toBeTruthy();
    expect(toggle).toBeTruthy();
  });

  it('renders menu trigger for ThirdIron BrowZine secondary link scenario', () => {
    const links = [
      {
        source: 'quicklink',
        entityType: 'PDF',
        url: 'https://example.com/pdf',
        ariaLabel: 'Get PDF',
        label: 'Get PDF',
      },
      {
        source: 'thirdIron',
        entityType: 'Journal',
        url: 'https://example.com/browzine',
        mainButtonType: 'Browzine',
        ariaLabel: 'Browse Journal',
        label: 'Browse Journal',
      },
    ];
    componentRef.setInput('links', links as any);
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    const menu = nativeEl.querySelector('mat-menu');
    const toggle = nativeEl.querySelector('.ti-dropdown-toggle');
    expect(menu).toBeTruthy();
    expect(toggle).toBeTruthy();
  });

  it('always renders a menu dropdown container for more than one link', () => {
    const links = [
      {
        source: 'quicklink',
        entityType: 'PDF',
        url: 'https://example.com/pdf',
        ariaLabel: 'Get PDF',
        label: 'Get PDF',
      },
      {
        source: 'quicklink',
        entityType: 'HTML',
        url: 'https://example.com/html',
        ariaLabel: 'Read Online',
        label: 'Read Online',
      },
    ];
    componentRef.setInput('links', links as any);
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    const dropdown = nativeEl.querySelector('.ti-dropdown');
    const toggle = nativeEl.querySelector('.ti-dropdown-toggle');
    expect(dropdown).toBeTruthy();
    expect(toggle).toBeTruthy();
  });

  it('does not render dropdown when only one link is present', () => {
    const links = [
      {
        source: 'quicklink',
        entityType: 'PDF',
        url: 'https://example.com/pdf',
        ariaLabel: 'Get PDF',
        label: 'Get PDF',
      },
    ];
    componentRef.setInput('links', links as any);
    fixture.detectChanges();

    const nativeEl = fixture.nativeElement as HTMLElement;
    const dropdown = nativeEl.querySelector('.ti-dropdown');
    expect(dropdown).toBeFalsy();
  });
});
