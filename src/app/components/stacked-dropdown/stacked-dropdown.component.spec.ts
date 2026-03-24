import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { StackedDropdownComponent } from './stacked-dropdown.component';
import { ComponentRef } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { MatMenuTrigger } from '@angular/material/menu';
import { OverlayContainer } from '@angular/cdk/overlay';

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

  it('renders menu trigger and article-link-button in menu for ThirdIron secondary link scenario', () => {
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

    const triggerDe = fixture.debugElement.query(By.directive(MatMenuTrigger));
    const menuTrigger = triggerDe.injector.get(MatMenuTrigger);
    menuTrigger.openMenu();
    fixture.detectChanges();

    const overlayEl = TestBed.inject(OverlayContainer).getContainerElement();
    const articleLinkButtons = overlayEl.querySelectorAll('article-link-button');
    expect(articleLinkButtons.length).toBe(1);
  });

  it('renders menu trigger and stacked-button in menu for non-ThirdIron secondary link scenario', () => {
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

    const triggerDe = fixture.debugElement.query(By.directive(MatMenuTrigger));
    const menuTrigger = triggerDe.injector.get(MatMenuTrigger);
    menuTrigger.openMenu();
    fixture.detectChanges();

    const overlayEl = TestBed.inject(OverlayContainer).getContainerElement();
    const stackedButtons = overlayEl.querySelectorAll('stacked-button');
    expect(stackedButtons.length).toBe(1);
  });

  it('renders menu trigger and custom-browzine-button in menu for ThirdIron BrowZine secondary link scenario', () => {
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

    const triggerDe = fixture.debugElement.query(By.directive(MatMenuTrigger));
    const menuTrigger = triggerDe.injector.get(MatMenuTrigger);
    menuTrigger.openMenu();
    fixture.detectChanges();

    const overlayEl = TestBed.inject(OverlayContainer).getContainerElement();
    const customBrowzineButtons = overlayEl.querySelectorAll('custom-browzine-button');
    expect(customBrowzineButtons.length).toBe(1);
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

  describe('onMenuItemClick', () => {
    it('opens link when url is present', () => {
      const link = {
        source: 'quicklink',
        entityType: 'PDF',
        url: 'https://example.com/pdf',
        ariaLabel: 'Get PDF',
        label: 'Get PDF',
      };
      const openUrlSpy = spyOn(component['navigationService'], 'openUrl');

      component.onMenuItemClick(link as any);

      expect(openUrlSpy).toHaveBeenCalledWith('https://example.com/pdf');
    });

    it('does not open when url is missing', () => {
      const link = {
        source: 'quicklink',
        entityType: 'HTML',
        ariaLabel: 'Read',
        label: 'Read',
      } as any;
      const openUrlSpy = spyOn(component['navigationService'], 'openUrl');

      component.onMenuItemClick(link);

      expect(openUrlSpy).not.toHaveBeenCalled();
    });

    it('opens link when Enter is pressed on a menu item', () => {
      const link = {
        source: 'thirdIron',
        entityType: 'HTML',
        url: 'https://example.com/article',
        showSecondaryButton: true,
        ariaLabel: 'Article',
        label: 'Read Article',
      };
      const openUrlSpy = spyOn(component['navigationService'], 'openUrl');
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      spyOn(event, 'preventDefault');

      component.onMenuItemKeydown(event, link as any);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(openUrlSpy).toHaveBeenCalledWith('https://example.com/article');
    });

    it('opens link when Space is pressed on a menu item', () => {
      const link = {
        source: 'quicklink',
        entityType: 'HTML',
        url: 'https://example.com/online',
        ariaLabel: 'Read Online',
        label: 'Read Online',
      };
      const openUrlSpy = spyOn(component['navigationService'], 'openUrl');
      const event = new KeyboardEvent('keydown', { key: ' ' });
      spyOn(event, 'preventDefault');

      component.onMenuItemKeydown(event, link as any);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(openUrlSpy).toHaveBeenCalledWith('https://example.com/online');
    });

    it('ignores non-Enter/Space keys for onMenuItemKeydown', () => {
      const link = {
        source: 'quicklink',
        url: 'https://example.com/pdf',
        entityType: 'PDF',
      } as any;
      const openUrlSpy = spyOn(component['navigationService'], 'openUrl');
      const event = new KeyboardEvent('keydown', { key: 'a' });

      component.onMenuItemKeydown(event, link);

      expect(openUrlSpy).not.toHaveBeenCalled();
    });
  });

  describe('toEntityType', () => {
    it('returns Article for Article enum or string', () => {
      expect(component.toEntityType('Article')).toBe(component.EntityType.Article);
      expect(component.toEntityType(component.EntityType.Article)).toBe(component.EntityType.Article);
    });

    it('returns Journal for Journal enum or string', () => {
      expect(component.toEntityType('Journal')).toBe(component.EntityType.Journal);
      expect(component.toEntityType(component.EntityType.Journal)).toBe(component.EntityType.Journal);
    });

    it('defaults to Article for unknown values', () => {
      expect(component.toEntityType('Unknown')).toBe(component.EntityType.Article);
      expect(component.toEntityType(null)).toBe(component.EntityType.Article);
    });
  });
});
