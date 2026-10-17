"""Convert an explicitly supplied ChatGPT export; never scrape browser profiles."""
import argparse
import hashlib
import json
import re
import zipfile
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen

DEFAULT_BEFORE = '2026-10-16T00:00:00+11:00'

def load_export(source):
    source = Path(source)
    if zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as archive:
            matches = [n for n in archive.namelist() if n.rsplit('/', 1)[-1] == 'conversations.json']
            shards = [n for n in archive.namelist() if re.fullmatch(r'conversations-\d+\.json', n.rsplit('/', 1)[-1])]
            if len(matches) > 1 or (matches and shards):
                raise ValueError('ZIP 中有冲突的对话数据文件，需先核对')
            if shards:
                shards.sort(key=lambda n:int(re.search(r'-(\d+)\.json$',n).group(1)))
                numbers = [int(re.search(r'-(\d+)\.json$',n).group(1)) for n in shards]
                if numbers != list(range(len(shards))):
                    raise ValueError('对话分卷编号不连续或重复')
            matches = matches or shards
            if not matches:
                raise ValueError('ZIP 内未找到 conversations.json 或 conversations-000.json 分卷')
            # Read one member in memory; never extract untrusted archive paths.
            data = []
            for member in matches:
                chunk = json.loads(archive.read(member).decode('utf-8-sig'))
                if not isinstance(chunk, list):
                    raise ValueError('对话数据须为数组')
                data.extend(chunk)
    else:
        data = json.loads(source.read_text(encoding='utf-8-sig'))
    if not isinstance(data, list) or not all(isinstance(c, dict) and isinstance(c.get('mapping'), dict) for c in data):
        raise ValueError('需要 ChatGPT 导出的完整 conversations.json；不接受聊天摘要或最近几轮的读取结果')
    return data

def stamp(value):
    return datetime.fromtimestamp(float(value), tz=datetime.fromisoformat(DEFAULT_BEFORE).tzinfo).isoformat() if value is not None else '时间未提供'

def fenced(value):
    text = json.dumps(value, ensure_ascii=False, indent=2)
    fence = '`' * max(3, max((len(x) for x in re.findall(r'`+', text)), default=0) + 1)
    return f'{fence}json\n{text}\n{fence}'

def convert(conversation, before=DEFAULT_BEFORE):
    boundary = datetime.fromisoformat(before)
    if boundary.tzinfo is None:
        raise ValueError('截止时间必须包含时区')
    cutoff = boundary.timestamp()
    mapping = conversation['mapping']
    main_ids, current = set(), conversation.get('current_node')
    while current and current in mapping:
        if current in main_ids:
            raise ValueError('对话分支存在循环')
        main_ids.add(current)
        current = mapping[current].get('parent')
    eligible, unknown = [], []
    for node_id, node in mapping.items():
        message = node.get('message')
        if not message:
            continue
        timestamp = message.get('create_time')
        if timestamp is None:
            timestamp = conversation.get('create_time')
        if timestamp is None:
            unknown.append(node_id)
            continue
        if float(timestamp) < cutoff:
            eligible.append((float(timestamp), node_id, node, message))
    if unknown:
        raise ValueError('存在无消息时间且无对话创建时间的记录，无法可靠按日期过滤：'+','.join(unknown))
    empty_conversation = not any(n.get('message') for n in mapping.values())
    if not eligible and not (empty_conversation and conversation.get('create_time') is not None and float(conversation['create_time']) < cutoff):
        return None
    identifier = str(conversation.get('id') or conversation.get('conversation_id') or '')
    if not identifier:
        raise ValueError('对话缺少稳定 ID')
    title = str(conversation.get('title') or '未命名对话')
    lines = [f'# {title}', '', f'- ChatGPT 对话 ID：{identifier}',
             f'- 来源：https://chatgpt.com/c/{identifier}', f'- 消息范围：{before} 之前',
             '- 内容范围：导出文件中的文字及内容结构；图片、语音和文件保留引用，不代表附件二进制已迁入。',
             '- 分支规则：保留导出文件所有符合日期的消息；主分支和其他分支明确区分，不拼接成同一路径。', '']
    if empty_conversation:
        lines.extend(['此对话在导出文件中没有消息（空对话记录）。', ''])
    for section, predicate in [('主分支', lambda n: n in main_ids), ('其他分支', lambda n: n not in main_ids)]:
        records = [r for r in sorted(eligible, key=lambda r:(r[0], r[1])) if predicate(r[1])]
        if not records:
            continue
        lines.extend([f'## {section}', ''])
        for timestamp, node_id, node, message in records:
            role = message.get('author', {}).get('role', 'unknown')
            lines.extend([f'### {role} · {stamp(timestamp)}', '',
                          f'消息节点：{node_id}；父节点：{node.get("parent") or "无"}', ''])
            content = message.get('content') or {}
            parts = content.get('parts')
            if isinstance(parts, list):
                for part in parts:
                    lines.extend([part if isinstance(part, str) else fenced(part), ''])
                other = {k:v for k,v in content.items() if k not in ('parts', 'content_type')}
                if other:
                    lines.extend([fenced(other), ''])
            else:
                lines.extend([fenced(content), ''])
            metadata = message.get('metadata') or {}
            for key in ('attachments', 'citations', 'content_references'):
                if metadata.get(key):
                    lines.extend([f'来源元数据 · {key}', '', fenced(metadata[key]), ''])
    body = '\n'.join(lines)
    safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', title)[:42]
    safe_id = hashlib.sha256(identifier.encode()).hexdigest()[:16]
    name = f'GPT-{safe_id}-{safe_title}.md'
    return {'id':identifier, 'title':title, 'name':name, 'body':body,
            'messageCount':len(eligible), 'sha256':hashlib.sha256(body.encode()).hexdigest()}

def request(route, data=None):
    body = None if data is None else json.dumps(data, ensure_ascii=False).encode()
    req = Request('http://127.0.0.1:10001/api/'+route, data=body,
                  headers={'Content-Type':'application/json'})
    with urlopen(req, timeout=60) as response:
        return json.load(response)

def main():
    parser = argparse.ArgumentParser(description='ChatGPT 导出 ZIP/JSON → 每对话一个 MD → Venus')
    parser.add_argument('source', type=Path)
    parser.add_argument('--before', default=DEFAULT_BEFORE)
    parser.add_argument('--output', type=Path, default=Path('work/chatgpt-markdown'))
    parser.add_argument('--import-vault', action='store_true', help='验证转换后实际写入 Venus')
    args = parser.parse_args()
    data = load_export(args.source)
    args.output.mkdir(parents=True, exist_ok=True)
    report = {'source':str(args.source.resolve()), 'before':args.before, 'totalConversations':len(data),
              'converted':[], 'excluded':[], 'errors':[], 'imported':0, 'duplicates':0}
    if args.import_vault and Path(request('state?summary=1').get('root', '')).resolve() != (Path(__file__).resolve().parent.parent / 'data').resolve():
        raise ValueError('Venus 资料库身份不符，未写入')
    seen = set()
    for conversation in data:
        identifier = conversation.get('id') or conversation.get('conversation_id')
        try:
            record = convert(conversation, args.before)
            if record is None:
                report['excluded'].append(identifier)
                continue
            if record['id'] in seen:
                raise ValueError('导出中存在重复对话 ID，需先核对')
            seen.add(record['id'])
            target = args.output / record['name']
            target.write_bytes(record['body'].encode('utf-8'))
            if hashlib.sha256(target.read_bytes()).hexdigest() != record['sha256']:
                raise ValueError('写入后校验失败')
            if args.import_vault:
                result = request('import', {'name':record['name'], 'body':record['body']})
                if result['node']['body'] != record['body']:
                    raise ValueError('Vault 读回内容不一致')
                report['duplicates' if result.get('duplicate') else 'imported'] += 1
                record['vaultId'] = result['node']['id']
                record['vaultPath'] = result['node']['path']
            report['converted'].append({k:v for k,v in record.items() if k != 'body'})
        except Exception as error:
            report['errors'].append({'id':identifier, 'error':str(error)})
        (args.output/'import-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k:(len(v) if isinstance(v,list) else v) for k,v in report.items()}, ensure_ascii=False, indent=2))
    return 1 if report['errors'] else 0

if __name__ == '__main__':
    raise SystemExit(main())
