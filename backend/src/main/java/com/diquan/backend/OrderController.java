package com.diquan.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
class OrderController {
    private final Sql sql;
    private final AuthService authService;
    private final TransactionTemplate transactionTemplate;
    private final ObjectMapper objectMapper;

    OrderController(Sql sql, AuthService authService, TransactionTemplate transactionTemplate, ObjectMapper objectMapper) {
        this.sql = sql;
        this.authService = authService;
        this.transactionTemplate = transactionTemplate;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/create")
    Map<String, Object> create(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        AuthenticatedUser user = authService.requireUser(request);
        Object rawItems = body.get("items");
        if (!(rawItems instanceof List<?> items) || items.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "订单商品不能为空");
        }

        return transactionTemplate.execute(status -> {
            double discountAmount = Values.doubleValue(body, "discount_amount", 0);
            double freightAmount = Values.doubleValue(body, "freight_amount", 0);
            double totalAmount = freightAmount - discountAmount;
            List<Map<String, Object>> normalizedItems = new ArrayList<>();
            List<Object> productIds = new ArrayList<>();

            for (Object itemObject : items) {
                if (!(itemObject instanceof Map<?, ?> rawItem)) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "订单商品格式错误");
                }
                Object productId = rawItem.get("product_id");
                int quantity = Values.intValue(rawItem.get("quantity"));
                Map<String, Object> product = sql.one("SELECT id, price, stock, status FROM products WHERE id = ?", productId);
                if (product == null || !"APPROVED".equals(product.get("status"))) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "商品不可购买");
                }
                if (Values.intValue(product.get("stock")) < quantity) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "库存不足");
                }

                double price = Values.doubleValue(product.get("price"));
                totalAmount += price * quantity;

                Map<String, Object> normalized = new LinkedHashMap<>();
                normalized.put("product_id", product.get("id"));
                normalized.put("quantity", quantity);
                normalized.put("price", price);
                normalizedItems.add(normalized);
                productIds.add(product.get("id"));
            }

            long orderId = sql.insert("""
                INSERT INTO orders (user_id, total_amount, discount_amount, freight_amount, shipping_address_id, invoice_title, status)
                VALUES (?, ?, ?, ?, ?, ?, 'UNPAID')
                """,
                user.id(),
                totalAmount,
                discountAmount,
                freightAmount,
                body.get("shipping_address_id"),
                Values.text(body, "invoice_title", "")
            );

            for (Map<String, Object> item : normalizedItems) {
                sql.update(
                    "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
                    orderId,
                    item.get("product_id"),
                    item.get("quantity"),
                    item.get("price")
                );
                sql.update("UPDATE products SET stock = stock - ? WHERE id = ?", item.get("quantity"), item.get("product_id"));
            }

            String placeholders = String.join(",", Collections.nCopies(productIds.size(), "?"));
            List<Object> deleteArgs = new ArrayList<>();
            deleteArgs.add(user.id());
            deleteArgs.addAll(productIds);
            sql.update("DELETE FROM cart WHERE user_id = ? AND product_id IN (" + placeholders + ")", deleteArgs.toArray());
            sql.update(
                "INSERT INTO audit_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)",
                user.id(),
                "CREATE_ORDER",
                "orders",
                orderId,
                "创建订单 " + totalAmount
            );

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("orderId", orderId);
            response.put("total_amount", totalAmount);
            response.put("message", "订单创建成功");
            return response;
        });
    }

    @GetMapping
    List<Map<String, Object>> list(HttpServletRequest request) {
        AuthenticatedUser user = authService.requireUser(request);
        List<Map<String, Object>> orders;
        if ("ADMIN".equals(user.role())) {
            orders = sql.list("SELECT * FROM orders ORDER BY created_at DESC");
        } else if ("MERCHANT".equals(user.role())) {
            orders = sql.list("""
                SELECT DISTINCT o.* FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                JOIN products p ON oi.product_id = p.id
                WHERE p.merchant_id = ?
                ORDER BY o.created_at DESC
                """, user.id());
        } else {
            orders = sql.list("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", user.id());
        }

        for (Map<String, Object> order : orders) {
            order.put("items", sql.list("""
                SELECT oi.*, p.name, p.main_image
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = ?
                """, order.get("id")));
        }
        return orders;
    }

    @PostMapping("/update-status")
    Map<String, String> updateStatus(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        AuthenticatedUser user = authService.requireUser(request);
        sql.update(
            "UPDATE orders SET status = ?, logistics_company = COALESCE(?, logistics_company), logistics_no = COALESCE(?, logistics_no) WHERE id = ?",
            body.get("status"),
            body.get("logistics_company"),
            body.get("logistics_no"),
            body.get("orderId")
        );
        sql.update(
            "INSERT INTO audit_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)",
            user.id(),
            "UPDATE_ORDER_STATUS",
            "orders",
            body.get("orderId"),
            body.get("status")
        );
        return Map.of("message", "订单状态已更新");
    }

    @PostMapping("/pay")
    Map<String, Object> pay(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        AuthenticatedUser user = authService.requireUser(request);
        Object orderId = body.get("orderId");
        Map<String, Object> order = sql.one("SELECT * FROM orders WHERE id = ?", orderId);
        if (order == null) throw new ApiException(HttpStatus.NOT_FOUND, "订单不存在");
        if (!"UNPAID".equals(order.get("status"))) {
            return Map.of("message", "支付回调已处理", "status", order.get("status"));
        }

        return transactionTemplate.execute(status -> {
            String method = Values.text(body, "method", "WECHAT");
            String tradeNo = Values.text(body, "trade_no");
            if (!Values.hasText(tradeNo)) {
                tradeNo = "MOCK" + System.currentTimeMillis() + orderId;
            }
            sql.update(
                "INSERT OR IGNORE INTO payment_logs (order_id, trade_no, method, amount, status, raw_payload) VALUES (?, ?, ?, ?, ?, ?)",
                orderId,
                tradeNo,
                method,
                order.get("total_amount"),
                "SUCCESS",
                json(body)
            );
            sql.update("UPDATE orders SET status = 'PAID', payment_method = ? WHERE id = ?", method, orderId);
            sql.update(
                "INSERT INTO messages (user_id, title, content, type) VALUES (?, ?, ?, ?)",
                order.get("user_id"),
                "订单支付成功",
                "订单 #" + orderId + " 已支付，等待商家发货。",
                "ORDER"
            );
            sql.update(
                "INSERT INTO audit_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)",
                user.id(),
                "PAY_ORDER",
                "orders",
                orderId,
                method
            );
            return Map.of("message", "支付成功");
        });
    }

    private String json(Map<String, Object> body) {
        try {
            return objectMapper.writeValueAsString(body);
        } catch (Exception error) {
            return String.valueOf(body);
        }
    }
}
