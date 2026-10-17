import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('chat_import', Path(__file__).parents[1]/'scripts'/'import-chatgpt.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def conversation():
    return {'id':'conversation-1', 'title':'中文标题 / 同名', 'create_time':1790000000,
            'current_node':'answer', 'mapping':{
        'user':{'parent':None, 'message':{'author':{'role':'user'}, 'create_time':1790000001, 'content':{'parts':['原文\r\n保留换行与 `代码`']}}},
        'answer':{'parent':'user','message':{'author':{'role':'assistant'}, 'create_time':1790000002, 'content':{'parts':['回答文字', {'asset_pointer':'file-1'}]}}},
        'alternative':{'parent':'user','message':{'author':{'role':'assistant'}, 'create_time':1790000003, 'content':{'parts':['其他分支原文']}}},
        'later':{'parent':'answer','message':{'author':{'role':'user'}, 'create_time':1792195200, 'content':{'parts':['今天的内容必须排除']}}},
    }}

class ImportTests(unittest.TestCase):
    def test_all_branches_and_exact_text_before_cutoff(self):
        result = module.convert(conversation())
        self.assertEqual(result['messageCount'],3)
        self.assertIn('原文\r\n保留换行与 `代码`',result['body'])
        self.assertIn('## 其他分支',result['body'])
        self.assertIn('其他分支原文',result['body'])
        self.assertIn('file-1',result['body'])
        self.assertNotIn('今天的内容必须排除',result['body'])

    def test_zip_read_without_extracting_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)/'export.zip'
            with zipfile.ZipFile(target,'w') as z:
                z.writestr('conversations.json',json.dumps([conversation()]))
                z.writestr('../must-not-extract.txt','untrusted')
            self.assertEqual(len(module.load_export(target)),1)
            self.assertEqual(len(list(Path(directory).iterdir())),1)

    def test_deterministic_identity_and_same_title_distinct(self):
        first = module.convert(conversation())
        self.assertEqual(first,module.convert(conversation()))
        other = conversation(); other['id']='conversation-2'
        self.assertNotEqual(first['name'],module.convert(other)['name'])

    def test_sharded_export_and_empty_conversation(self):
        empty={'id':'empty','title':'New chat','create_time':1790000000,'mapping':{'root':{'message':None}}}
        with tempfile.TemporaryDirectory() as directory:
            target=Path(directory)/'export.zip'
            with zipfile.ZipFile(target,'w') as z:
                z.writestr('conversations-000.json',json.dumps([conversation()]))
                z.writestr('conversations-001.json',json.dumps([empty]))
            self.assertEqual(len(module.load_export(target)),2)
        result=module.convert(empty)
        self.assertEqual(result['messageCount'],0)
        self.assertIn('空对话记录',result['body'])

    def test_no_recent_summary_as_full_export(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)/'summary.json'
            target.write_text(json.dumps([{'id':'x','turns':[]}]))
            with self.assertRaises(ValueError): module.load_export(target)

    def test_unknown_dates_and_cycles_rejected(self):
        c = conversation(); c.pop('create_time'); c['mapping']['user']['message'].pop('create_time')
        with self.assertRaises(ValueError): module.convert(c)
        c = conversation(); c['mapping']['user']['parent']='answer'
        with self.assertRaises(ValueError): module.convert(c)

if __name__ == '__main__': unittest.main()
