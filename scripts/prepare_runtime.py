"""One-time local voice runtime installation, owned and launched by tibe."""
from pathlib import Path
import os
import subprocess
import sys
import venv

ROOT=Path(__file__).resolve().parent.parent

def main():
    directory=ROOT/'.runtime/voice-env'
    python=directory/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
    if not python.is_file() or not (directory/'pyvenv.cfg').is_file():venv.EnvBuilder(with_pip=True).create(directory)
    check=subprocess.run([str(python),'-c','import vieneu,onnxruntime,soundfile,ml_dtypes,google.protobuf'],capture_output=True)
    if check.returncode:
        subprocess.run([str(python),'-m','ensurepip','--upgrade'],check=True)
        subprocess.run([str(python),'-m','pip','install','--disable-pip-version-check','-r',str(ROOT/'requirements-voice.txt')],check=True)
    subprocess.run([str(python),str(ROOT/'scripts/install_onnx_compat.py')],check=True)
    return python

if __name__=='__main__':main()
