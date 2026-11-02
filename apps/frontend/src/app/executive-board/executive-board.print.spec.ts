import { emptyMeeting, emptyMotion } from './executive-board.models';
import { minutesHtml, motionHtml } from './executive-board.print';

describe('board print layouts', () => {
  const motion = () => ({
    ...emptyMotion('2026-11-02', 'Anna Brandt'),
    title: 'Antrag Trikots',
    subtitle: 'Wettkampfgruppe',
    heading: 'Neue Trikots',
    text: 'wir bitten um neue Trikots.\n\n| Posten | Summe |\n| Trikots | 480 € |',
  });

  it('puts title and subtitle first, then heading, salutation, text, closing and signature', () => {
    const html = motionHtml(motion());
    const order = [
      '<h1>Antrag Trikots</h1>',
      '<div class="sub">Wettkampfgruppe</div>',
      '<h2>Neue Trikots</h2>',
      'Sehr geehrte Damen und Herren,',
      'wir bitten um neue Trikots.',
      '<table>',
      'Mit sportlichem Gruß',
      'Barnstorf, 02.11.2026',
      'Anna Brandt',
    ].map((part) => html.indexOf(part));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('renders the first table row as the head', () => {
    const html = motionHtml(motion());
    expect(html).toContain('<thead><tr><th>Posten</th><th>Summe</th></tr></thead>');
    expect(html).toContain('<td>Trikots</td><td>480 €</td>');
  });

  it('does not add a salutation or a closing that the text has already', () => {
    const html = motionHtml({
      ...motion(),
      text: 'Sehr geehrte Frau Meyer,\n\nbitte um Rückmeldung.\n\nMit freundlichem Gruß',
    });
    expect(html.match(/Sehr geehrte/g)).toHaveLength(1);
    expect(html).not.toContain('Mit sportlichem Gruß');
  });

  it('escapes what is typed', () => {
    const html = motionHtml({ ...motion(), title: 'A <b>&</b>', text: '<script>x</script>' });
    expect(html).toContain('A &lt;b&gt;&amp;&lt;/b&gt;');
    expect(html).not.toContain('<script>');
  });

  it('prints minutes with numbered points, indented sub points and the people present', () => {
    const html = minutesHtml({
      ...emptyMeeting('2026-11-02'),
      title: 'Vorstandssitzung',
      time: '19:30',
      place: 'Vereinsheim',
      attendees: 'Maria, Anna',
      secretary: 'Anna Brandt',
      minutes: 'Begrüßung\n- Trikots\n| A | B |\n| 1 | 2 |',
    });
    expect(html).toContain('<h1>Protokoll Vorstandssitzung</h1>');
    expect(html).toContain('02.11.2026, 19:30 Uhr · Vereinsheim');
    expect(html).toContain('Protokollführung: Anna Brandt');
    expect(html).toContain('Anwesend: Maria, Anna');
    expect(html).toContain('<p style="margin:3px 0 3px 0px"><b>1.</b> Begrüßung</p>');
    expect(html).toContain('<p style="margin:3px 0 3px 22px"><b>a.</b> Trikots</p>');
    expect(html).toContain('<th>A</th><th>B</th>');
  });
});
