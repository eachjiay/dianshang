package com.diquan.backend;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cart")
class CartController {
    private final Sql sql;
    private final AuthService authService;

    CartController(Sql sql, AuthService authService) {
        this.sql = sql;
        this.authService = authService;
    }

    @GetMapping
    List<Map<String, Object>> getCart(HttpServletRequest request) {
        AuthenticatedUser user = authService.requireUser(request);
        return sql.list("""
            SELECT c.*, p.name, p.price, p.main_image, p.stock
            FROM cart c
            JOIN products p ON c.product_id = p.id
            WHERE c.user_id = ?
            """, user.id());
    }

    @PostMapping("/add")
    Map<String, String> add(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        AuthenticatedUser user = authService.requireUser(request);
        Object productId = body.get("product_id");
        int quantity = Values.intValue(body.get("quantity"));
        Map<String, Object> existing = sql.one("SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?", user.id(), productId);
        if (existing != null) {
            sql.update("UPDATE cart SET quantity = ? WHERE id = ?", Values.intValue(existing.get("quantity")) + quantity, existing.get("id"));
        } else {
            sql.update("INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)", user.id(), productId, quantity);
        }
        return Map.of("message", "Added to cart");
    }

    @PutMapping("/update")
    Map<String, String> update(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        AuthenticatedUser user = authService.requireUser(request);
        int quantity = Values.intValue(body.get("quantity"));
        if (quantity <= 0) {
            sql.update("DELETE FROM cart WHERE id = ? AND user_id = ?", body.get("id"), user.id());
        } else {
            sql.update("UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?", quantity, body.get("id"), user.id());
        }
        return Map.of("message", "Cart updated");
    }

    @DeleteMapping("/{id}")
    Map<String, String> remove(HttpServletRequest request, @PathVariable long id) {
        AuthenticatedUser user = authService.requireUser(request);
        sql.update("DELETE FROM cart WHERE id = ? AND user_id = ?", id, user.id());
        return Map.of("message", "Removed from cart");
    }
}
