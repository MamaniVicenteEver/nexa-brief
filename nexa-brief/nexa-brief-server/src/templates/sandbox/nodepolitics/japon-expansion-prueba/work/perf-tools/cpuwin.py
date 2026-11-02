import json, sys
from collections import defaultdict
D = json.load(open(sys.argv[1])); prof = D["prof"]; fr = D["fr"]; p0 = D["p0"]; LIM = float(sys.argv[2]) if len(sys.argv) > 2 else 120
nodes = {n["id"]: n for n in prof["nodes"]}; parent = {}
for n in prof["nodes"]:
    for c in n.get("children", []): parent[c] = n["id"]
def name(n): cf = n["callFrame"]; return f'{cf["functionName"] or "(anon)"} {cf["url"].split("/")[-1]}:{cf["lineNumber"]+1}'
t = prof["startTime"]; ts = []
for d in prof["timeDeltas"]: t += d; ts.append(t)
# alinear: primera muestra ≈ p0
off = p0 - (prof["startTime"] / 1000)
print("fotogramas largos (> %d ms):" % LIM)
for a, d, au in fr:
    if d < LIM: continue
    lo, hi = a - off, a + d - off
    selfms = defaultdict(float); incl = defaultdict(float)
    for s, tt, dl in zip(prof["samples"], ts, prof["timeDeltas"]):
        tm = tt / 1000
        if lo <= tm <= hi:
            ms = dl / 1000; selfms[name(nodes[s])] += ms; seen = set(); cur = s
            while cur is not None:
                nm = name(nodes[cur])
                if nm not in seen: incl[nm] += ms; seen.add(nm)
                cur = parent.get(cur)
    print(f"\n== audio {au:.2f}s · fotograma de {d:.0f} ms")
    for k, v in sorted(selfms.items(), key=lambda x: -x[1])[:4]: print(f"   self {v:6.0f} ms  {k}")
    shown = 0
    for k, v in sorted(incl.items(), key=lambda x: -x[1]):
        if any(x in k for x in ("_imperio", "japon", "scenes", "kit.js", "intros", "type.js")) and "frame kit" not in k and "render kit" not in k:
            print(f"   incl {v:6.0f} ms  {k}"); shown += 1
            if shown >= 6: break
