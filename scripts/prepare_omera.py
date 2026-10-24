"""Prepare the pinned native Canvas dependency without blocking the editor."""
from pathlib import Path
import os
import shutil
import subprocess


def prepare(root):
    bundled = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
    node = os.environ.get('CLIPCUT_NODE') or (str(bundled) if bundled.is_file() else shutil.which('node'))
    if not node:
        print('Omera Batch: can Node.js 22.19+, 24.11+ hoac 26+. Editor van san sang.', flush=True)
        return False
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    check = [node, '-e', "require('@napi-rs/canvas').createCanvas(2,2)"]
    if subprocess.run(check, cwd=root, capture_output=True, creationflags=flags).returncode == 0:
        return True
    npm = shutil.which('npm.cmd') or shutil.which('npm')
    candidates = [Path(node).parent / 'node_modules/npm/bin/npm-cli.js',
                  Path(node).parent.parent / 'lib/node_modules/npm/bin/npm-cli.js']
    if npm:
        candidates.append(Path(npm).parent / 'node_modules/npm/bin/npm-cli.js')
    candidates.append(Path(os.environ.get('ProgramFiles', 'C:/Program Files')) / 'nodejs/node_modules/npm/bin/npm-cli.js')
    cli = next((path for path in candidates if path.is_file()), None)
    if not cli:
        print('Omera Batch: chua co npm. Cai Node.js LTS va mo lai MỞ TIBE.bat.', flush=True)
        return False
    directory = root / '.runtime'
    directory.mkdir(exist_ok=True)
    print('Omera Batch: dang chuan bi bo ve lan dau; xem .runtime/omera-setup.log.', flush=True)
    try:
        with (directory / 'omera-setup.log').open('w', encoding='utf-8') as log:
            result = subprocess.run([node, str(cli), 'ci', '--omit=dev', '--no-audit', '--no-fund'],
                cwd=root, stdout=log, stderr=subprocess.STDOUT, timeout=600, creationflags=flags)
        if result.returncode:
            raise RuntimeError('npm ci failed')
        subprocess.run(check, cwd=root, capture_output=True, check=True, timeout=30, creationflags=flags)
        print('Omera Batch: bo ve da san sang.', flush=True)
        return True
    except (OSError, subprocess.SubprocessError, RuntimeError) as error:
        print('Omera Batch: chua chuan bi xong: ' + str(error) + '. Xem .runtime/omera-setup.log.', flush=True)
        return False
