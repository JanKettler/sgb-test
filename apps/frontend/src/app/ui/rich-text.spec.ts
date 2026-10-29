import { readableOn } from './color-field';
import { cleanHtml, htmlToText, isHexColor, textToHtml } from './rich-text';

describe('cleanHtml', () => {
  it('removes scripts, event handlers and unknown tags but keeps the text', () => {
    const html = '<b onclick="x()">Hallo</b><script>alert(1)</script><h1>Titel</h1>';
    expect(cleanHtml(html)).toBe('<b>Hallo</b>Titel');
  });

  it('keeps colours and free sizes and drops everything else from the style', () => {
    const html =
      '<span style="color:#ff0000;font-size:20px;position:fixed;font-size:300px">A</span>';
    expect(cleanHtml(html)).toBe('<span style="color:#ff0000;font-size:20px">A</span>');
  });

  it('allows web links and portal links and drops dangerous ones', () => {
    expect(cleanHtml('<a href="https://sg-barnstorf.de">x</a>')).toContain('target="_blank"');
    expect(cleanHtml('<a href="/personen">x</a>')).toBe('<a href="/personen">x</a>');
    expect(cleanHtml('<a href="javascript:alert(1)">x</a>')).toBe('x');
    expect(cleanHtml('<a href="//evil.example">x</a>')).toBe('x');
  });

  it('turns plain text into html and back', () => {
    expect(textToHtml('a <b>\nc')).toBe('a &lt;b&gt;<br>c');
    expect(htmlToText('<div>Eins</div><b>zwei</b>')).toBe('Einszwei');
  });
});

describe('colours', () => {
  it('accepts short and long hex values only', () => {
    expect(isHexColor('#abc')).toBe(true);
    expect(isHexColor('#a1b2c3')).toBe(true);
    expect(isHexColor('#abcd')).toBe(false);
    expect(isHexColor('red')).toBe(false);
  });

  it('picks dark text on light backgrounds and light text on dark ones', () => {
    expect(readableOn('#fff7d6')).toBe('#111827');
    expect(readableOn('#12395c')).toBe('#ffffff');
    expect(readableOn('#fff')).toBe('#111827');
  });
});
