// src/pages/inventory/index.tsx
import { useState } from 'react';
import { Layout, Topbar } from '../../components/layout';
import { SectionHeader, EmptyState, Pagination, Skeleton, Modal } from '../../components/ui';
import { useApi, useDebounce } from '../../hooks/useApi';
import { productsApi } from '../../api/client';
import { Product } from '../../types';
import clsx from 'clsx';

function Svg({ d, size=16 }:{d:string;size?:number}){return<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>}
const SearchIco  = ({size=16})=><Svg size={size} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z"/>;
const PackageIco = ({size=16})=><Svg size={size} d="M12 2l9 4.9V17l-9 5-9-5V7L12 2z"/>;

type StockFilter = 'ALL' | 'LOW' | 'OUT';

export default function Inventory() {
  const [page,   setPage]   = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('ALL');
  const [selProduct, setSelProduct] = useState<Product | null>(null);
  const dSearch = useDebounce(search, 400);

  const { data, loading } = useApi<{ items: Product[]; meta: any }>(
    () => productsApi.list({ page, limit: 24, search: dSearch }),
    { immediate: true }
  );

  // client-side stock filter
  const items = (data?.items || []).filter(p => {
    if (filter === 'LOW') return p.stock > 0 && p.stock <= 10;
    if (filter === 'OUT') return p.stock === 0;
    return true;
  });

  return (
    <Layout>
      <Topbar title="Inventario" subtitle={`${data?.meta?.total || 0} productos registrados`} />
      <div className="flex-1 p-8 page-enter">
        {/* Filters bar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"><SearchIco size={14}/></span>
            <input className="input pl-9" placeholder="SKU, nombre, categoría…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} />
          </div>
          {(['ALL','LOW','OUT'] as StockFilter[]).map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className={clsx('px-3 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-wider border transition-all',
                filter===f?'bg-gold text-ink border-gold':'bg-ink-3 text-muted-2 border-white/8 hover:border-white/15')}>
              {f==='ALL'?'Todos':f==='LOW'?'Stock Bajo':'Sin Stock'}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-4 gap-4">
            {Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-64"/>)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<PackageIco size={22}/>} title="Sin productos" message="No se encontraron productos con los filtros aplicados." />
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {items.map(p => (
              <div key={p.id} className="card card-hover cursor-pointer overflow-hidden" onClick={()=>setSelProduct(p)}>
                <div className="aspect-square bg-ink-3 relative overflow-hidden">
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover grayscale-[20%] hover:grayscale-0 transition-all duration-500" />
                    : <div className="w-full h-full flex items-center justify-center text-muted"><PackageIco size={32}/></div>
                  }
                  <div className={clsx('absolute top-2 right-2 px-2 py-0.5 rounded font-mono text-[9px] font-bold',
                    p.stock === 0 ? 'bg-danger text-white' : p.stock <= 10 ? 'bg-warn text-ink' : 'bg-ok text-ink')}>
                    {p.stock} u.
                  </div>
                </div>
                <div className="p-4">
                  <div className="label-mono mb-1">{p.sku}</div>
                  <div className="font-display text-[14px] text-cream leading-tight mb-2">{p.name}</div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] text-muted-2">{p.color} · {p.size}</span>
                    <span className="font-mono text-[10px] text-gold">${Number(p.price).toLocaleString()}</span>
                  </div>
                  {p.zones?.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {p.zones.slice(0,3).map(z=>(
                        <span key={z} className="px-1.5 py-0.5 bg-ink-4 border border-white/5 rounded text-[8px] font-mono text-muted-2">{z}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={data?.meta?.totalPages || 1} onChange={setPage} />
      </div>

      <Modal open={!!selProduct} onClose={()=>setSelProduct(null)} title={selProduct?.name||''} size="md">
        {selProduct && <ProductDetail product={selProduct} />}
      </Modal>
    </Layout>
  );
}

function ProductDetail({ product }: { product: Product }) {
  const { data } = useApi<Product>(() => productsApi.get(product.id));
  const p = data || product;
  return (
    <div className="space-y-4">
      {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-full aspect-video object-cover rounded-xl" />}
      <div className="grid grid-cols-2 gap-3">
        {[['SKU',p.sku],['Marca',p.brand],['Categoría',p.category||'—'],['Color',p.color||'—'],['Talla',p.size||'—'],['Precio',`$${Number(p.price).toLocaleString()}`]].map(([l,v])=>(
          <div key={l} className="bg-ink-3 rounded-lg p-3"><div className="label-mono mb-1">{l}</div><div className="font-mono text-[11px] text-cream">{v}</div></div>
        ))}
      </div>
      <div className="bg-ink-3 rounded-xl p-4">
        <div className="label-mono mb-2">Stock Actual (tags RFID activos)</div>
        <div className={clsx('font-display text-4xl font-light', p.stock===0?'text-red-400':p.stock<=10?'text-warn':'text-ok')}>
          {p.stock} <span className="text-xl text-muted-2">unidades</span>
        </div>
        {p.zones?.length>0 && <div className="label-mono mt-2">Zonas: {p.zones.join(', ')}</div>}
      </div>
      {p.description && <p className="font-mono text-[10px] text-muted-2 leading-relaxed">{p.description}</p>}
    </div>
  );
}
