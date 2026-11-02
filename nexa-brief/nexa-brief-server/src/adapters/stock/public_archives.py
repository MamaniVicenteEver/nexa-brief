"""Adaptadores acotados de fotos públicas NASA y Library of Congress para imágenes."""
from __future__ import annotations
import re
import httpx
from src.core.ports.stock_media_port import StockMediaPort, StockItem


class NASAImagesAdapter(StockMediaPort):
    name = 'nasa'
    kinds = frozenset({'image'})
    download_hosts = ('images-assets.nasa.gov',)
    configured = True

    async def search(self, query, kind, *, orientation=None, page=1, per_page=6):
        if kind != 'image': return []
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get('https://images-api.nasa.gov/search', params={'q':query, 'media_type':'image', 'page_size':min(per_page,6), 'page':page})
            r.raise_for_status()
        result=[]
        for row in r.json().get('collection',{}).get('items',[]):
            data=(row.get('data') or [{}])[0]
            description=data.get('description','')
            credit=str(data.get('photographer') or data.get('credit') or 'NASA')
            # NASA aloja material de terceros; una búsqueda no concede derechos sobre él.
            if data.get('copyright') or re.search(r'©|copyright|courtesy|used with permission', description+' '+credit, re.I): continue
            if credit != 'NASA' and not credit.upper().startswith(('NASA/', 'NASA ')): continue
            url=next((x['href'] for x in row.get('links',[]) if x.get('rel')=='preview'), '')
            if not self.accepts_download_url(url): continue
            result.append(StockItem(provider=self.name,provider_id=data['nasa_id'],kind='image',title=data.get('title',''),description=description,
                preview_url=url,download_url=url,width=1200,height=800,author=credit,source_url='https://images.nasa.gov/details/'+data['nasa_id'],
                license='Public domain',license_url='https://www.nasa.gov/nasa-brand-center/images-and-media/',attribution=credit+' · Public domain'))
        return result


class LibraryCongressPhotosAdapter(StockMediaPort):
    name = 'loc'
    kinds = frozenset({'image'})
    download_hosts = ('tile.loc.gov','cdn.loc.gov','loc.gov')
    configured = True

    async def search(self, query, kind, *, orientation=None, page=1, per_page=6):
        if kind != 'image': return []
        async with httpx.AsyncClient(timeout=15,follow_redirects=True) as client:
            r=await client.get('https://www.loc.gov/photos/',params={'q':query,'fo':'json','c':min(per_page,6),'sp':page})
            r.raise_for_status()
        result=[]
        for row in r.json().get('results',[]):
            rights=row.get('rights') or row.get('rights_information') or []
            rights=' '.join(rights) if isinstance(rights,list) else str(rights)
            date=str(row.get('date') or '')
            # Exigir una declaración pública explícita y fecha histórica, no suponer
            # que todo lo conservado por LOC es de dominio público.
            if not re.search(r'no known restrictions|public domain',rights,re.I): continue
            if not date[:4].isdigit() or int(date[:4]) > 1930: continue
            urls=row.get('image_url') or []
            url=next((u.replace('http://','https://') for u in reversed(urls) if self.accepts_download_url(u.replace('http://','https://'))),'')
            if not url: continue
            author='; '.join(row.get('contributor') or ['Library of Congress'])
            result.append(StockItem(provider=self.name,provider_id=str(row.get('id')),kind='image',title=row.get('title',''),
                description=' '.join(row.get('description') or [])+' '+date,preview_url=url,download_url=url,width=1200,height=800,
                author=author,source_url=row['id'].replace('http://','https://'),license='Public domain',
                license_url='https://www.loc.gov/pictures/rights-and-access/',attribution=author+' · Public domain'))
        return result
