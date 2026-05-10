package com.diquan.backend;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
class AuthController {
    private final Sql sql;
    private final BCryptPasswordEncoder passwordEncoder;
    private final AuthService authService;

    AuthController(Sql sql, BCryptPasswordEncoder passwordEncoder, AuthService authService) {
        this.sql = sql;
        this.passwordEncoder = passwordEncoder;
        this.authService = authService;
    }

    @PostMapping("/register")
    Map<String, String> register(@RequestBody Map<String, Object> body) {
        String phone = Values.text(body, "phone");
        String password = Values.text(body, "password");
        if (!Values.hasText(phone) || !Values.hasText(password)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "手机号和密码不能为空");
        }

        String role = "MERCHANT".equals(Values.text(body, "role")) ? "MERCHANT" : "USER";
        try {
            sql.update(
                "INSERT INTO users (phone, password, nickname, role) VALUES (?, ?, ?, ?)",
                phone,
                passwordEncoder.encode(password),
                Values.text(body, "nickname", phone),
                role
            );
            return Map.of("message", "注册成功");
        } catch (DuplicateKeyException error) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "手机号已注册");
        }
    }

    @PostMapping("/login")
    Map<String, Object> login(@RequestBody Map<String, Object> body) {
        String phone = Values.text(body, "phone");
        String password = Values.text(body, "password");
        Map<String, Object> user = sql.one("SELECT * FROM users WHERE phone = ?", phone);
        if (user == null
            || "DISABLED".equals(user.get("status"))
            || !passwordEncoder.matches(password == null ? "" : password, String.valueOf(user.get("password")))) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "手机号或密码错误");
        }

        long userId = Values.longValue(user.get("id"));
        String role = String.valueOf(user.get("role"));
        sql.update(
            "INSERT INTO audit_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)",
            userId,
            "LOGIN",
            "users",
            userId,
            "用户登录"
        );

        Map<String, Object> safeUser = new LinkedHashMap<>();
        safeUser.put("id", userId);
        safeUser.put("phone", user.get("phone"));
        safeUser.put("nickname", user.get("nickname"));
        safeUser.put("role", role);
        safeUser.put("avatar", user.get("avatar"));
        safeUser.put("enterprise_status", user.get("enterprise_status"));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("token", authService.token(userId, role, String.valueOf(user.get("phone"))));
        response.put("user", safeUser);
        return response;
    }
}
