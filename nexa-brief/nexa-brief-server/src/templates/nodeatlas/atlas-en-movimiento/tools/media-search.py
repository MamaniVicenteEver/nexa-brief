import json,sys,urllib.parse,urllib.request,time,re
UA='AtlasEnMovimiento/1.0 (documental educativo)'
def api(**p):
    for i in range(5):
        try:
            time.sleep(1.2)
            r=urllib.request.Request('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode({'format':'json',**p}),headers={'User-Agent':UA})
            return json.loads(urllib.request.urlopen(r,timeout=40).read())
        except Exception as e: time.sleep(8*(i+1))
for q in sys.argv[1:]:
    j=api(action='query',generator='search',gsrnamespace=6,gsrlimit=8,gsrsearch=q,prop='imageinfo',iiprop='size|mime|extmetadata')
    print('##',q)
    for p in sorted(j.get('query',{}).get('pages',{}).values(),key=lambda x:x.get('index',0)):
        ii=(p.get('imageinfo') or [{}])[0];m=ii.get('extmetadata',{})
        print(' ',p['title'],ii.get('width'),'x',ii.get('height'),'|',re.sub('<[^>]*>','',m.get('LicenseShortName',{}).get('value','')))
