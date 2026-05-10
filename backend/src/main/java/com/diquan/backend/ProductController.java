package com.diquan.backend;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/products")
class ProductController {
    private final Sql sql;
    private final AuthService authService;

    ProductController(Sql sql, AuthService authService) {
        this.sql = sql;
        this.authService = authService;
    }

    @GetMapping
    List<Map<String, Object>> getProducts(@RequestParam Map<String, String> queryParams) {
        StringBuilder query = new StringBuilder("""
            SELECT p.*, c.name AS category_name, m.shop_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN merchant_profiles m ON p.merchant_id = m.user_id
            WHERE 1=1
            """);
        List<Object> params = new ArrayList<>();

        if (!"all".equals(queryParams.get("scope"))) {
            query.append(" AND p.status = 'APPROVED'");
        }
        if (Values.hasText(queryParams.get("category"))) {
            query.append(" AND p.category_id = ?");
            params.add(queryParams.get("category"));
        }
        if (Values.hasText(queryParams.get("search"))) {
            query.append(" AND (p.name LIKE ? OR p.sub_title LIKE ? OR p.brand LIKE ? OR c.name LIKE ?)");
            String term = "%" + queryParams.get("search") + "%";
            params.add(term);
            params.add(term);
            params.add(term);
            params.add(term);
        }
        if (Values.hasText(queryParams.get("minPrice"))) {
            query.append(" AND p.price >= ?");
            params.add(queryParams.get("minPrice"));
        }
        if (Values.hasText(queryParams.get("maxPrice"))) {
            query.append(" AND p.price <= ?");
            params.add(queryParams.get("maxPrice"));
        }
        if ("1".equals(queryParams.get("inStock"))) {
            query.append(" AND p.stock > 0");
        }

        String sort = queryParams.get("sort");
        if ("price_asc".equals(sort)) query.append(" ORDER BY p.price ASC");
        else if ("price_desc".equals(sort)) query.append(" ORDER BY p.price DESC");
        else if ("sales".equals(sort)) query.append(" ORDER BY p.sales DESC");
        else query.append(" ORDER BY p.created_at DESC");

        return sql.list(query.toString(), params.toArray());
    }

    @GetMapping("/{id}")
    Map<String, Object> getProductById(@PathVariable long id) {
        Map<String, Object> product = sql.one("""
            SELECT p.*, c.name AS category_name, m.shop_name, m.logo AS shop_logo
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN merchant_profiles m ON p.merchant_id = m.user_id
            WHERE p.id = ?
            """, id);
        if (product == null) throw new ApiException(HttpStatus.NOT_FOUND, "Product not found");

        Map<String, Object> response = new LinkedHashMap<>(product);
        response.put("comments", sql.list("""
            SELECT cm.*, u.nickname
            FROM comments cm
            LEFT JOIN users u ON cm.user_id = u.id
            WHERE cm.product_id = ? AND cm.status = 'APPROVED'
            ORDER BY cm.created_at DESC LIMIT 10
            """, id));
        response.put("recommendations", sql.list(
            "SELECT id, name, price, main_image FROM products WHERE category_id = ? AND id != ? AND status = 'APPROVED' LIMIT 4",
            product.get("category_id"),
            id
        ));
        return response;
    }

    @PostMapping
    Map<String, String> createProduct(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        AuthenticatedUser user = authService.requireRole(request, "MERCHANT");
        sql.update("""
            INSERT INTO products (merchant_id, category_id, name, sub_title, brand, unit, price, stock, min_order, main_image, details, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
            """,
            user.id(),
            body.get("category_id"),
            body.get("name"),
            body.get("sub_title"),
            body.get("brand"),
            Values.text(body, "unit", "件"),
            body.get("price"),
            body.get("stock"),
            Values.intValue(body, "min_order", 1),
            body.get("main_image"),
            body.get("details")
        );
        return Map.of("message", "商品已提交审核");
    }

    @PutMapping("/{id}/review")
    Map<String, String> reviewProductByPut(HttpServletRequest request, @PathVariable long id, @RequestBody Map<String, Object> body) {
        return reviewProduct(request, id, body);
    }

    @PostMapping("/review/{id}")
    Map<String, String> reviewProductByPost(HttpServletRequest request, @PathVariable long id, @RequestBody Map<String, Object> body) {
        return reviewProduct(request, id, body);
    }

    private Map<String, String> reviewProduct(HttpServletRequest request, long id, Map<String, Object> body) {
        authService.requireRole(request, "ADMIN");
        sql.update(
            "UPDATE products SET status = ?, reject_reason = ? WHERE id = ?",
            body.get("status"),
            Values.text(body, "reject_reason", ""),
            id
        );
        return Map.of("message", "商品审核已更新");
    }
}
