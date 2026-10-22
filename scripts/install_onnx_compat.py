"""Install runtime ONNX files without long, unused backend fixture paths on Windows."""
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT=Path(__file__).resolve().parent.parent

def main():
    try:
        import onnx
        from onnx.external_data_helper import convert_model_from_external_data
        return
    except ImportError:pass
    wheels=ROOT/'.runtime/wheels';wheels.mkdir(parents=True,exist_ok=True)
    subprocess.run([sys.executable,'-m','pip','download','--disable-pip-version-check','--no-deps','--dest',str(wheels),'onnx==1.19.1'],check=True)
    wheel=next(wheels.glob('onnx-1.19.1-*.whl'))
    import sysconfig
    destination=Path(sysconfig.get_path('purelib')).resolve()
    with zipfile.ZipFile(wheel) as archive:
        for entry in archive.infolist():
            if entry.is_dir() or '/backend/test/data/' in entry.filename:continue
            target=(destination/entry.filename).resolve()
            if not target.is_relative_to(destination):raise ValueError('Invalid wheel member.')
            data=archive.read(entry)
            if target.is_file() and target.read_bytes()==data:continue
            target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    print('Installed ONNX runtime files; unused backend fixtures excluded.')

if __name__=='__main__':main()
