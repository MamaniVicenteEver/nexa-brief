import json, statistics as st, sys
def rep(path, label):
    D = json.load(open(path)); fr = [f for f in D["fr"] if f[1] > 1]
    allf = {}
    for a, d, au, pa in D["fr"]:
        if pa == 0 and au > 0.5: allf[round(a, 2)] = au
    ts = sorted(allf.items()); dn = [b[0]-a[0] for a, b in zip(ts, ts[1:])]; da = [(b[1]-a[1])*1000 for a, b in zip(ts, ts[1:])]
    tr = D.get("trace") or []
    if tr:
        tr = [x for x in tr if x[1] > 0.5]; dn = [b[0]-a[0] for a, b in zip(tr, tr[1:])]; da = [(b[1]-a[1])*1000 for a, b in zip(tr, tr[1:])]
    v = [x/y for x, y in zip(da, dn) if 8 < y < 100]
    long_ = [(round(au, 1), round(d)) for a, d, au, pa in fr if d > 60]
    print(f"{label:9s} | velocidad del tiempo: desv.típ. {st.pstdev(v):.2f} · fuera de 0.6–1.5×: {100*sum(1 for x in v if x<0.6 or x>1.5)/len(v):4.1f} % | render>60 ms: {len(long_):2d}  >100 ms: {sum(1 for x in long_ if x[1]>100):2d}  max {max(d for _,d,_,_ in [(0,f[1],0,0) for f in fr]):5.0f} ms")
    if long_: print("          pausas (audio s, ms):", long_[:12])
rep(sys.argv[1], sys.argv[3]); rep(sys.argv[2], sys.argv[4])
