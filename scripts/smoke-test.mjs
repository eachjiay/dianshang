const API = process.env.API_BASE || 'http://localhost:5000/api';
const stamp = Date.now().toString().slice(-8);

const state = {
  adminToken: '',
  merchantToken: '',
  buyerToken: '',
  buyerId: 0,
  merchantId: 0,
  productId: 0,
  addressId: 0,
  orderId: 0,
  aftersaleId: 0,
  certId: 0,
  merchantApplicationId: 0
};

async function http(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function raw(path, { token } = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${text}`);
  return text;
}

async function step(name, fn) {
  try {
    const data = await fn();
    console.log(`OK  ${name}`);
    return data;
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.message);
    process.exitCode = 1;
    throw error;
  }
}

async function login(phone, password = '123456') {
  const data = await http('/auth/login', { method: 'POST', body: { phone, password } });
  return data.token;
}

await step('健康检查', async () => {
  const res = await fetch(`${API.replace('/api', '')}/health`);
  if (!res.ok) throw new Error(`health -> ${res.status}`);
});

await step('演示账号登录', async () => {
  state.adminToken = await login('13800000001');
  state.merchantToken = await login('13800000002');
  state.buyerToken = await login('13800000003');
});

await step('新用户注册登录', async () => {
  const phone = `139${stamp}`;
  await http('/auth/register', { method: 'POST', body: { phone, password: '123456', nickname: '冒烟测试用户' } });
  const data = await http('/auth/login', { method: 'POST', body: { phone, password: '123456' } });
  state.buyerId = data.user.id;
});

await step('企业认证提交、列表、审核、状态查询', async () => {
  const phone = `137${stamp}`;
  await http('/auth/register', { method: 'POST', body: { phone, password: '123456', nickname: '测试企业用户' } });
  const token = await login(phone);
  await http('/enterprise/submit', {
    token,
    method: 'POST',
    body: {
      company_name: `测试企业${stamp}`,
      license_no: `LIC${stamp}`,
      license_image: 'https://example.com/license.png',
      contact_name: '测试联系人',
      contact_phone: phone
    }
  });
  const list = await http('/enterprise/applications', { token: state.adminToken });
  const cert = list.find((item) => item.license_no === `LIC${stamp}`);
  if (!cert) throw new Error('未找到企业认证申请');
  state.certId = cert.id;
  await http('/enterprise/audit', { token: state.adminToken, method: 'POST', body: { id: cert.id, status: 'APPROVED' } });
  const status = await http('/enterprise/status', { token });
  if (status.status !== 'APPROVED') throw new Error('企业认证状态未通过');
});

await step('商家入驻申请、列表、审核', async () => {
  const phone = `136${stamp}`;
  await http('/auth/register', { method: 'POST', body: { phone, password: '123456', nickname: '测试供应商' } });
  const token = await login(phone);
  await http('/platform/merchant/apply', {
    token,
    method: 'POST',
    body: {
      shop_name: `测试店铺${stamp}`,
      logo: 'https://example.com/logo.png',
      intro: '自动验收商家',
      contact_phone: phone,
      license_image: 'https://example.com/license.png',
      legal_person: '测试法人'
    }
  });
  const list = await http('/platform/merchant/applications', { token: state.adminToken });
  const merchant = list.find((item) => item.shop_name === `测试店铺${stamp}`);
  if (!merchant) throw new Error('未找到商家入驻申请');
  state.merchantApplicationId = merchant.id;
  await http('/platform/merchant/audit', { token: state.adminToken, method: 'POST', body: { id: merchant.id, status: 'APPROVED' } });
});

await step('类目、活动创建与前台查询', async () => {
  await http('/platform/categories', {
    token: state.adminToken,
    method: 'POST',
    body: { name: `测试类目${stamp}`, icon: 'Package', sort_order: 99, is_active: 1 }
  });
  const categories = await http('/platform/categories');
  if (!categories.some((item) => item.name === `测试类目${stamp}`)) throw new Error('类目创建失败');
  await http('/platform/activities', {
    token: state.adminToken,
    method: 'POST',
    body: {
      name: `测试活动${stamp}`,
      type: '满减',
      banner: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=1200&auto=format&fit=crop',
      rule_text: '满 100 减 10',
      starts_at: '2026-04-01',
      ends_at: '2026-12-31',
      status: 'APPROVED',
      sort_order: 9
    }
  });
  const activities = await http('/platform/activities');
  if (!activities.some((item) => item.name === `测试活动${stamp}`)) throw new Error('活动未出现在前台');
});

await step('优惠券创建、领取、查询', async () => {
  const coupon = await http('/platform/coupons', {
    token: state.adminToken,
    method: 'POST',
    body: { title: `测试优惠券${stamp}`, threshold_amount: 100, discount_amount: 10, total_count: 20, status: 'ACTIVE' }
  });
  const coupons = await http('/platform/coupons');
  if (!coupons.some((item) => item.id === coupon.id)) throw new Error('优惠券未展示');
  await http('/platform/coupons/claim', { token: state.buyerToken, method: 'POST', body: { coupon_id: coupon.id } });
  const myCoupons = await http('/platform/coupons/my', { token: state.buyerToken });
  if (!myCoupons.some((item) => item.coupon_id === coupon.id)) throw new Error('优惠券领取失败');
});

await step('商家商品发布、后台审核、搜索筛选详情推荐', async () => {
  await http('/products', {
    token: state.merchantToken,
    method: 'POST',
    body: {
      name: `自动验收商品${stamp}`,
      sub_title: '用于全链路验收',
      brand: 'SmokeBrand',
      unit: '件',
      price: 99,
      stock: 20,
      min_order: 1,
      category_id: 1,
      main_image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=900&auto=format&fit=crop',
      details: '商品发布、审核、购买、评价链路测试。'
    }
  });
  const allProducts = await http('/products?scope=all', { token: state.adminToken });
  const product = allProducts.find((item) => item.name === `自动验收商品${stamp}`);
  if (!product) throw new Error('未找到待审核商品');
  state.productId = product.id;
  await http(`/products/${product.id}/review`, { token: state.adminToken, method: 'PUT', body: { status: 'APPROVED' } });
  const searched = await http(`/products?search=${encodeURIComponent('自动验收商品')}&category=1&sort=price_asc&inStock=1`);
  if (!searched.some((item) => item.id === product.id)) throw new Error('商品搜索筛选失败');
  const detail = await http(`/products/${product.id}`);
  if (!detail.id || !Array.isArray(detail.recommendations)) throw new Error('商品详情异常');
  state.merchantId = detail.merchant_id;
});

await step('收货地址、购物车、提交订单', async () => {
  await http('/address', {
    token: state.buyerToken,
    method: 'POST',
    body: {
      receiver_name: '测试收货人',
      receiver_phone: '13800000003',
      province: '广东省',
      city: '深圳市',
      district: '南山区',
      detail_address: '科技园 1 号',
      is_default: true
    }
  });
  const addresses = await http('/address', { token: state.buyerToken });
  state.addressId = addresses[0].id;
  await http('/cart/add', { token: state.buyerToken, method: 'POST', body: { product_id: state.productId, quantity: 2 } });
  const cart = await http('/cart', { token: state.buyerToken });
  if (!cart.some((item) => item.product_id === state.productId)) throw new Error('购物车未包含商品');
  const order = await http('/orders/create', {
    token: state.buyerToken,
    method: 'POST',
    body: {
      items: [{ product_id: state.productId, quantity: 2 }],
      shipping_address_id: state.addressId,
      invoice_title: '测试企业发票',
      freight_amount: 0
    }
  });
  state.orderId = order.orderId;
});

await step('支付幂等、商家发货、订单查询', async () => {
  await http('/orders/pay', { token: state.buyerToken, method: 'POST', body: { orderId: state.orderId, method: 'WECHAT', trade_no: `PAY${stamp}` } });
  await http('/orders/pay', { token: state.buyerToken, method: 'POST', body: { orderId: state.orderId, method: 'WECHAT', trade_no: `PAY${stamp}` } });
  await http('/orders/update-status', {
    token: state.merchantToken,
    method: 'POST',
    body: { orderId: state.orderId, status: 'SHIPPED', logistics_company: '顺丰速运', logistics_no: `SF${stamp}` }
  });
  const orders = await http('/orders', { token: state.buyerToken });
  const order = orders.find((item) => item.id === state.orderId);
  if (!order || order.status !== 'SHIPPED') throw new Error('订单状态未流转到已发货');
});

await step('收藏、店铺关注、评价、内容互动', async () => {
  await http('/platform/favorites', { token: state.buyerToken, method: 'POST', body: { product_id: state.productId } });
  const favorites = await http('/platform/favorites', { token: state.buyerToken });
  if (!favorites.some((item) => item.product_id === state.productId)) throw new Error('商品收藏失败');
  await http('/platform/follows', { token: state.buyerToken, method: 'POST', body: { merchant_id: state.merchantId } });
  const follows = await http('/platform/follows', { token: state.buyerToken });
  if (!follows.some((item) => item.merchant_id === state.merchantId)) throw new Error('店铺关注失败');
  await http('/platform/comments', {
    token: state.buyerToken,
    method: 'POST',
    body: { product_id: state.productId, order_id: state.orderId, rating: 5, content: '自动验收评价' }
  });
  const detail = await http(`/products/${state.productId}`);
  if (!detail.comments.some((item) => item.content === '自动验收评价')) throw new Error('评价未展示');
  const posts = await http('/platform/content');
  if (!posts.length) throw new Error('内容列表为空');
  await http('/platform/content/interact', { token: state.buyerToken, method: 'POST', body: { post_id: posts[0].id, type: 'VIEW' } });
  await http('/platform/content/interact', { token: state.buyerToken, method: 'POST', body: { post_id: posts[0].id, type: 'LIKE' } });
  await http('/platform/content/interact', { token: state.buyerToken, method: 'POST', body: { post_id: posts[0].id, type: 'COMMENT', content: '自动验收内容评论' } });
});

await step('售后申请、售后审核、消息通知', async () => {
  const aftersale = await http('/platform/aftersales', {
    token: state.buyerToken,
    method: 'POST',
    body: { order_id: state.orderId, type: '退款', reason: '自动验收退款' }
  });
  state.aftersaleId = aftersale.id;
  await http('/platform/aftersales/audit', { token: state.adminToken, method: 'POST', body: { id: state.aftersaleId, status: 'APPROVED', handler_note: '同意退款' } });
  const messages = await http('/platform/messages', { token: state.buyerToken });
  if (!messages.length) throw new Error('消息通知为空');
});

await step('后台统计、用户管理', async () => {
  const stats = await http('/platform/admin/stats', { token: state.adminToken });
  if (typeof stats.gmv !== 'number') throw new Error('统计数据异常');
  const users = await http('/platform/admin/users', { token: state.adminToken });
  if (!users.length) throw new Error('用户列表为空');
  await http('/platform/admin/configs', { token: state.adminToken, method: 'POST', body: { config_key: 'sms.provider', config_value: 'mock', remark: '冒烟测试' } });
  const configs = await http('/platform/admin/configs', { token: state.adminToken });
  if (!configs.some((item) => item.config_key === 'sms.provider')) throw new Error('系统配置保存失败');
  const logs = await http('/platform/admin/logs', { token: state.adminToken });
  if (!logs.length) throw new Error('审计日志为空');
  const csv = await raw('/platform/admin/reports/orders.csv', { token: state.adminToken });
  if (!csv.includes('total_amount')) throw new Error('订单报表导出失败');
});

console.log('\n全部冒烟验收通过。');
