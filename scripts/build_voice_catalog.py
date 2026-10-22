"""Cache the actual Edge voice catalogue for built-in language choices."""
from pathlib import Path
import asyncio
import json
import sys
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'.runtime/python'))

async def main():
    import edge_tts
    voices=await asyncio.wait_for(edge_tts.list_voices(),timeout=45)
    result=[{'id':v['ShortName'],'name':v['FriendlyName'],'detail':v['Gender']+' · '+v['Locale'],'locale':v['Locale']} for v in voices]
    (ROOT/'assets/voice-catalog.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Cached actual voice entries:',len(result))

if __name__=='__main__':asyncio.run(main())
