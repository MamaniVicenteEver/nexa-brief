"""The browser must request the chosen revision and known production config directly."""
import json
from pathlib import Path
import subprocess

import pytest

LOADER = Path(__file__).resolve().parents[2] / 'src/templates/_tools/explainer-kit/engine/loader.js'


@pytest.mark.parametrize('pathname,search,expected', [
    ('/api/v1/explainer/files/productions/nodetech/episode/index.html', '', 'assets/config.json'),
    ('/productions/nodetech/another-episode/index.html', '?edition=pt-BR&revision=rev-002',
     'assets/config.json?edition=pt-BR&revision=rev-002'),
    ('/productions/nodetech/episode/index.html', '?edition=en-US&revision=rev-005',
     'assets/config.json?edition=en-US&revision=rev-005'),
    ('/nodetech/legacy/index.html', '', 'config.json'),
])
def test_loader_resolves_profile_config_and_exact_native_revision(pathname, search, expected):
    # Stop at configuration discovery. An unresolved promise has no active Node
    # handles, so this cannot start playback, a browser, a server or network I/O.
    script = r'''
const fs = require('node:fs'), vm = require('node:vm');
const input = JSON.parse(fs.readFileSync(0, 'utf8')), calls = [];
const document = {currentScript: {src:'http://test/_tools/explainer-kit/engine/loader.js',
  dataset:{design:'rough'},hasAttribute:()=>false}};
vm.runInNewContext(input.source, {document,location:{pathname:input.pathname,search:input.search},
  window:{},URLSearchParams,fetch:(url)=>{calls.push(url);return new Promise(()=>{});}});
process.stdout.write(JSON.stringify(calls));
'''
    result = subprocess.run(['node', '-e', script], input=json.dumps({
        'source': LOADER.read_text(), 'pathname': pathname, 'search': search}),
        text=True, capture_output=True, check=True, timeout=10)
    calls = json.loads(result.stdout)
    assert calls[0] == expected
    assert 'config.json' not in calls if pathname.startswith('/productions/') else True
