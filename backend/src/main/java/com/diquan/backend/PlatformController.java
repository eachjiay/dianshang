package com.diquan.backend;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/platform")
class PlatformController {
    private final Sql sql;
    private final AuthService authService;

    PlatformController(Sql sql, AuthService authService) {
        this.sql = sql;
        this.authService = authService;
    }

    @GetMapping("/categories")
    List<Map<String, Object>> getCategories() {
        return sql.list("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, id ASC");
    }

    @PostMapping("/categories")
    Map<String, Object> saveCategory(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        authService.requireRole(request, "ADMIN");
        Object id = body.get("id");
        if (id != null) {
            sql.update(
                "UPDATE categories SET parent_id=?, name=?, icon=?, sort_order=?, is_active=? WHERE id=?",
                body.getOrDefault("parent_id", 0),
                body.get("name"),
                body.get("icon"),
                body.getOrDefault("sort_order", 0),
                body.getOrDefault("is_active", 1),
                id
            );
            return Map.of("message", "类目已更新");
        }
        long createdId = sql.insert(
            "INSERT INTO categories (parent_id, name, icon, sort_order, is_active) VALUES (?, ?, ?, ?, ?)",
            body.getOrDefault("parent_id", 0),
            body.get("name"),
            body.get("icon"),
            body.getOrDefault("sort_order", 0),
            body.getOrDefault("is_active", 1)
        );
        return Map.of("id", createdId, "message", "类目已创建");
    }

    @GetMapping("/activities")
    List<Map<String, Object>> getActivities(@RequestParam(required = false) String scope) {
        return sql.list(
            "SELECT * FROM activities " + ("all".equals(scope) ? "" : "WHERE status = 'APPROVED' ") + "ORDER BY sort_order ASC, created_at DESC"
        );
    }

    @PostMapping("/activities")
    Map<String, Object> saveActivity(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        authService.requireRole(request, "ADMIN");
        Object id = body.get("id");
        if (id != null) {
            sql.update(
                "UPDATE activities SET name=?, type=?, banner=?, rule_text=?, starts_at=?, ends_at=?, status=?, sort_order=? WHERE id=?",
                body.get("name"),
                body.get("type"),
                body.get("banner"),
                body.get("rule_text"),
                body.get("starts_at"),
                body.get("ends_at"),
                Values.text(body, "status", "PENDING"),
                body.getOrDefault("sort_order", 0),
                id
            );
            return Map.of("message", "活动已更新");
        }
        long createdId = sql.insert(
            "INSERT INTO activities (name, type, banner, rule_text, starts_at, ends_at, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            body.get("name"),
            body.get("type"),
            body.get("banner"),
            body.get("rule_text"),
            body.get("starts_at"),
            body.get("ends_at"),
            Values.text(body, "status", "PENDING"),
            body.getOrDefault("sort_order", 0)
        );
        return Map.of("id", createdId, "message", "活动已创建");
    }

    @GetMapping("/coupons")
    List<Map<String, Object>> getCoupons() {
        return sql.list("SELECT * FROM coupons WHERE status = 'ACTIVE' ORDER BY id DESC");
    }

    @PostMapping("/coupons")
    Map<String, Object> saveCoupon(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        authService.requireRole(request, "ADMIN");
        Object id = body.get("id");
        if (id != null) {
            sql.update(
                "UPDATE coupons SET title=?, threshold_amount=?, discount_amount=?, total_count=?, status=? WHERE id=?",
                body.get("title"),
                body.getOrDefault("threshold_amount", 0),
                body.getOrDefault("discount_amount", 0),
                body.getOrDefault("total_count", 0),
                Values.text(body, "status", "ACTIVE"),
                id
            );
            return Map.of("message", "优惠券已更新");
        }
        long createdId = sql.insert(
            "INSERT INTO coupons (title, threshold_amount, discount_amount, total_count, status) VALUES (?, ?, ?, ?, ?)",
            body.get("title"),
            body.getOrDefault("threshold_amount", 0),
            body.getOrDefault("discount_amount", 0),
            body.getOrDefault("total_count", 0),
            Values.text(body, "status", "ACTIVE")
        );
        return Map.of("id", createdId, "message", "优惠券已创建");
    }

    @PostMapping("/coupons/claim")
    Map<String, String> claimCoupon(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        AuthenticatedUser user = authService.requireUser(request);
        Object couponId = body.get("coupon_id");
        Map<String, Object> coupon = sql.one("SELECT * FROM coupons WHERE id = ? AND status = 'ACTIVE'", couponId);
        if (coupon == null) throw new ApiException(org.springframework.http.HttpStatus.NOT_FOUND, "优惠券不存在");
        if (Values.intValue(coupon.get("total_count")) > 0 && Values.intValue(coupon.get("received_count")) >= Values.intValue(coupon.get("total_count"))) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "优惠券已领完");
        }
        sql.update("INSERT OR IGNORE INTO user_coupons (user_id, coupon_id) VALUES (?, ?)", user.id(), couponId);
        sql.update("UPDATE coupons SET received_count = received_count + 1 WHERE id = ? AND received_count < total_count", couponId);
        return Map.of("message", "优惠券领取成功");
    }

    @GetMapping("/coupons/my")
    List<Map<String, Object>> myCoupons(HttpServletRequest request) {
        AuthenticatedUser user = authService.requireUser(request);
        return sql.list("""
            SELECT uc.*, c.title, c.threshold_amount, c.discount_amount
            FROM user_coupons uc JOIN coupons c ON uc.coupon_id = c.id
            WHERE uc.user_id = ? ORDER BY uc.created_at DESC
            """, user.id());
    }

    @PostMapping("/merchant/apply")
    Map<String, String> applyMerchant(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        AuthenticatedUser user = authService.requireUser(request);
        sql.update("""
            INSERT INTO merchant_profiles (user_id, shop_name, logo, intro, contact_phone, license_image, legal_person, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
            ON CONFLICT(user_id) DO UPDATE SET
                shop_name=excluded.shop_name,
                logo=excluded.logo,
                intro=excluded.intro,
                contact_phone=excluded.contact_phone,
                license_image=excluded.license_image,
                legal_person=excluded.legal_person,
                status='PENDING'
            """,
            user.id(),
            body.get("shop_name"),
            body.get("logo"),
            body.get("intro"),
            body.get("contact_phone"),
            body.get("license_image"),
            body.get("legal_person")
        );
        sql.update("UPDATE users SET role = 'MERCHANT' WHERE id = ?", user.id());
        return Map.of("message", "商家入驻申请已提交");
    }

    @GetMapping("/merchant/applications")
    List<Map<String, Object>> listMerchants(HttpServletRequest request) {
        authService.requireRole(request, "ADMIN");
        return sql.list("""
            SELECT mp.*, u.phone, u.nickname FROM merchant_profiles mp
            JOIN users u ON mp.user_id = u.id
            ORDER BY mp.created_at DESC
            """);
    }

    @PostMapping("/merchant/audit")
    Map<String, String> auditMerchant(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        authService.requireRole(request, "ADMIN");
        Object id = body.get("id");
        Map<String, Object> merchant = sql.one("SELECT * FROM merchant_profiles WHERE id = ?", id);
        if (merchant == null) throw new ApiException(org.springframework.http.HttpStatus.NOT_FOUND, "商家申请不存在");

        String status = Values.text(body, "status");
        String rejectReason = Values.text(body, "reject_reason", "");
        sql.update("UPDATE merchant_profiles SET status = ?, reject_reason = ? WHERE id = ?", status, rejectReason, id);
        sql.update(
            "INSERT INTO messages (user_id, title, content, type) VALUES (?, ?, ?, ?)",
            merchant.get("user_id"),
            "商家审核结果",
            "APPROVED".equals(status) ? "您的商家入驻申请已通过。" : "您的商家入驻申请被驳回：" + (Values.hasText(rejectReason) ? rejectReason : "资料需补充"),
            "AUDIT"
        );
        return Map.of("message", "商家审核已更新");
    }

    @PostMapping("/aftersales")
    Map<String, Object> createAfterSale(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        AuthenticatedUser user = authService.requireUser(request);
        Object orderId = body.get("order_id");
        Map<String, Object> order = sql.one("SELECT * FROM orders WHERE id = ? AND user_id = ?", orderId, user.id());
        if (order == null) throw new ApiException(org.springframework.http.HttpStatus.NOT_FOUND, "订单不存在");
        long id = sql.insert(
            "INSERT INTO aftersales (order_id, user_id, type, reason, evidence) VALUES (?, ?, ?, ?, ?)",
            orderId,
            user.id(),
            body.get("type"),
            body.get("reason"),
            body.get("evidence")
        );
        sql.update("UPDATE orders SET status = 'AFTERSALE' WHERE id = ?", orderId);
        return Map.of("id", id, "message", "售后申请已提交");
    }

    @GetMapping("/aftersales")
    List<Map<String, Object>> listAfterSales(HttpServletRequest request) {
        AuthenticatedUser user = authService.requireUser(request);
        if ("ADMIN".equals(user.role())) {
            return sql.list("SELECT a.*, u.nickname FROM aftersales a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC");
        }
        return sql.list("SELECT * FROM aftersales WHERE user_id = ? ORDER BY created_at DESC", user.id());
    }

    @PostMapping("/aftersales/audit")
    Map<String, String> auditAfterSale(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        authService.requireRole(request, "ADMIN", "MERCHANT");
        Object id = body.get("id");
        Map<String, Object> aftersale = sql.one("SELECT * FROM aftersales WHERE id = ?", id);
        if (aftersale == null) throw new ApiException(org.springframework.http.HttpStatus.NOT_FOUND, "售后单不存在");

        String status = Values.text(body, "status");
        sql.update("UPDATE aftersales SET status = ?, handler_note = ? WHERE id = ?", status, Values.text(body, "handler_note", ""), id);
        if ("APPROVED".equals(status)) {
            sql.update("UPDATE orders SET status = 'REFUNDED' WHERE id = ?", aftersale.get("order_id"));
        }
        sql.update(
            "INSERT INTO messages (user_id, title, content, type) VALUES (?, ?, ?, ?)",
            aftersale.get("user_id"),
            "售后处理结果",
            "售后单 #" + id + " 状态更新为 " + status,
            "AFTERSALE"
        );
        return Map.of("message", "售后状态已更新");
    }

    @PostMapping("/comments")
    Map<String, Object> addComment(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        AuthenticatedUser user = authService.requireUser(request);
        long id = sql.insert(
            "INSERT INTO comments (user_id, product_id, order_id, rating, content, status) VALUES (?, ?, ?, ?, ?, 'APPROVED')",
            user.id(),
            body.get("product_id"),
            body.get("order_id"),
            body.getOrDefault("rating", 5),
            body.get("content")
        );
        return Map.of("id", id, "message", "评价已发布");
    }

    @PostMapping("/favorites")
    Map<String, String> toggleFavorite(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        AuthenticatedUser user = authService.requireUser(request);
        sql.update("INSERT OR IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)", user.id(), body.get("product_id"));
        return Map.of("message", "商品已收藏");
    }

    @GetMapping("/favorites")
    List<Map<String, Object>> myFavorites(HttpServletRequest request) {
        AuthenticatedUser user = authService.requireUser(request);
        return sql.list("""
            SELECT f.*, p.name, p.price, p.main_image
            FROM favorites f JOIN products p ON f.product_id = p.id
            WHERE f.user_id = ? ORDER BY f.created_at DESC
            """, user.id());
    }

    @PostMapping("/follows")
    Map<String, String> followShop(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        AuthenticatedUser user = authService.requireUser(request);
        sql.update("INSERT OR IGNORE INTO shop_follows (user_id, merchant_id) VALUES (?, ?)", user.id(), body.get("merchant_id"));
        return Map.of("message", "店铺已关注");
    }

    @GetMapping("/follows")
    List<Map<String, Object>> myFollows(HttpServletRequest request) {
        AuthenticatedUser user = authService.requireUser(request);
        return sql.list("""
            SELECT sf.*, mp.shop_name, mp.logo
            FROM shop_follows sf JOIN merchant_profiles mp ON sf.merchant_id = mp.user_id
            WHERE sf.user_id = ? ORDER BY sf.created_at DESC
            """, user.id());
    }

    @GetMapping("/content")
    List<Map<String, Object>> getContentPosts() {
        return sql.list("SELECT * FROM content_posts WHERE status = 'APPROVED' ORDER BY created_at DESC");
    }

    @PostMapping("/content/interact")
    Map<String, String> interactContent(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        AuthenticatedUser user = authService.requireUser(request);
        Object postId = body.get("post_id");
        String type = Values.text(body, "type");
        sql.update("INSERT INTO content_interactions (user_id, post_id, type, content) VALUES (?, ?, ?, ?)", user.id(), postId, type, Values.text(body, "content", ""));
        if ("LIKE".equals(type)) sql.update("UPDATE content_posts SET likes = likes + 1 WHERE id = ?", postId);
        if ("SHARE".equals(type)) sql.update("UPDATE content_posts SET shares = shares + 1 WHERE id = ?", postId);
        if ("VIEW".equals(type)) sql.update("UPDATE content_posts SET views = views + 1 WHERE id = ?", postId);
        return Map.of("message", "互动已记录");
    }

    @GetMapping("/messages")
    List<Map<String, Object>> getMessages(HttpServletRequest request) {
        AuthenticatedUser user = authService.requireUser(request);
        return sql.list("SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC", user.id());
    }

    @GetMapping("/admin/stats")
    Map<String, Object> getAdminStats(HttpServletRequest request) {
        authService.requireRole(request, "ADMIN");
        Map<String, Object> users = sql.one("SELECT COUNT(*) AS count FROM users");
        Map<String, Object> products = sql.one("SELECT COUNT(*) AS count FROM products");
        Map<String, Object> orders = sql.one("SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS gmv FROM orders");
        Map<String, Object> merchants = sql.one("SELECT COUNT(*) AS count FROM merchant_profiles WHERE status = 'PENDING'");
        Map<String, Object> certs = sql.one("SELECT COUNT(*) AS count FROM enterprise_info WHERE status = 'PENDING'");
        Map<String, Object> aftersales = sql.one("SELECT COUNT(*) AS count FROM aftersales WHERE status = 'PENDING'");

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("users", users.get("count"));
        response.put("products", products.get("count"));
        response.put("orders", orders.get("count"));
        response.put("gmv", orders.get("gmv"));
        response.put("pending_merchants", merchants.get("count"));
        response.put("pending_certs", certs.get("count"));
        response.put("pending_aftersales", aftersales.get("count"));
        response.put("hotProducts", sql.list("SELECT name, sales, price FROM products ORDER BY sales DESC LIMIT 5"));
        return response;
    }

    @GetMapping("/admin/users")
    List<Map<String, Object>> listUsers(HttpServletRequest request) {
        authService.requireRole(request, "ADMIN");
        return sql.list("SELECT id, phone, nickname, role, enterprise_status, status, created_at FROM users ORDER BY created_at DESC");
    }

    @PostMapping("/admin/users/status")
    Map<String, String> updateUserStatus(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        authService.requireRole(request, "ADMIN");
        sql.update("UPDATE users SET status = ? WHERE id = ?", body.get("status"), body.get("id"));
        return Map.of("message", "用户状态已更新");
    }

    @GetMapping("/admin/logs")
    List<Map<String, Object>> getAuditLogs(HttpServletRequest request) {
        authService.requireRole(request, "ADMIN");
        return sql.list("""
            SELECT l.*, u.phone, u.nickname
            FROM audit_logs l LEFT JOIN users u ON l.user_id = u.id
            ORDER BY l.created_at DESC LIMIT 200
            """);
    }

    @GetMapping("/admin/configs")
    List<Map<String, Object>> getSystemConfigs(HttpServletRequest request) {
        authService.requireRole(request, "ADMIN");
        return sql.list("SELECT * FROM system_configs ORDER BY config_key ASC");
    }

    @PostMapping("/admin/configs")
    Map<String, String> saveSystemConfig(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        authService.requireRole(request, "ADMIN");
        sql.update("""
            INSERT INTO system_configs (config_key, config_value, remark)
            VALUES (?, ?, ?)
            ON CONFLICT(config_key) DO UPDATE SET
                config_value=excluded.config_value,
                remark=excluded.remark,
                updated_at=CURRENT_TIMESTAMP
            """,
            body.get("config_key"),
            body.get("config_value"),
            Values.text(body, "remark", "")
        );
        return Map.of("message", "系统配置已保存");
    }

    @GetMapping("/admin/reports/orders.csv")
    ResponseEntity<String> exportOrdersCsv(HttpServletRequest request) {
        authService.requireRole(request, "ADMIN");
        List<Map<String, Object>> rows = sql.list("SELECT id, user_id, total_amount, status, payment_method, logistics_company, logistics_no, created_at FROM orders ORDER BY created_at DESC");
        StringBuilder csv = new StringBuilder("id,user_id,total_amount,status,payment_method,logistics_company,logistics_no,created_at");
        for (Map<String, Object> row : rows) {
            csv.append('\n')
                .append(clean(row.get("id"))).append(',')
                .append(clean(row.get("user_id"))).append(',')
                .append(clean(row.get("total_amount"))).append(',')
                .append(clean(row.get("status"))).append(',')
                .append(clean(row.get("payment_method"))).append(',')
                .append(clean(row.get("logistics_company"))).append(',')
                .append(clean(row.get("logistics_no"))).append(',')
                .append(clean(row.get("created_at")));
        }
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_TYPE, new MediaType("text", "csv", StandardCharsets.UTF_8).toString())
            .body(csv.toString());
    }

    private String clean(Object value) {
        return value == null ? "" : String.valueOf(value).replace(",", " ");
    }
}
