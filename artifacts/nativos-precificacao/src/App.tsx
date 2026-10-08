import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Calculator as NewCalculator } from './features/Calculator';
import { Products as NewProducts, Quotes as NewQuotes } from './features/Sales';
import { Stock, ImportPage } from './features/Operations';
import { ExtraSettings, StaleNotice } from './features/Preferences';
import { useData } from './features/shared';
import { parseBrazilianNumber } from '@workspace/pricing-engine';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, Archive, ArrowDownRight, ArrowLeft, ArrowRight, Box, Calculator,
  Check, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, ClipboardList, Clock3,
  Coins, Cpu, FilePlus2, FileText, Info, Layers3, Menu, Moon, Package,
  Plus, Printer, RotateCcw, Save, Settings2, ShieldCheck, Sun, Trash2, TrendingUp,
  Wallet, X, Zap,
} from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter } from 'wouter';
import {
  useArchiveMaterial, useArchivePrinter, useCalculatePricing, useCreateMaterial, useCreatePrinter,
  useCreateProduct, useCreateQuote, useDeleteProduct, useGetDashboard, useGetSettings,
  useListMaterials, useListPrinters, useListProducts, useListQuotes, useSaveSettings,
  useUpdateMaterial, useUpdatePrinter,
  getGetDashboardQueryKey, getGetSettingsQueryKey, getListMaterialsQueryKey,
  getListPrintersQueryKey, getListProductsQueryKey, getListQuotesQueryKey,
} from '@workspace/api-client-react';
import type {
  Calculation, CalculationInput, Material, MaterialInput, MaterialLine, Printer as PrinterRecord,
  PrinterInput, Product, ProductInput, QuoteInput, SettingsInput,
} from '@workspace/api-client-react';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

type Path = '/' | '/calculator' | '/products' | '/materials' | '/printers' | '/quotes' | '/settings' | '/stock' | '/import';
const navItems: { href: Path; label: string; icon: typeof Activity; group?: string }[] = [
  { href: '/', label: 'Visão geral', icon: Activity, group: 'WORKSHOP' },
  { href: '/calculator', label: 'Calculadora', icon: Calculator },
  { href: '/products', label: 'Produtos', icon: Box, group: 'CADASTROS' },
  { href: '/materials', label: 'Materiais', icon: Layers3 },
  { href: '/printers', label: 'Impressoras', icon: Printer },
  { href: '/quotes', label: 'Orçamentos', icon: ClipboardList, group: 'VENDAS' },
  { href: '/stock', label: 'Estoque e produção', icon: Package },
  { href: '/import', label: 'Importar planilha', icon: FilePlus2 },
  { href: '/settings', label: 'Configurações', icon: Settings2, group: 'PREFERÊNCIAS' },
];
const money = (value?: number | null) => value == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const number = (value?: number | null, digits = 1) => value == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value);
const dateLabel = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
const asNum = (value: string) => parseBrazilianNumber(value) ?? NaN;

function Logo({ dark = false }: { dark?: boolean }) {
  return <div className="flex items-center gap-3">
    <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#ff6b00] text-white"><Layers3 size={19} strokeWidth={2.4} /></div>
    <div className="leading-tight"><div className={`wordmark text-[16px] font-extrabold ${dark ? 'text-white' : 'text-[#171d28]'}`}>nativos<span className="text-[#ff6b00]">3D</span></div><div className={`mt-0.5 text-[9px] font-bold tracking-[.17em] ${dark ? 'text-[#7e8797]' : 'text-slate-500'}`}>PRECIFICAÇÃO</div></div>
  </div>;
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem('nativos-theme') === 'dark' || document.documentElement.classList.contains('dark'));
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('nativos-theme', dark ? 'dark' : 'light'); }, [dark]);
  return <button className="btn btn-quiet !p-2" onClick={() => setDark(value => !value)} aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'} data-testid="button-toggle-theme">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>;
}

function Shell({ children, active = '/' }: { children: ReactNode; active?: string }) {
  const branding = useData('/preferences');
  const company = useGetSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="app-shell noise flex">
    <aside className="sidebar fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-white/[.08] px-4 py-6 md:flex">
      <Link href="/" className="mb-9 px-2"><>{branding.data?.logoUrl ? <img src={branding.data.logoUrl} alt={company.data?.companyName || 'Empresa'} className="max-h-12 max-w-full object-contain" /> : <Logo dark />}{company.data?.companyName && <span className="mt-2 block text-xs text-slate-300">{company.data.companyName}</span>}</></Link>
      <div className="mb-3 px-3 text-[9px] font-bold tracking-[.18em] text-[#687184]">OFICINA DIGITAL</div>
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item, index) => <div key={item.href}>
          {item.group && index > 0 && <div className="mb-2 mt-6 px-3 text-[9px] font-bold tracking-[.18em] text-[#687184]">{item.group}</div>}
          <Link href={item.href} className={`nav-link flex items-center gap-3 rounded-lg px-3 py-[10px] text-[13px] font-semibold ${active === item.href ? 'bg-[#1c2637] text-white' : ''}`} data-testid={`link-nav-${item.href.replace('/', 'home')}`}>
            <item.icon size={17} className={active === item.href ? 'text-[#ff7a1a]' : 'text-[#7b8596]'} />{item.label}
            {item.href === '/calculator' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#ff6b00]" />}
          </Link>
        </div>)}
      </nav>
      <div className="mb-3 rounded-xl border border-white/[.08] bg-white/[.035] p-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[#bac2d0]"><ShieldCheck size={15} className="text-[#4e8bff]" />Custos claros. Decisão sua.</div>
        <p className="mb-0 mt-2 text-[10px] leading-relaxed text-[#7e8797]">Estimativas baseadas nos dados da sua produção — não são garantia de venda ou lucro.</p>
      </div>
      <div className="flex items-center gap-2 border-t border-white/[.08] px-1 pt-4">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#27354a] text-[11px] font-bold text-white">N</div>
        <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold text-[#e7eaf0]">Minha oficina</div><div className="truncate text-[10px] text-[#737d8f]">Conta de produção</div></div>
      </div>
    </aside>
    <div className="min-w-0 flex-1 md:ml-[248px]">
      <header className="sticky top-0 z-20 flex h-[62px] items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-md sm:px-7">
        <div className="flex items-center gap-3"><button className="btn btn-quiet !p-2 md:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir navegação" data-testid="button-open-navigation"><Menu size={19} /></button><div className="hidden text-xs text-muted-foreground sm:block">Nativos 3D <ChevronRight size={13} className="mx-1 inline" /> <span className="font-semibold text-foreground">{navItems.find(item => item.href === active)?.label || 'Visão geral'}</span></div><div className="sm:hidden"><Logo /></div></div>
        <div className="flex items-center gap-2"><span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Conta conectada</span><ThemeToggle /></div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 pb-24 pt-7 sm:px-7 md:pb-10 md:pt-9">{children}</main>
    </div>
    {mobileOpen && <div className="fixed inset-0 z-50 bg-black/45 md:hidden" onClick={() => setMobileOpen(false)}><div className="sidebar flex h-full w-[280px] flex-col p-5" onClick={event => event.stopPropagation()}><div className="mb-8 flex items-center justify-between"><Logo dark /><button onClick={() => setMobileOpen(false)} className="text-white" aria-label="Fechar navegação"><X size={19} /></button></div>{navItems.map(item => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`nav-link flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${active === item.href ? 'bg-[#1c2637] text-white' : ''}`}><item.icon size={17} />{item.label}</Link>)}</div></div>}
    <nav className="mobile-nav fixed inset-x-0 bottom-0 z-30 items-center justify-around border-t border-border bg-card px-1 py-2 pb-[max(.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(22,29,41,.06)]">
      {navItems.slice(0, 5).map(item => <Link key={item.href} href={item.href} className={`flex min-w-[54px] flex-col items-center gap-1 py-1 text-[9px] font-semibold ${active === item.href ? 'text-primary' : 'text-muted-foreground'}`}><item.icon size={18} />{item.label}</Link>)}
    </nav>
  </div>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div>{eyebrow && <div className="mb-2 text-[10px] font-bold tracking-[.17em] text-primary">{eyebrow}</div>}<h1 className="display m-0 text-[28px] font-extrabold leading-tight sm:text-[34px]">{title}</h1>{description && <p className="mb-0 mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{description}</p>}</div>{action && <div className="shrink-0">{action}</div>}</div>;
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`card ${className}`}>{children}</section>; }
function CardTitle({ icon: Icon, title, caption, trailing }: { icon?: typeof Activity; title: string; caption?: string; trailing?: ReactNode }) {
  return <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4"><div className="flex items-start gap-3">{Icon && <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon size={16} /></div>}<div><h2 className="m-0 text-[14px] font-bold">{title}</h2>{caption && <p className="mb-0 mt-1 text-[11px] text-muted-foreground">{caption}</p>}</div></div>{trailing}</div>;
}
function Label({ children, help }: { children: ReactNode; help?: string }) { return <label className="mb-1.5 block text-[11px] font-bold text-foreground">{children}{help && <span className="ml-1 font-normal text-muted-foreground">{help}</span>}</label>; }
function InputField({ label, value, onChange, placeholder, type = 'text', unit, min, max, step, help, disabled }: { label: string; value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string; unit?: string; min?: number; max?: number; step?: number | string; help?: string; disabled?: boolean }) {
  return <div><Label help={help}>{label}</Label><div className="relative"><input className={`field ${unit ? 'pr-12' : ''}`} aria-label={label} type={type} value={value} placeholder={placeholder} min={min} max={max} step={step} disabled={disabled} onChange={e => onChange(e.target.value)} />{unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground">{unit}</span>}</div></div>;
}
function SelectField({ label, value, onChange, options, help }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; help?: string }) {
  return <div><Label help={help}>{label}</Label><div className="relative"><select aria-label={label} className="field appearance-none pr-8" value={value} onChange={e => onChange(e.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" /></div></div>;
}
function EmptyState({ icon: Icon, title, description, action }: { icon: typeof Package; title: string; description: string; action?: ReactNode }) {
  return <div className="flex min-h-[250px] flex-col items-center justify-center px-6 py-10 text-center"><div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon size={24} /></div><h3 className="m-0 text-[15px] font-bold">{title}</h3><p className="mb-5 mt-2 max-w-sm text-[12px] leading-relaxed text-muted-foreground">{description}</p>{action}</div>;
}
function LoadingState() { return <div className="space-y-4" aria-label="Carregando"><div className="h-8 w-48 animate-pulse rounded-lg bg-muted" /><div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map(i => <div key={i} className="card h-28 animate-pulse bg-muted/60" />)}</div><div className="card h-56 animate-pulse bg-muted/60" /></div>; }
function ErrorState({ onRetry }: { onRetry: () => void }) { return <div className="card flex flex-col items-start gap-3 p-6"><div className="flex items-center gap-2 font-bold text-destructive"><CircleAlert size={17} />Não foi possível carregar os dados</div><p className="m-0 text-sm text-muted-foreground">Confira sua conexão e tente novamente. Seus registros não foram alterados.</p><button onClick={onRetry} className="btn btn-secondary" data-testid="button-retry"><RotateCcw size={15} />Tentar novamente</button></div>; }
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { ready: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', incomplete: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300', draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', sent: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300', approved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', rejected: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300', expired: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
  const labels: Record<string, string> = { ready: 'Pronto', incomplete: 'Parcial', draft: 'Rascunho', sent: 'Enviado', approved: 'Aprovado', rejected: 'Recusado', expired: 'Expirado' };
  return <span className={`status-pill ${map[status] || 'bg-muted text-muted-foreground'}`}>{labels[status] || status}</span>;
}

function HomePage() {
  const { data, isLoading, isError, refetch } = useGetDashboard();
  return <Shell active="/">
    <StaleNotice />
    {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={() => void refetch()} /> : <>
      <div className="mb-8 flex flex-col justify-between gap-5 rounded-2xl bg-[#111927] px-6 py-7 text-white sm:flex-row sm:items-center sm:px-8 sm:py-8">
        <div className="max-w-xl"><div className="mb-3 flex items-center gap-2 text-[10px] font-bold tracking-[.18em] text-[#9db8eb]"><span className="h-1.5 w-1.5 rounded-full bg-[#ff6b00]" />PAINEL DA OFICINA</div><h1 className="display m-0 text-[27px] font-extrabold leading-[1.12] sm:text-[34px]">Cada pedido começa<br className="hidden sm:block" /> com um custo bem entendido.</h1><p className="mb-0 mt-3 max-w-md text-[12px] leading-relaxed text-[#a5afc0]">Transforme dados reais de produção em uma referência de preço defensável. A decisão final continua sendo sua.</p></div>
        <Link href="/calculator" className="btn btn-primary self-start sm:self-center" data-testid="link-start-calculation"><Calculator size={16} />Nova precificação<ArrowRight size={15} /></Link>
      </div>
      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Produtos salvos', value: data?.productCount, icon: Box, tone: 'blue', href: '/products' },
          { label: 'Materiais', value: data?.materialCount, icon: Layers3, tone: 'orange', href: '/materials' },
          { label: 'Impressoras', value: data?.printerCount, icon: Printer, tone: 'purple', href: '/printers' },
          { label: 'Orçamentos', value: data?.quoteCount, icon: ClipboardList, tone: 'green', href: '/quotes' },
        ].map((stat, index) => <Link href={stat.href} key={stat.label} className="card fade-up flex items-center gap-3 p-4 sm:gap-4 sm:p-5" style={{ animationDelay: `${index * 55}ms` }} data-testid={`card-dashboard-${stat.label.toLowerCase().replace(' ', '-')}`}><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${stat.tone === 'orange' ? 'bg-orange-50 text-[#f27124] dark:bg-orange-950/50' : stat.tone === 'blue' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50' : stat.tone === 'green' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50' : 'bg-violet-50 text-violet-700 dark:bg-violet-950/50'}`}><stat.icon size={19} /></div><div><div className="display text-[24px] font-extrabold leading-none">{stat.value ?? 0}</div><div className="mt-1.5 text-[10px] font-medium text-muted-foreground sm:text-[11px]">{stat.label}</div></div></Link>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Card><CardTitle icon={Box} title="Produtos recentes" caption="Seus snapshots de custo mais recentes" trailing={<Link href="/products" className="text-[11px] font-bold text-primary">Ver produtos <ArrowRight size={13} className="ml-1 inline" /></Link>} />
          {!data?.recentProducts?.length ? <EmptyState icon={Package} title="Ainda não há produtos salvos" description="Quando salvar uma precificação, ela aparecerá aqui para você consultar e revisar." action={<Link href="/calculator" className="btn btn-blue text-[12px]"><Plus size={15} />Calcular um produto</Link>} /> :
            <div className="divide-y divide-border/70">{data.recentProducts.map(product => <div key={product.id} className="flex items-center justify-between gap-4 px-5 py-4" data-testid={`row-recent-product-${product.id}`}><div className="flex min-w-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Box size={16} /></div><div className="min-w-0"><div className="truncate text-[12px] font-bold">{product.name}</div><div className="mt-1 text-[10px] text-muted-foreground">{product.sku || product.category || 'Sem SKU'} · {dateLabel(product.updatedAt)}</div></div></div><div className="flex items-center gap-3"><StatusBadge status={product.status} /><div className="hidden text-right sm:block"><div className="text-[12px] font-bold">{money(product.calculation?.unitCost)}</div><div className="text-[9px] text-muted-foreground">custo unitário</div></div></div></div>)}</div>}
        </Card>
        <Card><CardTitle icon={ClipboardList} title="Orçamentos recentes" caption="Acompanhe o que está em negociação" trailing={<Link href="/quotes" className="text-[11px] font-bold text-primary">Todos <ArrowRight size={13} className="ml-1 inline" /></Link>} />
          {!data?.recentQuotes?.length ? <EmptyState icon={FileText} title="Sua lista começa com um orçamento" description="Use a calculadora para formar um preço por canal e registre uma proposta para seu cliente." action={<Link href="/calculator" className="btn btn-secondary text-[12px]"><Calculator size={15} />Abrir calculadora</Link>} /> :
            <div className="divide-y divide-border/70">{data.recentQuotes.map(quote => <div className="flex items-center justify-between gap-3 px-5 py-4" key={quote.id} data-testid={`row-recent-quote-${quote.id}`}><div><div className="text-[12px] font-bold">{quote.customerName || 'Cliente não informado'}</div><div className="mt-1 text-[10px] text-muted-foreground">{quote.productName} · {quote.quantity} un.</div></div><div className="text-right"><div className="text-[12px] font-bold">{money(quote.total)}</div><div className="mt-1"><StatusBadge status={quote.status} /></div></div></div>)}</div>}
        </Card>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card className="bg-[#f4f7ff] dark:bg-[#18243b]"><div className="flex gap-3 p-5"><div className="mt-0.5 text-primary"><Info size={17} /></div><div><h3 className="m-0 text-[12px] font-bold">Uma conta clara, não uma promessa</h3><p className="mb-0 mt-1.5 text-[11px] leading-relaxed text-muted-foreground">Custos e preços estimados dependem da qualidade dos dados informados. Taxas de plataforma, demanda e impostos podem variar.</p></div></div></Card>
        <Card className="bg-[#fff8f1] dark:bg-[#2a211c]"><div className="flex gap-3 p-5"><div className="mt-0.5 text-[#f27124]"><ArrowDownRight size={17} /></div><div><h3 className="m-0 text-[12px] font-bold">Materiais com estoque baixo</h3>{!data?.lowStockMaterials?.length ? <p className="mb-0 mt-1.5 text-[11px] text-muted-foreground">Nenhum material abaixo do limite informado.</p> : <div className="mt-2 flex flex-wrap gap-2">{data.lowStockMaterials.map(m => <Link key={m.id} href="/materials" className="rounded-lg border border-orange-200 bg-white/75 px-2.5 py-1.5 text-[10px] font-semibold text-orange-900 dark:border-orange-900 dark:bg-transparent dark:text-orange-200">{m.name} · {number(m.stockGrams)} g</Link>)}</div>}</div></div></Card>
      </div>
    </>}</Shell>;
}

function HomeRedirect() { return <HomePage />; }

function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <DialogPrimitive.Root open onOpenChange={open=>{if(!open)onClose();}}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/50"/><DialogPrimitive.Content aria-describedby={undefined} className={`fixed left-1/2 top-1/2 z-[71] max-h-[90dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-border bg-card p-5 shadow-xl ${wide?'max-w-2xl':'max-w-lg'}`}><div className="mb-5 flex items-center justify-between"><DialogPrimitive.Title className="font-bold">{title}</DialogPrimitive.Title><DialogPrimitive.Close className="btn btn-quiet" aria-label="Fechar diálogo"><X size={18}/></DialogPrimitive.Close></div>{children}</DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>;
}

function MaterialsPage() {
  const { data: allData = [], isLoading, isError, refetch } = useListMaterials();
  const [search,setSearch]=useState('');
  const data=allData.filter(item=>item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const create = useCreateMaterial(); const update = useUpdateMaterial(); const archive = useArchiveMaterial();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Material | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [confirm, setConfirm] = useState<Material | null>(null);
  const [message, setMessage] = useState('');
  const blank: MaterialInput = { name: '', type: 'PLA', brand: '', color: '', supplier: '', netWeightGrams: 1000, purchaseValue: 0, allocatedFreight: 0, stockGrams: 0, lowStockThreshold: 250, archived: false };
  const [form, setForm] = useState<MaterialInput>(blank);
  const set = (key: keyof MaterialInput) => (v: string) => setForm(current => ({ ...current, [key]: key === 'archived' ? v === 'true' : ['netWeightGrams', 'purchaseValue', 'allocatedFreight', 'stockGrams', 'lowStockThreshold'].includes(key) ? asNum(v) : v }));
  const openNew = () => { setEditing(null); setForm(blank); setIsNew(true); };
  const openEdit = (item: Material) => { setForm({ name: item.name, type: item.type, brand: item.brand, color: item.color, supplier: item.supplier, netWeightGrams: item.netWeightGrams, purchaseValue: item.purchaseValue, allocatedFreight: item.allocatedFreight, stockGrams: item.stockGrams, lowStockThreshold: item.lowStockThreshold, archived: item.archived }); setEditing(item); setIsNew(true); };
  const close = () => { setIsNew(false); setEditing(null); };
  const onSave = (event: FormEvent) => { event.preventDefault(); const done = () => { void qc.invalidateQueries({ queryKey: getListMaterialsQueryKey() }); void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); close(); setMessage('Material salvo.'); }; if (editing) update.mutate({ id: editing.id, data: form }, { onSuccess: done, onError: () => setMessage('Não foi possível salvar o material.') }); else create.mutate({ data: form }, { onSuccess: done, onError: () => setMessage('Não foi possível cadastrar o material.') }); };
  const onArchive = () => { if (!confirm) return; archive.mutate({ id: confirm.id }, { onSuccess: () => { void qc.invalidateQueries({ queryKey: getListMaterialsQueryKey() }); void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); setConfirm(null); setMessage('Material arquivado.'); }, onError: () => setMessage('Não foi possível arquivar o material.') }); };
  return <Shell active="/materials"><div className="mb-5"><InputField label="Buscar material" value={search} onChange={setSearch}/></div><PageHeading eyebrow="CADASTROS" title="Materiais" description="Custo real por grama, fornecedor e estoque para alimentar suas próximas estimativas." action={<button className="btn btn-primary text-[11px]" onClick={openNew} data-testid="button-add-material"><Plus size={15} />Novo material</button>} />
    {message && <div role="status" className="mb-4 rounded-lg bg-blue-50 p-3 text-[11px] text-blue-800 dark:bg-blue-950 dark:text-blue-200">{message}<button className="float-right" onClick={() => setMessage('')} aria-label="Dispensar aviso"><X size={14} /></button></div>}
    {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={() => void refetch()} /> : data.length === 0 ? <Card><EmptyState icon={Layers3} title="Sua prateleira está vazia" description="Cadastre o filamento comprado e o custo calculado por grama será usado nas linhas da calculadora." action={<button className="btn btn-primary text-[11px]" onClick={openNew}><Plus size={14} />Cadastrar material</button>} /></Card> :
      <Card><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="m-0 text-[14px] font-bold">Filamentos cadastrados</h2><p className="mb-0 mt-1 text-[10px] text-muted-foreground">{data.filter(m => !m.archived).length} ativos · valores atualizados por você</p></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">{data.length} registros</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[730px] text-left"><thead><tr className="border-b border-border bg-muted/45 text-[9px] font-bold uppercase tracking-wider text-muted-foreground"><th className="px-5 py-3">Filamento</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Custo / g</th><th className="px-4 py-3">Estoque</th><th className="px-4 py-3">Compra total</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-border/70">{data.map(item => <tr key={item.id} className="hover:bg-muted/25" data-testid={`row-material-${item.id}`}><td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-orange-50 text-orange-700 dark:bg-orange-950/40"><Layers3 size={16} /></div><div><div className="text-[11px] font-bold">{item.name}</div><div className="mt-1 text-[9px] text-muted-foreground">{[item.brand, item.color].filter(Boolean).join(' · ') || item.supplier || 'Sem detalhes'}</div></div></div></td><td className="px-4 py-3 text-[10px]">{item.type}</td><td className="px-4 py-3 text-[11px] font-bold">{money(item.costPerGram)}<span className="font-normal text-muted-foreground">/g</span></td><td className="px-4 py-3"><div className={`text-[11px] font-bold ${item.stockGrams <= item.lowStockThreshold ? 'text-orange-700 dark:text-orange-300' : ''}`}>{number(item.stockGrams)} g</div><div className="mt-1 text-[9px] text-muted-foreground">limite {number(item.lowStockThreshold)} g</div></td><td className="px-4 py-3 text-[10px]">{money(item.purchaseValue + item.allocatedFreight)}</td><td className="px-5 py-3 text-right"><div className="flex justify-end gap-1"><button className="btn btn-quiet !px-2 !py-1.5 text-[10px]" onClick={() => openEdit(item)} data-testid={`button-edit-material-${item.id}`}>Editar</button><button className="btn btn-quiet !px-2 !py-1.5 text-[10px] text-destructive" onClick={() => setConfirm(item)} aria-label={`Arquivar ${item.name}`} data-testid={`button-archive-material-${item.id}`}><Archive size={14} /></button></div></td></tr>)}</tbody></table></div>
      </Card>}
    {isNew && <Modal title={editing ? 'Editar material' : 'Novo material'} onClose={close}><form className="space-y-4" onSubmit={onSave}><InputField label="Nome" value={form.name} onChange={set('name')} placeholder="PLA Matte Branco" /><div className="grid grid-cols-2 gap-3"><InputField label="Tipo" value={form.type} onChange={set('type')} placeholder="PLA" /><InputField label="Marca" value={form.brand} onChange={set('brand')} placeholder="Marca" /></div><div className="grid grid-cols-2 gap-3"><InputField label="Cor" value={form.color} onChange={set('color')} placeholder="Branco" /><InputField label="Fornecedor" value={form.supplier} onChange={set('supplier')} placeholder="Loja / fornecedor" /></div><div className="grid grid-cols-2 gap-3"><InputField label="Peso líquido" type="number" min={1} value={form.netWeightGrams} unit="g" onChange={set('netWeightGrams')} /><InputField label="Valor de compra" type="number" min={0} step=".01" value={form.purchaseValue} unit="R$" onChange={set('purchaseValue')} /></div><div className="grid grid-cols-2 gap-3"><InputField label="Frete alocado" type="number" min={0} step=".01" value={form.allocatedFreight} unit="R$" onChange={set('allocatedFreight')} /><InputField disabled={!!editing} label="Estoque disponível" type="number" min={0} step=".1" value={form.stockGrams} unit="g" onChange={set('stockGrams')} /></div><InputField label="Avisar quando estoque chegar a" type="number" min={0} value={form.lowStockThreshold} unit="g" onChange={set('lowStockThreshold')} /><div className="rounded-lg bg-blue-50 p-3 text-[10px] leading-relaxed text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">Custo calculado: {money(form.netWeightGrams > 0 ? (form.purchaseValue + form.allocatedFreight) / form.netWeightGrams : 0)} por grama, incluindo frete alocado.</div><div className="flex justify-end gap-2 pt-1"><button type="button" className="btn btn-secondary text-[11px]" onClick={close}>Cancelar</button><button className="btn btn-primary text-[11px]" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'Salvando…' : 'Salvar material'}</button></div></form></Modal>}
    {confirm && <Modal title="Arquivar material?" onClose={() => setConfirm(null)}><p className="text-[12px] leading-relaxed text-muted-foreground">“{confirm.name}” deixará de aparecer como opção ativa na calculadora. O registro será arquivado, não apagado.</p><div className="mt-5 flex justify-end gap-2"><button className="btn btn-secondary text-[11px]" onClick={() => setConfirm(null)}>Cancelar</button><button className="btn btn-primary text-[11px]" onClick={onArchive} disabled={archive.isPending}>{archive.isPending ? 'Arquivando…' : 'Arquivar'}</button></div></Modal>}
  </Shell>;
}

function PrintersPage() {
  const { data: allData = [], isLoading, isError, refetch } = useListPrinters();
  const [search,setSearch]=useState('');
  const data=allData.filter(item=>item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const create = useCreatePrinter(); const update = useUpdatePrinter(); const archive = useArchivePrinter(); const qc = useQueryClient();
  const [editing, setEditing] = useState<PrinterRecord | null>(null); const [formOpen, setFormOpen] = useState(false); const [confirm, setConfirm] = useState<PrinterRecord | null>(null); const [message, setMessage] = useState('');
  const blank: PrinterInput = { name: '', model: '', purchaseValue: 0, residualValue: 0, usefulLifeHours: 0, averagePowerWatts: 0, maintenancePerHour: 0, active: true };
  const [form, setForm] = useState<PrinterInput>(blank);
  const set = (key: keyof PrinterInput) => (v: string) => setForm(current => ({ ...current, [key]: key === 'active' ? v === 'true' : ['purchaseValue', 'residualValue', 'usefulLifeHours', 'averagePowerWatts', 'maintenancePerHour'].includes(key) ? asNum(v) : v }));
  const openNew = () => { setEditing(null); setForm(blank); setFormOpen(true); };
  const openEdit = (row: PrinterRecord) => { setEditing(row); setForm({ name: row.name, model: row.model, purchaseValue: row.purchaseValue, residualValue: row.residualValue, usefulLifeHours: row.usefulLifeHours, averagePowerWatts: row.averagePowerWatts, maintenancePerHour: row.maintenancePerHour, active: row.active }); setFormOpen(true); };
  const save = (e: FormEvent) => { e.preventDefault(); const done = () => { void qc.invalidateQueries({ queryKey: getListPrintersQueryKey() }); void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); setFormOpen(false); setMessage('Perfil salvo.'); }; if (editing) update.mutate({ id: editing.id, data: form }, { onSuccess: done, onError: () => setMessage('Não foi possível salvar a impressora.') }); else create.mutate({ data: form }, { onSuccess: done, onError: () => setMessage('Não foi possível cadastrar a impressora.') }); };
  const onArchive = () => { if (!confirm) return; archive.mutate({ id: confirm.id }, { onSuccess: () => { void qc.invalidateQueries({ queryKey: getListPrintersQueryKey() }); void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); setConfirm(null); setMessage('Perfil arquivado.'); }, onError: () => setMessage('Não foi possível arquivar o perfil.') }); };
  return <Shell active="/printers"><div className="mb-5"><InputField label="Buscar impressora" value={search} onChange={setSearch}/></div><PageHeading eyebrow="CADASTROS" title="Impressoras" description="Perfis ajudam a reaproveitar dados de potência, manutenção e vida útil nas contas." action={<button className="btn btn-primary text-[11px]" onClick={openNew} data-testid="button-add-printer"><Plus size={15} />Nova impressora</button>} />{message && <div role="status" className="mb-4 rounded-lg bg-blue-50 p-3 text-[11px] text-blue-800 dark:bg-blue-950 dark:text-blue-200">{message}<button className="float-right" onClick={() => setMessage('')} aria-label="Dispensar aviso"><X size={14} /></button></div>}
    {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={() => void refetch()} /> : data.length === 0 ? <Card><EmptyState icon={Printer} title="Nenhuma impressora cadastrada" description="Crie um perfil para não precisar redigitar os dados da máquina a cada cálculo." action={<button className="btn btn-primary text-[11px]" onClick={openNew}><Plus size={14} />Cadastrar impressora</button>} /></Card> :
      <div className="grid gap-4 lg:grid-cols-2">{data.map(printer => <Card key={printer.id} className="p-5" ><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50"><Printer size={18} /></div><div><div className="text-[13px] font-bold">{printer.name}</div><div className="mt-1 text-[10px] text-muted-foreground">{printer.model || 'Modelo não informado'}</div></div></div><StatusBadge status={printer.active ? 'ready' : 'incomplete'} /></div><div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-muted/60 p-3 sm:grid-cols-4">{[['Potência média', `${number(printer.averagePowerWatts, 0)} W`], ['Vida útil', `${number(printer.usefulLifeHours, 0)} h`], ['Compra', money(printer.purchaseValue)], ['Manutenção', `${money(printer.maintenancePerHour)}/h`]].map(([label, value]) => <div key={label}><div className="text-[9px] text-muted-foreground">{label}</div><div className="mt-1 text-[11px] font-bold">{value}</div></div>)}</div><div className="mt-4 flex justify-end gap-2"><button className="btn btn-secondary !px-3 !py-2 text-[10px]" onClick={() => openEdit(printer)} data-testid={`button-edit-printer-${printer.id}`}>Editar perfil</button><button className="btn btn-quiet !px-2 !py-2 text-destructive" onClick={() => setConfirm(printer)} aria-label={`Arquivar ${printer.name}`} data-testid={`button-archive-printer-${printer.id}`}><Archive size={15} /></button></div></Card>)}</div>}
    {formOpen && <Modal title={editing ? 'Editar impressora' : 'Nova impressora'} onClose={() => setFormOpen(false)}><form className="space-y-4" onSubmit={save}><InputField label="Nome do perfil" value={form.name} onChange={set('name')} placeholder="Ex.: CoreXY bancada 1" /><InputField label="Modelo" value={form.model} onChange={set('model')} placeholder="Modelo e configuração" /><div className="grid grid-cols-2 gap-3"><InputField label="Valor de compra" type="number" min={0} step=".01" value={form.purchaseValue} unit="R$" onChange={set('purchaseValue')} /><InputField label="Valor residual" type="number" min={0} step=".01" value={form.residualValue} unit="R$" onChange={set('residualValue')} /><InputField label="Vida útil estimada" type="number" min={0} value={form.usefulLifeHours} unit="h" onChange={set('usefulLifeHours')} /><InputField label="Potência média" type="number" min={0} value={form.averagePowerWatts} unit="W" onChange={set('averagePowerWatts')} /><InputField label="Manutenção estimada" type="number" min={0} step=".01" value={form.maintenancePerHour} unit="R$/h" onChange={set('maintenancePerHour')} /></div><SelectField label="Disponibilidade" value={form.active ? 'true' : 'false'} onChange={set('active')} options={[{ value: 'true', label: 'Ativa para uso' }, { value: 'false', label: 'Inativa' }]} /><div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary text-[11px]" onClick={() => setFormOpen(false)}>Cancelar</button><button className="btn btn-primary text-[11px]" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'Salvando…' : 'Salvar perfil'}</button></div></form></Modal>}
    {confirm && <Modal title="Arquivar impressora?" onClose={() => setConfirm(null)}><p className="text-[12px] text-muted-foreground">O perfil “{confirm.name}” deixará de aparecer como opção ativa.</p><div className="mt-5 flex justify-end gap-2"><button className="btn btn-secondary text-[11px]" onClick={() => setConfirm(null)}>Cancelar</button><button className="btn btn-primary text-[11px]" onClick={onArchive} disabled={archive.isPending}>Arquivar perfil</button></div></Modal>}</Shell>;
}

function SettingsPage() {
  const { data: settings, isLoading, isError, refetch } = useGetSettings();
  const save = useSaveSettings(); const qc = useQueryClient();
  const [form, setForm] = useState<SettingsInput | null>(null); const [message, setMessage] = useState('');
  useEffect(() => { if (settings) setForm({ companyName: settings.companyName, currency: settings.currency, energyRate: settings.energyRate, hourlyLaborRate: settings.hourlyLaborRate, monthlyFixedExpenses: settings.monthlyFixedExpenses, productiveHoursMonthly: settings.productiveHoursMonthly, directMargin: settings.directMargin, wholesaleMargin: settings.wholesaleMargin, marketplaceMargin: settings.marketplaceMargin, directFeePercent: settings.directFeePercent, directFeePerOrder: settings.directFeePerOrder, directFeePerUnit: settings.directFeePerUnit, wholesaleFeePercent: settings.wholesaleFeePercent, wholesaleFeePerOrder: settings.wholesaleFeePerOrder, wholesaleFeePerUnit: settings.wholesaleFeePerUnit, marketplaceFeePercent: settings.marketplaceFeePercent, marketplaceFeePerOrder: settings.marketplaceFeePerOrder, marketplaceFeePerUnit: settings.marketplaceFeePerUnit, rounding: settings.rounding }); }, [settings]);
  const setNumber = (key: keyof SettingsInput) => (v: string) => setForm(current => current ? ({ ...current, [key]: asNum(v) }) : current);
  const setMargin = (key: 'directMargin' | 'wholesaleMargin' | 'marketplaceMargin') => (v: string) => setForm(current => current ? ({ ...current, [key]: asNum(v) / 100 }) : current);
  const setFeeRate = (key: 'directFeePercent' | 'wholesaleFeePercent' | 'marketplaceFeePercent') => (v: string) => setForm(current => current ? ({ ...current, [key]: asNum(v) / 100 }) : current);
  const submit = (e: FormEvent) => { e.preventDefault(); if (!form) return; save.mutate({ data: form }, { onSuccess: () => { void qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() }); void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); setMessage('Configurações salvas.'); }, onError: () => setMessage('Não foi possível salvar. Confira os valores informados.') }); };
  if (isLoading) return <Shell active="/settings"><LoadingState /></Shell>;
  if (isError || !form) return <Shell active="/settings"><ErrorState onRetry={() => void refetch()} /></Shell>;
  return <Shell active="/settings"><PageHeading eyebrow="PREFERÊNCIAS" title="Configurações" description="Defina taxas e margens usadas como ponto de partida. Cada cálculo pode ter premissas diferentes." />
    {message && <div role="status" className="mb-4 rounded-lg bg-blue-50 p-3 text-[11px] text-blue-800 dark:bg-blue-950 dark:text-blue-200">{message}</div>}
    <form onSubmit={submit} className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_310px]"><div className="space-y-5"><Card><CardTitle icon={Settings2} title="Sua oficina" caption="Identificação e unidade monetária." /><div className="grid gap-4 p-5 sm:grid-cols-2"><div><Label>Nome da empresa / oficina</Label><input className="field" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} placeholder="Nome da sua oficina" /></div><div><Label>Moeda</Label><input className="field" value="BRL — Real brasileiro" disabled /></div></div></Card>
      <Card><CardTitle icon={Zap} title="Custos de operação" caption="Valores de referência aplicados ao cálculo quando você não os substitui." /><div className="grid gap-4 p-5 sm:grid-cols-2"><InputField label="Energia" type="number" min={0} step=".01" value={form.energyRate} unit="R$/kWh" onChange={setNumber('energyRate')} /><InputField label="Hora de mão de obra" type="number" min={0} step=".01" value={form.hourlyLaborRate} unit="R$/h" onChange={setNumber('hourlyLaborRate')} /><InputField label="Despesas fixas mensais" type="number" min={0} step=".01" value={form.monthlyFixedExpenses} unit="R$/mês" onChange={setNumber('monthlyFixedExpenses')} /><InputField label="Horas produtivas no mês" type="number" min={0} step="1" value={form.productiveHoursMonthly} unit="h/mês" onChange={setNumber('productiveHoursMonthly')} /></div></Card>
      <Card><CardTitle icon={TrendingUp} title="Margens desejadas" caption="Preferências de cálculo — não são promessa de margem realizada nem validação de mercado." /><div className="grid gap-4 p-5 sm:grid-cols-3"><InputField label="Venda direta" type="number" min={0} max={99} step=".1" value={form.directMargin * 100} unit="%" onChange={setMargin('directMargin')} /><InputField label="Atacado" type="number" min={0} max={99} step=".1" value={form.wholesaleMargin * 100} unit="%" onChange={setMargin('wholesaleMargin')} /><InputField label="Marketplace" type="number" min={0} max={99} step=".1" value={form.marketplaceMargin * 100} unit="%" onChange={setMargin('marketplaceMargin')} /></div></Card>
      <Card><CardTitle icon={Coins} title="Taxas por canal" caption="Use taxas do seu contrato ou da plataforma. Elas podem variar; não são valores de referência universal." /><div className="space-y-5 p-5">{[
        { title: 'Venda direta', percent: 'directFeePercent' as const, order: 'directFeePerOrder' as const, unit: 'directFeePerUnit' as const },
        { title: 'Atacado', percent: 'wholesaleFeePercent' as const, order: 'wholesaleFeePerOrder' as const, unit: 'wholesaleFeePerUnit' as const },
        { title: 'Marketplace', percent: 'marketplaceFeePercent' as const, order: 'marketplaceFeePerOrder' as const, unit: 'marketplaceFeePerUnit' as const },
      ].map(channel => <div key={channel.title}><h3 className="mb-3 mt-0 text-[11px] font-bold">{channel.title}</h3><div className="grid gap-3 sm:grid-cols-3"><InputField label="Taxa percentual" type="number" min={0} max={99} step=".1" value={form[channel.percent] * 100} unit="%" onChange={setFeeRate(channel.percent)} /><InputField label="Taxa por pedido" type="number" min={0} step=".01" value={form[channel.order]} unit="R$/pedido" onChange={setNumber(channel.order)} /><InputField label="Taxa por unidade" type="number" min={0} step=".01" value={form[channel.unit]} unit="R$/un." onChange={setNumber(channel.unit)} /></div></div>)}</div></Card>
      <Card><CardTitle icon={Coins} title="Arredondamento" caption="Como tratar a sugestão numérica apresentada no cálculo." /><div className="p-5"><SelectField label="Preferência padrão" value={form.rounding} onChange={v => setForm({ ...form, rounding: v as SettingsInput['rounding'] })} options={[{ value: 'cent', label: 'Centavos — R$ 12,34' }, { value: 'half', label: 'Múltiplos de R$ 0,50' }, { value: 'whole', label: 'Real inteiro' }, { value: 'ending90', label: 'Final ,90' }, { value: 'ending99', label: 'Final ,99' }]} /></div></Card></div>
      <aside className="space-y-4 xl:sticky xl:top-[82px]"><Card className="p-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50"><Info size={19} /></div><h2 className="mt-4 text-[14px] font-bold">Premissas editáveis</h2><p className="text-[11px] leading-relaxed text-muted-foreground">Esses valores ajudam a começar. Você pode substituí-los para um produto específico na calculadora.</p><div className="mt-4 space-y-2 border-t border-border pt-4 text-[10px] leading-relaxed text-muted-foreground"><div className="flex gap-2"><CheckCircle2 size={14} className="shrink-0 text-emerald-600" />Custos informados pela sua operação.</div><div className="flex gap-2"><CircleAlert size={14} className="shrink-0 text-orange-600" />Taxas de venda variam por contrato e canal.</div><div className="flex gap-2"><Info size={14} className="shrink-0 text-primary" />A estimativa não garante lucro ou venda.</div></div></Card><button className="btn btn-primary w-full text-[12px]" disabled={save.isPending} data-testid="button-save-settings"><Save size={15} />{save.isPending ? 'Salvando…' : 'Salvar configurações'}</button></aside></form>
    <ExtraSettings />
  </Shell>;
}

function AppRoutes() {
  return <QueryClientProvider client={queryClient}><Switch>
    <Route path="/" component={HomeRedirect} />
    <Route path="/calculator" component={() => <Shell active="/calculator"><NewCalculator /></Shell>} />
    <Route path="/products" component={() => <Shell active="/products"><NewProducts /></Shell>} />
    <Route path="/materials" component={() => <MaterialsPage />} />
    <Route path="/printers" component={() => <PrintersPage />} />
    <Route path="/quotes" component={() => <Shell active="/quotes"><NewQuotes /></Shell>} />
    <Route path="/stock" component={() => <Shell active="/stock"><Stock /></Shell>} />
    <Route path="/import" component={() => <Shell active="/import"><ImportPage /></Shell>} />
    <Route path="/settings" component={() => <SettingsPage />} />
    <Route component={() => <Shell><div className="card p-10 text-center"><div className="text-2xl font-bold">Página não encontrada</div><p className="text-sm text-muted-foreground">Esse endereço não faz parte da oficina.</p><Link href="/" className="btn btn-blue mt-4">Voltar ao início</Link></div></Shell>} />
  </Switch></QueryClientProvider>;
}
function App() { return <WouterRouter base={basePath}><AppRoutes /></WouterRouter>; }

export default App;
