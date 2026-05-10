package com.diquan.backend;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
class DatabaseInitializer implements ApplicationRunner {
    private final Sql sql;
    private final BCryptPasswordEncoder passwordEncoder;

    DatabaseInitializer(Sql sql, BCryptPasswordEncoder passwordEncoder) {
        this.sql = sql;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        createTables();
        ensureColumns();
        seedData();
        System.out.println("Database initialized");
    }

    private void createTables() {
        sql.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT UNIQUE,
                password TEXT,
                nickname TEXT,
                avatar TEXT,
                role TEXT DEFAULT 'USER',
                enterprise_status TEXT DEFAULT 'NONE',
                status TEXT DEFAULT 'ACTIVE',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS enterprise_info (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE,
                company_name TEXT,
                license_no TEXT,
                license_image TEXT,
                contact_name TEXT,
                contact_phone TEXT,
                status TEXT DEFAULT 'PENDING',
                reject_reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                parent_id INTEGER DEFAULT 0,
                name TEXT,
                icon TEXT,
                sort_order INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                merchant_id INTEGER,
                category_id INTEGER,
                name TEXT,
                sub_title TEXT,
                brand TEXT,
                unit TEXT DEFAULT '件',
                price REAL,
                stock INTEGER,
                min_order INTEGER DEFAULT 1,
                main_image TEXT,
                details TEXT,
                status TEXT DEFAULT 'PENDING',
                sales INTEGER DEFAULT 0,
                reject_reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(merchant_id) REFERENCES users(id)
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS cart (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                product_id INTEGER,
                quantity INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(product_id) REFERENCES products(id)
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS addresses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                receiver_name TEXT,
                receiver_phone TEXT,
                province TEXT,
                city TEXT,
                district TEXT,
                detail_address TEXT,
                is_default INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                total_amount REAL,
                discount_amount REAL DEFAULT 0,
                freight_amount REAL DEFAULT 0,
                status TEXT DEFAULT 'UNPAID',
                shipping_address_id INTEGER,
                invoice_title TEXT,
                payment_method TEXT,
                logistics_company TEXT,
                logistics_no TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(shipping_address_id) REFERENCES addresses(id)
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER,
                product_id INTEGER,
                quantity INTEGER,
                price REAL,
                FOREIGN KEY(order_id) REFERENCES orders(id),
                FOREIGN KEY(product_id) REFERENCES products(id)
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS merchant_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE,
                shop_name TEXT,
                logo TEXT,
                intro TEXT,
                contact_phone TEXT,
                license_image TEXT,
                legal_person TEXT,
                status TEXT DEFAULT 'PENDING',
                reject_reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS payment_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER,
                trade_no TEXT UNIQUE,
                method TEXT,
                amount REAL,
                status TEXT,
                raw_payload TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS aftersales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER,
                user_id INTEGER,
                type TEXT,
                reason TEXT,
                evidence TEXT,
                status TEXT DEFAULT 'PENDING',
                handler_note TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                type TEXT,
                banner TEXT,
                rule_text TEXT,
                starts_at TEXT,
                ends_at TEXT,
                status TEXT DEFAULT 'PENDING',
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS coupons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                threshold_amount REAL DEFAULT 0,
                discount_amount REAL DEFAULT 0,
                total_count INTEGER DEFAULT 0,
                received_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'ACTIVE'
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS user_coupons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                coupon_id INTEGER,
                status TEXT DEFAULT 'UNUSED',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, coupon_id)
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                product_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, product_id)
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS shop_follows (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                merchant_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, merchant_id)
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                product_id INTEGER,
                order_id INTEGER,
                rating INTEGER DEFAULT 5,
                content TEXT,
                status TEXT DEFAULT 'PENDING',
                merchant_reply TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS content_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                content TEXT,
                cover TEXT,
                status TEXT DEFAULT 'APPROVED',
                views INTEGER DEFAULT 0,
                likes INTEGER DEFAULT 0,
                shares INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS content_interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                post_id INTEGER,
                type TEXT,
                content TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                title TEXT,
                content TEXT,
                type TEXT,
                is_read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT,
                target_type TEXT,
                target_id INTEGER,
                detail TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """);

        sql.execute("""
            CREATE TABLE IF NOT EXISTS system_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_key TEXT UNIQUE,
                config_value TEXT,
                remark TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """);
    }

    private void ensureColumns() {
        ensureColumn("users", "status", "TEXT DEFAULT 'ACTIVE'");
        ensureColumn("products", "brand", "TEXT");
        ensureColumn("products", "unit", "TEXT DEFAULT '件'");
        ensureColumn("products", "min_order", "INTEGER DEFAULT 1");
        ensureColumn("products", "sales", "INTEGER DEFAULT 0");
        ensureColumn("products", "reject_reason", "TEXT");
        ensureColumn("orders", "discount_amount", "REAL DEFAULT 0");
        ensureColumn("orders", "freight_amount", "REAL DEFAULT 0");
        ensureColumn("orders", "invoice_title", "TEXT");
        ensureColumn("orders", "payment_method", "TEXT");
        ensureColumn("orders", "logistics_company", "TEXT");
        ensureColumn("orders", "logistics_no", "TEXT");
    }

    private void ensureColumn(String table, String column, String ddl) {
        boolean exists = sql.list("PRAGMA table_info(" + table + ")")
            .stream()
            .anyMatch(row -> column.equals(row.get("name")));
        if (!exists) {
            sql.execute("ALTER TABLE " + table + " ADD COLUMN " + column + " " + ddl);
        }
    }

    private void seedData() {
        if (count("categories") == 0) {
            sql.update("INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)", "办公设备", "Laptop", 1);
            sql.update("INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)", "智能硬件", "Cpu", 2);
            sql.update("INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)", "企业软件", "Boxes", 3);
            sql.update("INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)", "办公耗材", "Package", 4);
            sql.update("INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)", "商超展销", "Store", 5);
        }

        String demoHash = passwordEncoder.encode("123456");
        List<Object[]> users = List.of(
            new Object[]{"13800000001", "平台管理员", "ADMIN", "NONE"},
            new Object[]{"13800000002", "优选供应商", "MERCHANT", "NONE"},
            new Object[]{"13800000003", "企业采购员", "ENTERPRISE", "APPROVED"}
        );
        for (Object[] user : users) {
            sql.update("""
                INSERT INTO users (phone, password, nickname, role, enterprise_status, status)
                VALUES (?, ?, ?, ?, ?, 'ACTIVE')
                ON CONFLICT(phone) DO UPDATE SET
                    password=excluded.password,
                    nickname=excluded.nickname,
                    role=excluded.role,
                    enterprise_status=excluded.enterprise_status,
                    status='ACTIVE'
                """, user[0], demoHash, user[1], user[2], user[3]);
        }

        Map<String, Object> merchantUser = sql.one("SELECT id FROM users WHERE phone = ?", "13800000002");
        if (merchantUser != null) {
            long merchantId = Values.longValue(merchantUser.get("id"));
            sql.update("""
                INSERT INTO merchant_profiles (user_id, shop_name, logo, intro, contact_phone, status)
                VALUES (?, ?, ?, ?, ?, 'APPROVED')
                ON CONFLICT(user_id) DO UPDATE SET
                    shop_name=excluded.shop_name,
                    logo=excluded.logo,
                    intro=excluded.intro,
                    contact_phone=excluded.contact_phone,
                    status='APPROVED'
                """,
                merchantId,
                "帝全优选供应链",
                "https://images.unsplash.com/photo-1560472355-536de3962603?q=80&w=400&auto=format&fit=crop",
                "办公设备、商超展销和企业采购综合供应商",
                "13800000002"
            );

            if (count("products") == 0) {
                seedProducts(merchantId);
            }
        }

        Map<String, Object> enterpriseUser = sql.one("SELECT id FROM users WHERE phone = ?", "13800000003");
        if (enterpriseUser != null) {
            sql.update("""
                INSERT INTO enterprise_info (user_id, company_name, license_no, contact_name, contact_phone, status)
                VALUES (?, ?, ?, ?, ?, 'APPROVED')
                ON CONFLICT(user_id) DO UPDATE SET
                    company_name=excluded.company_name,
                    license_no=excluded.license_no,
                    contact_name=excluded.contact_name,
                    contact_phone=excluded.contact_phone,
                    status='APPROVED'
                """,
                Values.longValue(enterpriseUser.get("id")),
                "深圳星河科技有限公司",
                "91440300MA5DEMO001",
                "王采购",
                "13800000003"
            );
        }

        if (count("activities") == 0) {
            sql.update("INSERT INTO activities (name, type, banner, rule_text, starts_at, ends_at, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                "企业采购季",
                "满减",
                "https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=1200&auto=format&fit=crop",
                "满 5000 减 300，企业认证用户可叠加专属报价。",
                "2026-04-01",
                "2026-06-30",
                "APPROVED",
                1
            );
            sql.update("INSERT INTO activities (name, type, banner, rule_text, starts_at, ends_at, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                "商超展销专题",
                "商超展销专题活动",
                "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=1200&auto=format&fit=crop",
                "线上浏览、线下展销、供需撮合一体化。",
                "2026-04-15",
                "2026-05-31",
                "APPROVED",
                2
            );
        }

        if (count("coupons") == 0) {
            sql.update("INSERT INTO coupons (title, threshold_amount, discount_amount, total_count, status) VALUES (?, ?, ?, ?, ?)", "企业采购满减券", 5000, 300, 500, "ACTIVE");
            sql.update("INSERT INTO coupons (title, threshold_amount, discount_amount, total_count, status) VALUES (?, ?, ?, ?, ?)", "新用户采购券", 1000, 80, 1000, "ACTIVE");
        }

        if (count("content_posts") == 0) {
            sql.update("INSERT INTO content_posts (title, content, cover, status) VALUES (?, ?, ?, ?)",
                "企业采购数字化指南",
                "围绕选品、审批、履约和对账，帮助企业搭建高效采购流程。",
                "https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=1200&auto=format&fit=crop",
                "APPROVED"
            );
            sql.update("INSERT INTO content_posts (title, content, cover, status) VALUES (?, ?, ?, ?)",
                "商超展销活动筹备清单",
                "从展位搭建、商品组合到线上活动承接，提升线下转化效率。",
                "https://images.unsplash.com/photo-1556741533-6e6a62bd8b49?q=80&w=1200&auto=format&fit=crop",
                "APPROVED"
            );
        }
    }

    private void seedProducts(long merchantId) {
        List<Object[]> products = List.of(
            new Object[]{merchantId, 1, "商用笔记本 ProBook 14", "企业批量采购优选，三年质保", "Diquan", "台", 5299, 120, 2, "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=900&auto=format&fit=crop", "适用于办公、财务、人事和移动会议场景，支持批量采购报价。", 316},
            new Object[]{merchantId, 1, "人体工学办公椅", "久坐办公支撑，商超展销爆款", "ErgoMax", "把", 899, 360, 5, "https://images.unsplash.com/photo-1592078615290-033ee584e267?q=80&w=900&auto=format&fit=crop", "网布透气、腰托可调，适合企业办公区统一采购。", 520},
            new Object[]{merchantId, 2, "智能会议一体机 65 寸", "远程协同、无线投屏、白板批注", "MeetHub", "台", 12800, 32, 1, "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=900&auto=format&fit=crop", "覆盖会议室、培训室、展销现场直播讲解等多场景。", 76},
            new Object[]{merchantId, 3, "企业协同办公年包", "账号、流程、文档一体化", "WorkSuite", "套", 4200, 999, 1, "https://images.unsplash.com/photo-1553877522-43269d4ea984?q=80&w=900&auto=format&fit=crop", "提供组织通讯录、审批流、项目任务和数据看板。", 188},
            new Object[]{merchantId, 4, "A4 复印纸整箱装", "高白不卡纸，企业月度补货", "PaperOne", "箱", 169, 2000, 10, "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?q=80&w=900&auto=format&fit=crop", "适用于打印、复印、合同档案输出。", 1460},
            new Object[]{merchantId, 5, "商超展销组合货架", "线下展销快速布展套装", "ExpoKit", "套", 2680, 56, 1, "https://images.unsplash.com/photo-1556741533-6e6a62bd8b49?q=80&w=900&auto=format&fit=crop", "包含展示架、灯箱、标价牌和收纳运输箱。", 92}
        );

        for (Object[] product : products) {
            sql.update("""
                INSERT INTO products (merchant_id, category_id, name, sub_title, brand, unit, price, stock, min_order, main_image, details, status, sales)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?)
                """, product);
        }
    }

    private long count(String table) {
        return Values.longValue(sql.one("SELECT COUNT(*) AS count FROM " + table).get("count"));
    }
}
