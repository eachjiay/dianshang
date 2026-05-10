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
@RequestMapping("/api/address")
class AddressController {
    private final Sql sql;
    private final AuthService authService;

    AddressController(Sql sql, AuthService authService) {
        this.sql = sql;
        this.authService = authService;
    }

    @GetMapping
    List<Map<String, Object>> list(HttpServletRequest request) {
        AuthenticatedUser user = authService.requireUser(request);
        return sql.list("SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC", user.id());
    }

    @PostMapping
    Map<String, String> add(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        AuthenticatedUser user = authService.requireUser(request);
        if (Values.bool(body, "is_default")) {
            sql.update("UPDATE addresses SET is_default = 0 WHERE user_id = ?", user.id());
        }
        sql.update("""
            INSERT INTO addresses (user_id, receiver_name, receiver_phone, province, city, district, detail_address, is_default)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            user.id(),
            body.get("receiver_name"),
            body.get("receiver_phone"),
            body.get("province"),
            body.get("city"),
            body.get("district"),
            body.get("detail_address"),
            Values.bool(body, "is_default") ? 1 : 0
        );
        return Map.of("message", "Address added successfully");
    }

    @PutMapping
    Map<String, String> update(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        AuthenticatedUser user = authService.requireUser(request);
        if (Values.bool(body, "is_default")) {
            sql.update("UPDATE addresses SET is_default = 0 WHERE user_id = ?", user.id());
        }
        sql.update("""
            UPDATE addresses SET receiver_name=?, receiver_phone=?, province=?, city=?, district=?, detail_address=?, is_default=?
            WHERE id = ? AND user_id = ?
            """,
            body.get("receiver_name"),
            body.get("receiver_phone"),
            body.get("province"),
            body.get("city"),
            body.get("district"),
            body.get("detail_address"),
            Values.bool(body, "is_default") ? 1 : 0,
            body.get("id"),
            user.id()
        );
        return Map.of("message", "Address updated successfully");
    }

    @DeleteMapping("/{id}")
    Map<String, String> delete(HttpServletRequest request, @PathVariable long id) {
        AuthenticatedUser user = authService.requireUser(request);
        sql.update("DELETE FROM addresses WHERE id = ? AND user_id = ?", id, user.id());
        return Map.of("message", "Address deleted successfully");
    }
}
