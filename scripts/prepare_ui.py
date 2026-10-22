"""Keep the standalone HTML in sync with the existing Flask template."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if __name__ == '__main__':
    (ROOT / 'ClipCut_Studio_Standalone.html').write_bytes((ROOT / 'templates/index.html').read_bytes())
    print('Standalone UI synchronized.')
