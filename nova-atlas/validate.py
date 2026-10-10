"""Valida esquema e URLs antes de gerar ou publicar o site."""
import datetime
import json
from pathlib import Path
from urllib.parse import urlsplit

p = Path(__file__).resolve().parent

def require(condition, message):
    if not condition:
        raise ValueError(message)

def check_url(value):
    require(isinstance(value, str), 'URL deve ser string')
    parsed = urlsplit(value)
    require(parsed.scheme in ['http', 'https'] and bool(parsed.hostname), 'URL HTTP/HTTPS inválida: ' + value)
    require(not parsed.username and not parsed.password, 'Não use credenciais nas URLs')
    require(not any(ord(c) < 32 for c in value), 'URL contém caracteres de controle')

data = json.loads((p / 'catalog.json').read_text(encoding='utf-8'))
require(isinstance(data, dict) and isinstance(data.get('items'), list), 'Catálogo inválido')
require(isinstance(data.get('updated'), str), 'updated deve ser string')
datetime.date.fromisoformat(data['updated'])
require(len(data['updated']) == 10, 'Use updated no formato AAAA-MM-DD')
ids = set()
for x in data['items']:
    require(isinstance(x, dict), 'Item deve ser objeto')
    require(all(k in x for k in ['id', 'title', 'category', 'urls', 'description', 'sources', 'notes', 'kind', 'pending']), 'Item com campos ausentes')
    require(all(isinstance(x[k], str) for k in ['id', 'title', 'category', 'description']), 'Campos textuais inválidos')
    require(bool(x['id']) and x['id'] not in ids, 'ID ausente ou duplicado')
    ids.add(x['id'])
    require(bool(x['title'].strip()) and bool(x['category'].strip()), 'Título/categoria vazios')
    require(x['kind'] in ['resource', 'source'] and isinstance(x['pending'], bool), 'kind/pending inválidos')
    require(all(isinstance(x[k], list) for k in ['urls', 'sources', 'notes']), 'URLs, sources e notes devem ser listas')
    require(bool(x['urls']), 'Item sem URL')
    require(all(isinstance(n, str) for n in x['notes']), 'Notas devem ser strings')
    for u in x['urls'] + x['sources']:
        check_url(u)
for f in ['index.html', 'styles.css', 'app.js', 'hero.png', '.nojekyll']:
    require((p / f).is_file(), 'Arquivo ausente: ' + f)
secret_patterns = ['github' + '_pat_', 'gh' + 'p_', 'BEGIN ' + 'PRIVATE KEY']
for file in p.rglob('*'):
    if file.is_file() and file.suffix in ['.html', '.js', '.json', '.css', '.md', '.py', '.yml'] and '.git' not in file.parts:
        contents = file.read_text(encoding='utf-8')
        require(not any(pattern in contents for pattern in secret_patterns), 'Possível segredo em ' + str(file.relative_to(p)))
print('PASS:', len(ids), 'registros;', len({x['category'] for x in data['items']}), 'categorias; esquema/URLs válidos; padrões de credenciais não encontrados.')
