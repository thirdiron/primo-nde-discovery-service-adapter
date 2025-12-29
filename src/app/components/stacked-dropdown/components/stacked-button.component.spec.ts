import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { StackedButtonComponent } from './stacked-button.component';
import { StackLink } from 'src/app/types/primoViewModel.types';

describe('StackedButtonComponent', () => {
  let component: StackedButtonComponent;
  let componentRef: ComponentRef<StackedButtonComponent>;
  let fixture: ComponentFixture<StackedButtonComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StackedButtonComponent],
    });
    fixture = TestBed.createComponent(StackedButtonComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
  });

  it('should create', () => {
    expect(component).toBeDefined();
  });

  it('openLink should open in same tab for same-origin URLs', () => {
    const link: StackLink = {
      entityType: 'directLink',
      // Same-origin URLs should be treated as in-app navigation (same tab).
      // Use a relative path so this stays stable regardless of Karma's origin.
      url: '/record/123',
      source: 'directLink',
    };

    componentRef.setInput('link', link);
    componentRef.setInput('stackType', 'main');
    fixture.detectChanges();

    const openSpy = spyOn(window, 'open');
    component.openLink();
    expect(openSpy).toHaveBeenCalledWith('/record/123', '_self');
  });

  it('openLink should open in new tab for external-origin URLs', () => {
    const link: StackLink = {
      entityType: 'PDF',
      url: 'https://example.com/pdf',
      source: 'quicklink',
    };

    componentRef.setInput('link', link);
    componentRef.setInput('stackType', 'main');
    fixture.detectChanges();

    const openSpy = spyOn(window, 'open');
    component.openLink();
    expect(openSpy).toHaveBeenCalledWith('https://example.com/pdf', '_blank');
  });

  it('openLink should not open when url is missing/empty', () => {
    const link: StackLink = {
      entityType: 'HTML',
      url: '',
      source: 'quicklink',
    };

    componentRef.setInput('link', link);
    componentRef.setInput('stackType', 'main');
    fixture.detectChanges();

    const openSpy = spyOn(window, 'open');
    component.openLink();
    expect(openSpy).not.toHaveBeenCalled();
  });
});
