import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('backup',Path(__file__).parents[1]/'scripts'/'backup-history.py')
backup=importlib.util.module_from_spec(spec);spec.loader.exec_module(backup)

class BackupTest(unittest.TestCase):
    def test_visible_events_only_and_repeated_user_messages(self):
        rows=[{'type':'session_meta','payload':{'id':'task'}},
              {'type':'event_msg','payload':{'type':'item_completed','item':{'type':'Reasoning','id':'r','raw_content':'PRIVATE'}}}]
        for mid in ('a','a','b'):
            rows.append({'type':'event_msg','timestamp':'2026-10-17','payload':{'type':'item_completed','item':{'type':'UserMessage','id':mid,'content':[{'type':'text','text':'继续'}]}}})
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'log.jsonl'
            path.write_text('\n'.join(json.dumps(x) for x in rows)+'\n'+ '{"unfinished":',encoding='utf-8')
            result=backup.parse_local(path)
        self.assertEqual([m['text'] for m in result['messages']],['继续','继续'])
        self.assertNotIn('PRIVATE',backup.render(result))

    def test_message_id_merge_preserves_verbatim_and_longer_copy(self):
        original=[{'id':'1','text':'逐字原文\n换行，保留。'}]
        merged=backup.merge_messages(original,[{'id':'1','text':'逐字'}, {'id':'2','text':'逐字'}])
        self.assertEqual(merged[0],original[0])
        self.assertEqual(len(merged),2)

    def test_paginated_api_history_oldest_first(self):
        def page(ids):
            return {'thread':{'id':'t','kind':'chatgpt','title':'聊天'},'turns':[{'id':x,'startedAt':1,'items':[{'type':'agentMessage','id':x,'text':x}]} for x in ids]}
        result=backup.parse_pages([page(['4','3']),page(['2','1'])])
        self.assertEqual([m['id'] for m in result['messages']],['1','2','3','4'])
        self.assertIn('不能视作完整历史',result['coverage'])

    def test_same_source_web_and_api_merge_once_without_losing_metadata(self):
        a={'id':'t','source':'chatgpt','messages':[{'id':'m','text':'完整原文','timestamp':123}],'errors':[]}
        b={'id':'t','source':'chatgpt','messages':[{'id':'m','text':'原文','attachments':[{'reference':'source-link'}]}],'errors':[],'coverage':'web'}
        records=backup.combine_records([a,b])
        self.assertEqual(len(records),1)
        merged=backup.merge_messages(a['messages'],records[0]['messages'])
        self.assertEqual(merged[0]['text'],'完整原文')
        self.assertEqual(merged[0]['timestamp'],123)
        self.assertEqual(merged[0]['attachments'],[{'reference':'source-link'}])

if __name__=='__main__':unittest.main()
