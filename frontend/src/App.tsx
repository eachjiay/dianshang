import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingCart,
  Store,
  UserRound,
  XCircle
} from 'lucide-react';
import './index.css';

const API = import.meta.env.VITE_API_BASE || '/api';

type User = { id: number; phone: string; nickname: string; role: string; enterprise_status?: string };
type Product = {
  id: number;
  name: string;
  sub_title: string;
  brand: string;
  unit: string;
  price: number;
  stock: number;
  min_order: number;
  main_image: string;
  details: string;
  status: string;
  sales: number;
  category_name: string;
  shop_name: string;
  comments?: Array<{ id: number; nickname: string; rating: number; content: string }>;
  recommendations?: Product[];
};

function token() {
  return localStorage.getItem('token') || '';
}

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

function useUser() {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };
  return { user, setUser, logout };
}

function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useUser();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const submitSearch = () => {
    navigate(`/products${query ? `?search=${encodeURIComponent(query)}` : ''}`);
    setOpen(false);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">帝全电商</Link>
        <div className="searchbar">
          <Search size={18} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitSearch()} placeholder="搜索商品、品牌、类目" />
          <button onClick={submitSearch}>搜索</button>
        </div>
        <nav className={`navlinks ${open ? 'open' : ''}`}>
          <Link to="/products">商品中心</Link>
          <Link to="/activities">展销活动</Link>
          <Link to="/merchant">商家中心</Link>
          <Link to="/admin">运营后台</Link>
          <Link to="/cart"><ShoppingCart size={18} />购物车</Link>
          {user ? (
            <>
              <Link to="/orders"><UserRound size={18} />{user.nickname || user.phone}</Link>
              <button className="ghost" onClick={logout}><LogOut size={18} />退出</button>
            </>
          ) : (
            <Link className="primary-link" to="/login">登录/注册</Link>
          )}
        </nav>
        <button className="icon-btn menu-btn" onClick={() => setOpen(!open)}><Menu size={22} /></button>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <span>帝全电商平台</span>
        <span>企业采购 · 商超展销 · 供需撮合 · 订单履约</span>
      </footer>
    </div>
  );
}

function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  useEffect(() => {
    request('/products?sort=sales').then(setProducts).catch(console.error);
    request('/platform/activities').then(setActivities).catch(console.error);
  }, []);

  return (
    <Shell>
      <section className="hero-section">
        <img src="https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=1800&auto=format&fit=crop" alt="企业采购会议" />
        <div className="hero-copy">
          <p className="eyebrow">B2B 企业采购平台</p>
          <h1>帝全电商平台</h1>
          <p>覆盖商品展示、企业采购、商超展销、订单履约、售后与运营管理的一站式企服社交电商平台。</p>
          <div className="hero-actions">
            <Link className="btn solid" to="/products">进入商城</Link>
            <Link className="btn light" to="/enterprise">企业认证</Link>
          </div>
        </div>
      </section>

      <section className="metric-row">
        {[
          ['交易闭环', '注册、购物车、下单、支付、发货、评价'],
          ['审核机制', '商家、商品、活动、企业认证统一审核'],
          ['运营后台', '用户、订单、售后、活动与统计报表'],
          ['双端适配', '官网与 APP 可复用同一套 REST API']
        ].map(([title, desc]) => (
          <article key={title}>
            <h3>{title}</h3>
            <p>{desc}</p>
          </article>
        ))}
      </section>

      <SectionTitle title="商超展销与营销活动" action="/activities" />
      <div className="activity-grid">
        {activities.map((item) => (
          <Link to="/activities" className="activity-card" key={item.id}>
            <img src={item.banner} alt={item.name} />
            <div>
              <span>{item.type}</span>
              <h3>{item.name}</h3>
              <p>{item.rule_text}</p>
            </div>
          </Link>
        ))}
      </div>

      <SectionTitle title="热销企业采购商品" action="/products" />
      <ProductGrid products={products.slice(0, 6)} />
    </Shell>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {action && <Link to={action}>查看全部</Link>}
    </div>
  );
}

function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <article className="product-card" key={product.id}>
          <Link to={`/product/${product.id}`} className="product-image">
            <img src={product.main_image} alt={product.name} />
            <span>{product.stock > 0 ? '有货' : '缺货'}</span>
          </Link>
          <div className="product-body">
            <p>{product.category_name || product.brand}</p>
            <Link to={`/product/${product.id}`}><h3>{product.name}</h3></Link>
            <small>{product.sub_title}</small>
            <div className="price-line">
              <strong>¥{Number(product.price).toLocaleString()}</strong>
              <span>起购 {product.min_order || 1}{product.unit || '件'}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function Products() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const query = params.get('search') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || '';

  useEffect(() => {
    request(`/products?search=${encodeURIComponent(query)}&category=${category}&sort=${sort}&inStock=1`).then(setProducts).catch(console.error);
    request('/platform/categories').then(setCategories).catch(console.error);
  }, [query, category, sort]);

  return (
    <Shell>
      <div className="page-layout">
        <aside className="filter-panel">
          <h2>筛选商品</h2>
          <button className={!category ? 'active' : ''} onClick={() => setParams({ search: query })}>全部类目</button>
          {categories.map((cat) => (
            <button key={cat.id} className={category === String(cat.id) ? 'active' : ''} onClick={() => setParams({ search: query, category: String(cat.id), sort })}>{cat.name}</button>
          ))}
          <label>排序</label>
          <select value={sort} onChange={(e) => setParams({ search: query, category, sort: e.target.value })}>
            <option value="">最新上架</option>
            <option value="sales">销量优先</option>
            <option value="price_asc">价格从低到高</option>
            <option value="price_desc">价格从高到低</option>
          </select>
          <Link to="/enterprise" className="notice-box">企业认证后可申请批量采购和发票信息。</Link>
        </aside>
        <section className="content-area">
          <SectionTitle title={query ? `搜索：${query}` : '商品中心'} />
          <ProductGrid products={products} />
        </section>
      </div>
    </Shell>
  );
}

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    request(`/products/${id}`).then((data) => {
      setProduct(data);
      setQuantity(data.min_order || 1);
    }).catch(console.error);
  }, [id]);

  const addCart = async () => {
    if (!token()) return navigate('/login');
    await request('/cart/add', { method: 'POST', body: JSON.stringify({ product_id: product?.id, quantity }) });
    navigate('/cart');
  };

  if (!product) return <Shell><div className="empty-state">商品加载中...</div></Shell>;
  return (
    <Shell>
      <div className="detail-layout">
        <img className="detail-image" src={product.main_image} alt={product.name} />
        <section className="detail-info">
          <p className="eyebrow">{product.category_name} · {product.shop_name}</p>
          <h1>{product.name}</h1>
          <p>{product.sub_title}</p>
          <div className="detail-price">¥{Number(product.price).toLocaleString()}</div>
          <dl className="spec-list">
            <div><dt>品牌</dt><dd>{product.brand || '平台优选'}</dd></div>
            <div><dt>库存</dt><dd>{product.stock}{product.unit}</dd></div>
            <div><dt>起购</dt><dd>{product.min_order}{product.unit}</dd></div>
            <div><dt>销量</dt><dd>{product.sales}</dd></div>
          </dl>
          <div className="quantity-row">
            <button onClick={() => setQuantity(Math.max(product.min_order || 1, quantity - 1))}>-</button>
            <input value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} />
            <button onClick={() => setQuantity(quantity + 1)}>+</button>
          </div>
          <div className="button-row">
            <button className="btn solid" onClick={addCart}><ShoppingCart size={18} />加入购物车</button>
            <button className="btn light"><Heart size={18} />收藏</button>
          </div>
          <article className="description">
            <h3>图文详情</h3>
            <p>{product.details}</p>
          </article>
        </section>
      </div>
      <SectionTitle title="评价与相关推荐" />
      <div className="comment-list">
        {(product.comments || []).length ? product.comments?.map((c) => <p key={c.id}><strong>{c.nickname}</strong>：{c.content}</p>) : <p>暂无评价，完成订单后可发布评价。</p>}
      </div>
      <ProductGrid products={product.recommendations || []} />
    </Shell>
  );
}

function Cart() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);

  const load = () => request('/cart', {}).then(setItems).catch(() => navigate('/login'));
  useEffect(() => { load(); }, []);

  const update = async (id: number, quantity: number) => {
    await request('/cart/update', { method: 'PUT', body: JSON.stringify({ id, quantity }) });
    load();
  };

  const createOrder = async () => {
    const order = await request('/orders/create', {
      method: 'POST',
      body: JSON.stringify({
        items: items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
        shipping_address_id: null,
        invoice_title: '企业采购发票',
        freight_amount: total > 1000 ? 0 : 20
      })
    });
    navigate(`/orders?pay=${order.orderId}`);
  };

  return (
    <Shell>
      <div className="content-area narrow">
        <SectionTitle title="购物车" />
        {items.length === 0 ? <div className="empty-state">购物车为空</div> : items.map((item) => (
          <div className="cart-row" key={item.id}>
            <img src={item.main_image} alt={item.name} />
            <div><h3>{item.name}</h3><p>¥{item.price}</p></div>
            <div className="quantity-row">
              <button onClick={() => update(item.id, item.quantity - 1)}>-</button>
              <input value={item.quantity} readOnly />
              <button onClick={() => update(item.id, item.quantity + 1)}>+</button>
            </div>
          </div>
        ))}
        <div className="checkout-bar">
          <strong>合计 ¥{total.toLocaleString()}</strong>
          <button className="btn solid" disabled={!items.length} onClick={createOrder}>提交订单</button>
        </div>
      </div>
    </Shell>
  );
}

function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [params] = useSearchParams();
  const payId = params.get('pay');
  const load = () => request('/orders').then(setOrders).catch(console.error);
  useEffect(() => { load(); }, []);
  const pay = async (id: number) => {
    await request('/orders/pay', { method: 'POST', body: JSON.stringify({ orderId: id, method: 'WECHAT' }) });
    load();
  };
  const ship = async (id: number) => {
    await request('/orders/update-status', { method: 'POST', body: JSON.stringify({ orderId: id, status: 'SHIPPED', logistics_company: '顺丰速运', logistics_no: `SF${Date.now()}` }) });
    load();
  };
  const aftersale = async (id: number) => {
    await request('/platform/aftersales', { method: 'POST', body: JSON.stringify({ order_id: id, type: '退款', reason: '采购计划调整' }) });
    load();
  };

  return (
    <Shell>
      <div className="content-area narrow">
        <SectionTitle title="订单中心" />
        {orders.map((order) => (
          <article className={`order-card ${String(order.id) === payId ? 'highlight' : ''}`} key={order.id}>
            <div className="order-head"><strong>订单 #{order.id}</strong><span>{order.status}</span></div>
            {order.items?.map((item: any) => <p key={item.id}>{item.name} × {item.quantity} · ¥{item.price}</p>)}
            <div className="order-actions">
              <strong>¥{Number(order.total_amount).toLocaleString()}</strong>
              {order.status === 'UNPAID' && <button onClick={() => pay(order.id)}>模拟支付</button>}
              {order.status === 'PAID' && <button onClick={() => ship(order.id)}>商家发货</button>}
              {['PAID', 'SHIPPED', 'COMPLETED'].includes(order.status) && <button onClick={() => aftersale(order.id)}>申请售后</button>}
            </div>
          </article>
        ))}
      </div>
    </Shell>
  );
}

function Login() {
  const { setUser } = useUser();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ phone: '13800000003', password: '123456', nickname: '', role: 'USER' });
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) await request('/auth/register', { method: 'POST', body: JSON.stringify(form) });
      const data = await request('/auth/login', { method: 'POST', body: JSON.stringify(form) });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后再试');
    }
  };
  return (
    <Shell>
      <form className="auth-card" onSubmit={submit}>
        <h1>{isRegister ? '注册账号' : '登录帝全'}</h1>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="手机号" />
        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="密码" />
        {isRegister && <input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="昵称" />}
        {isRegister && <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="USER">普通用户</option><option value="MERCHANT">商家用户</option></select>}
        {error && <p className="error-text">{error}</p>}
        <button className="btn solid">{isRegister ? '注册并登录' : '登录'}</button>
        <button className="ghost" type="button" onClick={() => setIsRegister(!isRegister)}>{isRegister ? '已有账号，去登录' : '没有账号，去注册'}</button>
        <p className="hint">演示账号：管理员 13800000001 / 商家 13800000002 / 企业用户 13800000003，密码均为 123456。</p>
      </form>
    </Shell>
  );
}

function Enterprise() {
  const [form, setForm] = useState({ company_name: '', license_no: '', license_image: '', contact_name: '', contact_phone: '' });
  const [message, setMessage] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await request('/enterprise/submit', { method: 'POST', body: JSON.stringify(form) });
    setMessage('企业认证已提交，等待平台审核。');
  };
  return (
    <Shell>
      <FormPanel title="企业认证" subtitle="提交营业执照、统一社会信用代码和联系人信息，审核通过后开启企业采购权限。">
        <form onSubmit={submit} className="form-grid">
          <input placeholder="企业名称" onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          <input placeholder="统一社会信用代码" onChange={(e) => setForm({ ...form, license_no: e.target.value })} />
          <input placeholder="营业执照图片 URL" onChange={(e) => setForm({ ...form, license_image: e.target.value })} />
          <input placeholder="联系人" onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          <input placeholder="联系电话" onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
          <button className="btn solid">提交审核</button>
        </form>
        {message && <p className="success-text">{message}</p>}
      </FormPanel>
    </Shell>
  );
}

function ActivitiesPage() {
  const [activities, setActivities] = useState<any[]>([]);
  useEffect(() => { request('/platform/activities').then(setActivities).catch(console.error); }, []);
  return (
    <Shell>
      <div className="content-area">
        <SectionTitle title="活动营销与专题展销" />
        <div className="activity-grid wide">
          {activities.map((item) => (
            <article className="activity-card" key={item.id}>
              <img src={item.banner} alt={item.name} />
              <div><span>{item.type}</span><h3>{item.name}</h3><p>{item.rule_text}</p><small>{item.starts_at} - {item.ends_at}</small></div>
            </article>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function FormPanel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <div className="form-panel"><h1>{title}</h1><p>{subtitle}</p>{children}</div>;
}

function MerchantCenter() {
  const [form, setForm] = useState({ shop_name: '', logo: '', intro: '', contact_phone: '', license_image: '', legal_person: '' });
  const [product, setProduct] = useState({ name: '', sub_title: '', brand: '', price: '', stock: '', min_order: '1', category_id: '1', main_image: '', details: '' });
  const [message, setMessage] = useState('');
  const submitMerchant = async (e: FormEvent) => {
    e.preventDefault();
    await request('/platform/merchant/apply', { method: 'POST', body: JSON.stringify(form) });
    setMessage('商家入驻申请已提交。');
  };
  const submitProduct = async (e: FormEvent) => {
    e.preventDefault();
    await request('/products', { method: 'POST', body: JSON.stringify(product) });
    setMessage('商品已提交平台审核。');
  };
  return (
    <Shell>
      <div className="dashboard-layout">
        <FormPanel title="商家入驻" subtitle="供应商提交店铺、资质与法人信息，平台审核通过后可发布商品。">
          <form className="form-grid" onSubmit={submitMerchant}>
            {[
              ['shop_name', '店铺名称'], ['logo', 'Logo URL'], ['intro', '店铺简介'], ['contact_phone', '联系电话'], ['license_image', '营业执照 URL'], ['legal_person', '法人姓名']
            ].map(([keyName, label]) => <input key={keyName} placeholder={label} onChange={(e) => setForm({ ...form, [keyName]: e.target.value })} />)}
            <button className="btn solid">提交入驻申请</button>
          </form>
        </FormPanel>
        <FormPanel title="商品发布" subtitle="商品默认进入待审核状态，审核通过后在前台上架展示。">
          <form className="form-grid" onSubmit={submitProduct}>
            {[
              ['name', '商品名称'], ['sub_title', '副标题'], ['brand', '品牌'], ['price', '价格'], ['stock', '库存'], ['min_order', '起购量'], ['main_image', '主图 URL'], ['details', '详情描述']
            ].map(([keyName, label]) => <input key={keyName} placeholder={label} onChange={(e) => setProduct({ ...product, [keyName]: e.target.value })} />)}
            <select value={product.category_id} onChange={(e) => setProduct({ ...product, category_id: e.target.value })}><option value="1">办公设备</option><option value="2">智能硬件</option><option value="3">企业软件</option><option value="4">办公耗材</option><option value="5">商超展销</option></select>
            <button className="btn solid">发布商品</button>
          </form>
        </FormPanel>
      </div>
      {message && <p className="success-text center">{message}</p>}
    </Shell>
  );
}

function Admin() {
  const [stats, setStats] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const load = () => {
    request('/platform/admin/stats').then(setStats).catch(console.error);
    request('/products?scope=all').then(setProducts).catch(console.error);
    request('/platform/merchant/applications').then(setMerchants).catch(console.error);
    request('/platform/admin/users').then(setUsers).catch(console.error);
  };
  useEffect(() => { load(); }, []);
  const reviewProduct = async (id: number, status: string) => {
    await request(`/products/${id}/review`, { method: 'PUT', body: JSON.stringify({ status }) });
    load();
  };
  const auditMerchant = async (id: number, status: string) => {
    await request('/platform/merchant/audit', { method: 'POST', body: JSON.stringify({ id, status }) });
    load();
  };
  return (
    <Shell>
      <div className="admin-page">
        <SectionTitle title="运营后台" />
        <div className="stat-grid">
          {[
            [LayoutDashboard, '用户数', stats?.users || 0],
            [Package, '商品数', stats?.products || 0],
            [ShoppingCart, '订单数', stats?.orders || 0],
            [BarChart3, 'GMV', `¥${Number(stats?.gmv || 0).toLocaleString()}`],
            [Store, '待审商家', stats?.pending_merchants || 0],
            [ClipboardCheck, '待审企业', stats?.pending_certs || 0]
          ].map(([Icon, label, value]: any) => <article key={label}><Icon size={24} /><span>{label}</span><strong>{value}</strong></article>)}
        </div>

        <AdminTable title="商品审核" rows={products} columns={['商品', '价格', '库存', '状态', '操作']} render={(p) => (
          <tr key={p.id}><td>{p.name}</td><td>¥{p.price}</td><td>{p.stock}</td><td>{p.status}</td><td><button onClick={() => reviewProduct(p.id, 'APPROVED')}><CheckCircle2 size={16} />通过</button><button onClick={() => reviewProduct(p.id, 'REJECTED')}><XCircle size={16} />驳回</button></td></tr>
        )} />

        <AdminTable title="商家审核" rows={merchants} columns={['店铺', '联系人', '状态', '操作']} render={(m) => (
          <tr key={m.id}><td>{m.shop_name}</td><td>{m.contact_phone}</td><td>{m.status}</td><td><button onClick={() => auditMerchant(m.id, 'APPROVED')}>通过</button><button onClick={() => auditMerchant(m.id, 'REJECTED')}>驳回</button></td></tr>
        )} />

        <AdminTable title="用户管理" rows={users} columns={['手机号', '昵称', '角色', '企业认证', '状态']} render={(u) => (
          <tr key={u.id}><td>{u.phone}</td><td>{u.nickname}</td><td>{u.role}</td><td>{u.enterprise_status}</td><td>{u.status}</td></tr>
        )} />
      </div>
    </Shell>
  );
}

function AdminTable({ title, rows, columns, render }: { title: string; rows: any[]; columns: string[]; render: (row: any) => ReactNode }) {
  return (
    <section className="table-section">
      <h2>{title}</h2>
      <table>
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map(render)}</tbody>
      </table>
    </section>
  );
}

function Messages() {
  const [messages, setMessages] = useState<any[]>([]);
  useEffect(() => { request('/platform/messages').then(setMessages).catch(console.error); }, []);
  return (
    <Shell>
      <div className="content-area narrow">
        <SectionTitle title="消息通知" />
        {messages.map((msg) => <article className="order-card" key={msg.id}><strong>{msg.title}</strong><p>{msg.content}</p><small>{msg.created_at}</small></article>)}
      </div>
    </Shell>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Login />} />
        <Route path="/enterprise" element={<Enterprise />} />
        <Route path="/enterprise-cert" element={<Enterprise />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/merchant/*" element={<MerchantCenter />} />
        <Route path="/admin/*" element={<Admin />} />
        <Route path="/messages" element={<Messages />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
