from html.parser import HTMLParser
from pathlib import Path
import json,re

root=Path(__file__).resolve().parents[1]
class Inspect(HTMLParser):
    def __init__(self):
        super().__init__();self.ids=[];self.assets=[];self.labels=[];self.lang=None
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='html':self.lang=a.get('lang')
        if tag in ('script','link','img'):
            url=a.get('src') or a.get('href')
            if url:self.assets.append(url)
        if tag=='label' and 'for' in a:self.labels.append(a['for'])

p=Inspect();p.feed((root/'public/cnc.html').read_text())
assert len(p.ids)==len(set(p.ids)), 'Duplicate DOM IDs'
assert p.lang=='es'
assert all(x in p.ids for x in p.labels)
for asset in p.assets:
    assert not asset.startswith(('https:','http:')), 'External dependency'
    assert (root/'public'/asset.split('?')[0].lstrip('/')).is_file(),asset
js=(root/'public/app.mjs').read_text()
dynamic={'registerIncident'}
used=set(re.findall(r"\$\('([^']+)'\)",js))
assert used<=set(p.ids)|dynamic, f'Missing IDs: {used-set(p.ids)-dynamic}'
manifest=json.loads((root/'.openai/hosting.json').read_text())
assert 'static' not in manifest and manifest['d1']=='DB'
assert manifest['project_id']
css=(root/'public/styles.css').read_text()
assert css.count('{')==css.count('}'), 'Unbalanced CSS'
assert '@media(max-width:560px)' in css
assert ':focus-visible' in css and '[hidden]' in css
html=(root/'public/cnc.html').read_text()
assert 'Santiago Javier Caipo Nuñez' in html and 'Carlos Daniel' not in html
assert 'imad-logo.png' in html
print(f'Static checks passed: {len(p.ids)} unique IDs, {len(p.assets)} local assets, labels, script bindings, responsive CSS and hosting manifest.')
