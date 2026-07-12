import re, json, sys

# In the raw file, a leading tab is the two-character JSON escape: backslash + 't'.
# Convert  "\t@{EXPR}"  ->  "@EXPR"  (strip the stray tab AND the string-interpolation
# wrapper so decimal/date columns receive a typed expression, not a coerced string).
PATTERN = re.compile(r'\\t@\{([^}]*)\}')  # one backslash, then t, then @{...}

def fix(path):
    txt = open(path, encoding='utf-8').read()
    new, n = PATTERN.subn(r'@\1', txt)
    json.loads(new)  # must still parse
    open(path, 'w', encoding='utf-8', newline='\n').write(new)
    print(f'{path}: {n} replacements, valid JSON')

for p in sys.argv[1:]:
    fix(p)
