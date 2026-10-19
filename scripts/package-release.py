"""Package only the reviewed public manifest; never walk a user's data folder."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
manifest = json.loads((root / 'PUBLIC-FILES.json').read_text(encoding='utf-8'))
names = [item['path'] for item in manifest['files']] + ['PUBLIC-FILES.json']
out = root / 'dist'
out.mkdir(exist_ok=True)
for item in manifest['files']:
    candidate = (root / item['path']).resolve()
    if not candidate.is_relative_to(root) or not candidate.is_file():
        raise ValueError('Invalid manifest path')
    if hashlib.sha256(candidate.read_bytes()).hexdigest() != item['sha256']:
        raise ValueError('Manifest hash differs: ' + item['path'])
with zipfile.ZipFile(out / ('Venus-' + version + '-source.zip'), 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in names:
        archive.write(root / name, 'Venus-' + version + '/' + name)
with zipfile.ZipFile(out / 'Venus-English-Screenshots.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in names:
        if name.startswith('docs/images/0.6.0/') and Path(name).name[:2].isdigit() and name.endswith(('.jpg', '.png')):
            archive.write(root / name, Path(name).name)
print(json.dumps({'version': version, 'files': len(names), 'assets': sorted(p.name for p in out.glob('*.zip'))}))
