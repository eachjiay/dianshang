package com.diquan.backend;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/enterprise")
class EnterpriseController {
    private final Sql sql;
    private final AuthService authService;

    EnterpriseController(Sql sql, AuthService authService) {
        this.sql = sql;
        this.authService = authService;
    }

    @PostMapping("/submit")
    Map<String, String> submit(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        AuthenticatedUser user = authService.requireUser(request);
        sql.update("""
            INSERT INTO enterprise_info (user_id, company_name, license_no, license_image, contact_name, contact_phone)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                company_name=excluded.company_name,
                license_no=excluded.license_no,
                license_image=excluded.license_image,
                contact_name=excluded.contact_name,
                contact_phone=excluded.contact_phone,
                status='PENDING'
            """,
            user.id(),
            body.get("company_name"),
            body.get("license_no"),
            body.get("license_image"),
            body.get("contact_name"),
            body.get("contact_phone")
        );
        sql.update("UPDATE users SET enterprise_status = 'PENDING' WHERE id = ?", user.id());
        return Map.of("message", "Certification submitted successfully");
    }

    @GetMapping("/status")
    Map<String, Object> status(HttpServletRequest request) {
        AuthenticatedUser user = authService.requireUser(request);
        Map<String, Object> info = sql.one("SELECT * FROM enterprise_info WHERE user_id = ?", user.id());
        return info == null ? Map.of("status", "NONE") : info;
    }

    @GetMapping("/applications")
    Object applications(HttpServletRequest request) {
        authService.requireRole(request, "ADMIN");
        return sql.list("""
            SELECT e.*, u.phone, u.nickname
            FROM enterprise_info e
            JOIN users u ON e.user_id = u.id
            ORDER BY e.created_at DESC
            """);
    }

    @PostMapping("/audit")
    Map<String, String> audit(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        authService.requireRole(request, "ADMIN");
        Object id = body.get("id");
        Map<String, Object> cert = sql.one("SELECT user_id FROM enterprise_info WHERE id = ?", id);
        if (cert == null) throw new ApiException(HttpStatus.NOT_FOUND, "Certification not found");

        String status = Values.text(body, "status");
        sql.update(
            "UPDATE enterprise_info SET status = ?, reject_reason = ? WHERE id = ?",
            status,
            body.get("reject_reason"),
            id
        );
        sql.update(
            "UPDATE users SET enterprise_status = ?, role = ? WHERE id = ?",
            status,
            "APPROVED".equals(status) ? "ENTERPRISE" : "USER",
            cert.get("user_id")
        );
        return Map.of("message", "Certification audited successfully");
    }
}
